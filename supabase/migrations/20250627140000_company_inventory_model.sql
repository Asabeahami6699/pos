-- Companies without a central warehouse use branch inventory for marketplace/POS stock.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS inventory_model TEXT NOT NULL DEFAULT 'warehouse';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_inventory_model_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_inventory_model_check
  CHECK (inventory_model IN ('warehouse', 'branch_only'));

COMMENT ON COLUMN public.companies.inventory_model IS
  'warehouse = central warehouse + allocations; branch_only = stock lives at branches only';

-- Unified sellable quantity (warehouse OR summed branches, minus active reservations)
CREATE OR REPLACE FUNCTION public.get_sellable_qty(
  p_company_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_model TEXT;
  v_raw INTEGER := 0;
  v_reserved INTEGER := 0;
BEGIN
  SELECT COALESCE(c.inventory_model, 'warehouse') INTO v_model
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_model = 'branch_only' THEN
    SELECT COALESCE(SUM(bi.quantity), 0)::INTEGER INTO v_raw
    FROM public.branch_inventory bi
    WHERE bi.company_id = p_company_id
      AND bi.product_id = p_product_id;
  ELSE
    SELECT COALESCE(wi.quantity, 0)::INTEGER INTO v_raw
    FROM public.warehouse_inventory wi
    WHERE wi.company_id = p_company_id
      AND wi.product_id = p_product_id;
  END IF;

  SELECT COALESCE(SUM(r.quantity), 0)::INTEGER INTO v_reserved
  FROM public.inventory_reservations r
  WHERE r.company_id = p_company_id
    AND r.product_id = p_product_id
    AND r.expires_at > now();

  RETURN GREATEST(0, v_raw - v_reserved);
END;
$$;

-- Backward-compatible alias used by checkout RPCs
CREATE OR REPLACE FUNCTION public.get_available_warehouse_qty(
  p_company_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_sellable_qty(p_company_id, p_product_id);
$$;

CREATE OR REPLACE FUNCTION public.deduct_sellable_stock(
  p_company_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_model TEXT;
  v_remaining INTEGER;
  rec RECORD;
  v_take INTEGER;
  v_rows INTEGER;
BEGIN
  IF p_qty <= 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(c.inventory_model, 'warehouse') INTO v_model
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_model = 'branch_only' THEN
    v_remaining := p_qty;

    FOR rec IN
      SELECT bi.branch_id, bi.quantity
      FROM public.branch_inventory bi
      WHERE bi.company_id = p_company_id
        AND bi.product_id = p_product_id
        AND bi.quantity > 0
      ORDER BY bi.quantity DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(rec.quantity, v_remaining);
      PERFORM public.update_branch_inventory(rec.branch_id, p_product_id, -v_take);
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
    END IF;
  ELSE
    UPDATE public.warehouse_inventory
    SET quantity = quantity - p_qty,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND quantity >= p_qty;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(
  p_company_id UUID,
  p_items JSONB,
  p_payment_transaction_id UUID,
  p_ttl_minutes INTEGER DEFAULT 15
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_available INTEGER;
BEGIN
  DELETE FROM public.inventory_reservations
  WHERE payment_transaction_id = p_payment_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    v_available := public.get_sellable_qty(p_company_id, v_product_id);
    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    INSERT INTO public.inventory_reservations (
      company_id, product_id, quantity, payment_transaction_id, expires_at
    ) VALUES (
      p_company_id, v_product_id, v_qty, p_payment_transaction_id,
      now() + (p_ttl_minutes || ' minutes')::INTERVAL
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_online_order(
  p_customer_id UUID,
  p_company_id UUID,
  p_total NUMERIC,
  p_shipping_name TEXT,
  p_shipping_phone TEXT,
  p_shipping_address TEXT,
  p_fulfillment_type TEXT,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_items JSONB,
  p_paystack_reference TEXT DEFAULT NULL,
  p_payment_transaction_id UUID DEFAULT NULL,
  p_platform_fee NUMERIC DEFAULT 0,
  p_address_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_unit_price NUMERIC;
  v_product_name TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    PERFORM public.deduct_sellable_stock(p_company_id, v_product_id, v_qty);
  END LOOP;

  INSERT INTO public.online_orders (
    company_id, customer_id, total, shipping_name, shipping_phone,
    shipping_address, fulfillment_type, payment_method, payment_status,
    momo_reference, address_id, notes, status, payment_transaction_id, platform_fee
  ) VALUES (
    p_company_id, p_customer_id, p_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_fulfillment_type, p_payment_method, p_payment_status,
    p_paystack_reference, p_address_id, p_notes, 'pending', p_payment_transaction_id, p_platform_fee
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_product_name := v_item->>'product_name';

    INSERT INTO public.online_order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price
    ) VALUES (
      v_order_id, v_product_id, v_product_name, v_qty, v_unit_price, v_unit_price * v_qty
    );
  END LOOP;

  IF p_payment_transaction_id IS NOT NULL THEN
    DELETE FROM public.inventory_reservations
    WHERE payment_transaction_id = p_payment_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_sellable_stock(
  p_company_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_model TEXT;
  v_branch_id UUID;
BEGIN
  IF p_qty <= 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(c.inventory_model, 'warehouse') INTO v_model
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_model = 'branch_only' THEN
    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.company_id = p_company_id
    ORDER BY b.created_at ASC
    LIMIT 1;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'No branch available to restore stock';
    END IF;

    PERFORM public.update_branch_inventory(v_branch_id, p_product_id, p_qty);
  ELSE
    PERFORM public.update_warehouse_inventory(p_product_id, p_company_id, p_qty);
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.sellable_inventory AS
SELECT
  s.company_id,
  s.product_id,
  p.name AS product_name,
  p.sku,
  p.barcode,
  s.sellable_quantity,
  s.min_stock_level,
  (s.sellable_quantity <= COALESCE(s.min_stock_level, p.low_stock_threshold, 5)) AS low_stock
FROM (
  SELECT
    wi.company_id,
    wi.product_id,
    wi.quantity AS sellable_quantity,
    wi.min_stock_level
  FROM public.warehouse_inventory wi
  JOIN public.companies c ON c.id = wi.company_id
  WHERE COALESCE(c.inventory_model, 'warehouse') = 'warehouse'

  UNION ALL

  SELECT
    bi.company_id,
    bi.product_id,
    SUM(bi.quantity)::INTEGER AS sellable_quantity,
    NULL::INTEGER AS min_stock_level
  FROM public.branch_inventory bi
  JOIN public.companies c ON c.id = bi.company_id
  WHERE c.inventory_model = 'branch_only'
  GROUP BY bi.company_id, bi.product_id
) s
JOIN public.products p ON p.id = s.product_id;

GRANT EXECUTE ON FUNCTION public.get_sellable_qty(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_sellable_stock(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_sellable_stock(UUID, UUID, INTEGER) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
