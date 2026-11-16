-- Production hardening (aligned to live Supabase schema)
-- Safe to re-run: idempotent DDL, DROP-before-create for functions/policies

-- ---------------------------------------------------------------------------
-- Minimal schema additions (only what live DB lacks)
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Warehouse columns used by admin UI + sellable_inventory (missing from initial schema)
ALTER TABLE public.warehouse_inventory
  ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS batch_lot_number TEXT,
  ADD COLUMN IF NOT EXISTS date_received DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT 'Main Warehouse',
  ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost_per_box NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS boxes_received INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_stock BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_inventory_company_product_uidx
  ON public.warehouse_inventory (company_id, product_id);

CREATE INDEX IF NOT EXISTS idx_products_sku_company ON public.products(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode_company ON public.products(company_id, barcode);

CREATE OR REPLACE VIEW public.sellable_inventory AS
SELECT
  wi.company_id,
  wi.product_id,
  p.name AS product_name,
  p.sku,
  p.barcode,
  wi.quantity AS sellable_quantity,
  wi.min_stock_level,
  (wi.quantity <= COALESCE(wi.min_stock_level, p.low_stock_threshold, 5)) AS low_stock
FROM public.warehouse_inventory wi
JOIN public.products p ON p.id = wi.product_id;

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product
  ON public.inventory_reservations(company_id, product_id, expires_at);

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rls_company_match(UUID);
DROP FUNCTION IF EXISTS public.company_subscription_active(UUID);
DROP FUNCTION IF EXISTS public.user_has_branch_access(UUID);
DROP FUNCTION IF EXISTS public.is_company_admin();
DROP FUNCTION IF EXISTS public.is_company_staff();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_user_company_id();

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('company_admin', 'salesperson')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'company_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin()
    OR public.is_company_admin()
    OR EXISTS (
      SELECT 1 FROM public.branch_staff bs
      WHERE bs.user_id = auth.uid() AND bs.branch_id = p_branch_id
    )
$$;

CREATE OR REPLACE FUNCTION public.company_subscription_active(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND c.status NOT IN ('suspended', 'expired')
      AND (c.plan_renewal_at IS NULL OR c.plan_renewal_at >= now())
  )
$$;

CREATE OR REPLACE FUNCTION public.rls_company_match(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR p_company_id = public.current_user_company_id()
$$;

-- ---------------------------------------------------------------------------
-- Atomic inventory / order RPCs (live column names: updated_at, not last_updated)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_warehouse_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_warehouse_inventory(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_branch_inventory(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_branch_inventory(UUID, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_available_warehouse_qty(UUID, UUID);
DROP FUNCTION IF EXISTS public.reserve_checkout_stock(UUID, JSONB, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.release_checkout_reservations(UUID);
DROP FUNCTION IF EXISTS public.fulfill_online_order(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, NUMERIC, UUID, TEXT
);
DROP FUNCTION IF EXISTS public.complete_payment_and_fulfill(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.process_pos_return(UUID, UUID, UUID, UUID, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.update_warehouse_inventory(
  p_product_id UUID,
  p_company_id UUID,
  p_quantity_change INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_qty INTEGER;
BEGIN
  IF p_quantity_change < 0 THEN
    UPDATE public.warehouse_inventory
    SET quantity = quantity + p_quantity_change,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND quantity + p_quantity_change >= 0
    RETURNING quantity INTO v_new_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient warehouse stock for product %', p_product_id;
    END IF;
  ELSE
    INSERT INTO public.warehouse_inventory (company_id, product_id, quantity, updated_at, last_restocked_at)
    VALUES (p_company_id, p_product_id, p_quantity_change, now(), now())
    ON CONFLICT (company_id, product_id) DO UPDATE
    SET quantity = public.warehouse_inventory.quantity + EXCLUDED.quantity,
        updated_at = now(),
        last_restocked_at = now()
    RETURNING quantity INTO v_new_qty;
  END IF;

  RETURN v_new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_branch_inventory(
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity_change INTEGER,
  p_retail_change INTEGER DEFAULT 0,
  p_wholesale_change INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id UUID;
  v_new_qty INTEGER;
BEGIN
  SELECT company_id INTO v_company_id FROM public.branches WHERE id = p_branch_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  IF p_quantity_change < 0 THEN
    UPDATE public.branch_inventory
    SET quantity = quantity + p_quantity_change,
        retail_quantity = GREATEST(0, COALESCE(retail_quantity, 0) + p_retail_change),
        wholesale_quantity = GREATEST(0, COALESCE(wholesale_quantity, 0) + p_wholesale_change),
        updated_at = now()
    WHERE branch_id = p_branch_id
      AND product_id = p_product_id
      AND quantity + p_quantity_change >= 0
    RETURNING quantity INTO v_new_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient branch stock for product %', p_product_id;
    END IF;
  ELSE
    INSERT INTO public.branch_inventory (
      company_id, branch_id, product_id, quantity,
      retail_quantity, wholesale_quantity, updated_at
    )
    VALUES (
      v_company_id, p_branch_id, p_product_id, p_quantity_change,
      GREATEST(0, p_retail_change), GREATEST(0, p_wholesale_change), now()
    )
    ON CONFLICT (branch_id, product_id) DO UPDATE
    SET quantity = public.branch_inventory.quantity + EXCLUDED.quantity,
        retail_quantity = GREATEST(0, COALESCE(public.branch_inventory.retail_quantity, 0) + p_retail_change),
        wholesale_quantity = GREATEST(0, COALESCE(public.branch_inventory.wholesale_quantity, 0) + p_wholesale_change),
        updated_at = now()
    RETURNING quantity INTO v_new_qty;
  END IF;

  RETURN v_new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_warehouse_stock(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM public.products WHERE id = p_product_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  RETURN public.update_warehouse_inventory(p_product_id, v_company_id, p_quantity);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_warehouse_qty(
  p_company_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(wi.quantity, 0) - COALESCE((
    SELECT SUM(r.quantity)::INTEGER
    FROM public.inventory_reservations r
    WHERE r.company_id = p_company_id
      AND r.product_id = p_product_id
      AND r.expires_at > now()
  ), 0)
  FROM public.warehouse_inventory wi
  WHERE wi.company_id = p_company_id AND wi.product_id = p_product_id
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

    v_available := public.get_available_warehouse_qty(p_company_id, v_product_id);
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

CREATE OR REPLACE FUNCTION public.release_checkout_reservations(p_payment_transaction_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.inventory_reservations
  WHERE payment_transaction_id = p_payment_transaction_id
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
  v_rows INTEGER;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    UPDATE public.warehouse_inventory
    SET quantity = quantity - v_qty,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = v_product_id
      AND quantity >= v_qty;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;
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

CREATE OR REPLACE FUNCTION public.complete_payment_and_fulfill(
  p_transaction_id UUID,
  p_customer_id UUID,
  p_paystack_response JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx RECORD;
  v_payload JSONB;
  v_order_id UUID;
  v_shipping_address TEXT;
BEGIN
  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF v_tx.customer_id != p_customer_id THEN
    RAISE EXCEPTION 'Unauthorized payment reference';
  END IF;

  IF v_tx.status = 'success' AND v_tx.order_id IS NOT NULL THEN
    RETURN v_tx.order_id;
  END IF;

  v_payload := v_tx.checkout_payload;

  v_shipping_address := CASE
    WHEN (v_payload->>'fulfillment_type') = 'pickup' THEN 'Store pickup'
    ELSE COALESCE(v_payload->>'shipping_address', '')
  END;

  v_order_id := public.fulfill_online_order(
    p_customer_id := p_customer_id,
    p_company_id := (v_payload->>'company_id')::UUID,
    p_total := v_tx.amount,
    p_shipping_name := v_payload->>'shipping_name',
    p_shipping_phone := v_payload->>'shipping_phone',
    p_shipping_address := v_shipping_address,
    p_fulfillment_type := COALESCE(v_payload->>'fulfillment_type', 'delivery'),
    p_payment_method := 'paystack',
    p_payment_status := 'paid',
    p_items := v_payload->'items',
    p_paystack_reference := v_tx.paystack_reference,
    p_payment_transaction_id := p_transaction_id,
    p_platform_fee := COALESCE(v_tx.platform_fee, 0),
    p_address_id := NULLIF(v_payload->>'address_id', '')::UUID,
    p_notes := v_payload->>'notes'
  );

  UPDATE public.payment_transactions
  SET status = 'success',
      order_id = v_order_id,
      paystack_response = p_paystack_response,
      verified_at = now(),
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pos_return(
  p_sale_id UUID,
  p_branch_id UUID,
  p_company_id UUID,
  p_salesperson_id UUID,
  p_reason TEXT,
  p_items JSONB,
  p_sales_type TEXT DEFAULT 'retail'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_return_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_price NUMERIC;
  v_total_refund NUMERIC := 0;
  v_ts TIMESTAMPTZ := now();
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_refund := v_total_refund
      + ((v_item->>'price')::NUMERIC * (v_item->>'quantity')::INTEGER);
  END LOOP;

  INSERT INTO public.returns (
    sale_id, company_id, branch_id, salesperson_id,
    total_refund, reason, status, sales_type,
    resolved_by, resolved_at, created_at
  ) VALUES (
    p_sale_id, p_company_id, p_branch_id, p_salesperson_id,
    v_total_refund, p_reason, 'completed', p_sales_type,
    p_salesperson_id, v_ts, v_ts
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::NUMERIC;

    INSERT INTO public.return_items (
      return_id, product_id, quantity, price, refund_amount,
      restocked, restocked_at, sales_type
    ) VALUES (
      v_return_id, v_product_id, v_qty, v_price, v_price * v_qty,
      true, v_ts, p_sales_type
    );

    PERFORM public.update_branch_inventory(
      p_branch_id, v_product_id, v_qty,
      CASE WHEN p_sales_type = 'retail' THEN v_qty ELSE 0 END,
      CASE WHEN p_sales_type = 'wholesale' THEN v_qty ELSE 0 END
    );
  END LOOP;

  INSERT INTO public.transaction_logs (
    company_id, branch_id, user_id,
    action_type, reference_id, amount, details
  ) VALUES (
    p_company_id, p_branch_id, p_salesperson_id,
    'return', v_return_id, v_total_refund,
    jsonb_build_object('reason', p_reason, 'sale_id', p_sale_id)
  );

  RETURN v_return_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (tables present in live DB)
-- ---------------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $rls$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'subscriptions', 'subscription_features',
    'branches', 'branch_staff', 'branch_inventory', 'warehouse_inventory',
    'central_inventory', 'sales', 'sale_items', 'returns', 'return_items',
    'restock_requests', 'restock_invoices', 'restock_invoice_items',
    'invoices', 'invoice_items',
    'salaries', 'payrolls',
    'allocations', 'allocation_items', 'notifications', 'price_history',
    'transaction_logs', 'activity_log',
    'online_orders', 'online_order_items', 'product_ratings', 'product_media',
    'customer_addresses', 'customer_payment_methods',
    'shop_chat_threads', 'shop_chat_messages', 'payment_transactions',
    'product_click_events', 'inventory_reservations', 'platform_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $rls$;

-- Companies
DROP POLICY IF EXISTS "companies_public_active_read" ON public.companies;
CREATE POLICY "companies_public_active_read" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.is_super_admin());

DROP POLICY IF EXISTS "companies_staff_read_own" ON public.companies;
CREATE POLICY "companies_staff_read_own" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.current_user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "companies_super_admin_write" ON public.companies;
CREATE POLICY "companies_super_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_company_staff_read" ON public.users;
CREATE POLICY "users_company_staff_read" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_admin())
  );

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Products
DROP POLICY IF EXISTS "products_company_read" ON public.products;
DROP POLICY IF EXISTS "products_public_marketplace_read" ON public.products;
CREATE POLICY "products_public_marketplace_read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE status = 'active')
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;
CREATE POLICY "products_company_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  );

CREATE POLICY "products_company_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  );

CREATE POLICY "products_company_delete" ON public.products
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_admin()
        AND public.company_subscription_active(company_id))
  );

-- Core tenant tables
DO $pol$ BEGIN
  IF to_regclass('public.branches') IS NOT NULL THEN
    DROP POLICY IF EXISTS "branches_company" ON public.branches;
    CREATE POLICY "branches_company" ON public.branches FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.branch_staff') IS NOT NULL THEN
    DROP POLICY IF EXISTS "branch_staff_company" ON public.branch_staff;
    CREATE POLICY "branch_staff_company" ON public.branch_staff FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_id AND public.rls_company_match(b.company_id)
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_id AND public.rls_company_match(b.company_id)
      ));
  END IF;

  IF to_regclass('public.branch_inventory') IS NOT NULL THEN
    DROP POLICY IF EXISTS "branch_inventory_company" ON public.branch_inventory;
    CREATE POLICY "branch_inventory_company" ON public.branch_inventory FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.warehouse_inventory') IS NOT NULL THEN
    DROP POLICY IF EXISTS "warehouse_inventory_company" ON public.warehouse_inventory;
    CREATE POLICY "warehouse_inventory_company" ON public.warehouse_inventory FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.central_inventory') IS NOT NULL THEN
    DROP POLICY IF EXISTS "central_inventory_company" ON public.central_inventory;
    CREATE POLICY "central_inventory_company" ON public.central_inventory FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.sales') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sales_company_branch" ON public.sales;
    CREATE POLICY "sales_company_branch" ON public.sales FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND (public.is_company_admin() OR public.user_has_branch_access(branch_id)))
      )
      WITH CHECK (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND public.company_subscription_active(company_id)
            AND (public.is_company_admin() OR public.user_has_branch_access(branch_id)))
      );
  END IF;

  IF to_regclass('public.sale_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sale_items_via_sale" ON public.sale_items;
    CREATE POLICY "sale_items_via_sale" ON public.sale_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.sales s WHERE s.id = sale_id
          AND (public.is_super_admin() OR (
            s.company_id = public.current_user_company_id()
            AND (public.is_company_admin() OR public.user_has_branch_access(s.branch_id))
          ))
      ));
  END IF;

  IF to_regclass('public.returns') IS NOT NULL THEN
    DROP POLICY IF EXISTS "returns_company_branch" ON public.returns;
    CREATE POLICY "returns_company_branch" ON public.returns FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND (public.is_company_admin() OR public.user_has_branch_access(branch_id)))
      )
      WITH CHECK (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND public.company_subscription_active(company_id))
      );
  END IF;

  IF to_regclass('public.return_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "return_items_via_return" ON public.return_items;
    CREATE POLICY "return_items_via_return" ON public.return_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.returns r WHERE r.id = return_id
          AND (public.is_super_admin() OR r.company_id = public.current_user_company_id())
      ));
  END IF;

  IF to_regclass('public.restock_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "restock_requests_company" ON public.restock_requests;
    CREATE POLICY "restock_requests_company" ON public.restock_requests FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.restock_invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "restock_invoices_company" ON public.restock_invoices;
    CREATE POLICY "restock_invoices_company" ON public.restock_invoices FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.restock_invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "restock_invoice_items_via_request" ON public.restock_invoice_items;
    CREATE POLICY "restock_invoice_items_via_request" ON public.restock_invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.restock_requests rr
        WHERE rr.id = restock_request_id AND public.rls_company_match(rr.company_id)
      ));
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoices_company" ON public.invoices;
    CREATE POLICY "invoices_company" ON public.invoices FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoice_items_via_invoice" ON public.invoice_items;
    CREATE POLICY "invoice_items_via_invoice" ON public.invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i
        JOIN public.restock_requests rr ON rr.id = i.restock_request_id
        WHERE i.id = invoice_id AND public.rls_company_match(rr.company_id)
      ));
  END IF;

  IF to_regclass('public.allocations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "allocations_company" ON public.allocations;
    CREATE POLICY "allocations_company" ON public.allocations FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.allocation_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "allocation_items_via_allocation" ON public.allocation_items;
    CREATE POLICY "allocation_items_via_allocation" ON public.allocation_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.allocations a
        WHERE a.id = allocation_id AND public.rls_company_match(a.company_id)
      ));
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "notifications_company" ON public.notifications;
    CREATE POLICY "notifications_company" ON public.notifications FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.price_history') IS NOT NULL THEN
    DROP POLICY IF EXISTS "price_history_company" ON public.price_history;
    CREATE POLICY "price_history_company" ON public.price_history FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.transaction_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "transaction_logs_company" ON public.transaction_logs;
    CREATE POLICY "transaction_logs_company" ON public.transaction_logs FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.activity_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS "activity_log_company" ON public.activity_log;
    CREATE POLICY "activity_log_company" ON public.activity_log FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "subscriptions_company" ON public.subscriptions;
    CREATE POLICY "subscriptions_company" ON public.subscriptions FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.is_super_admin());
  END IF;

  IF to_regclass('public.subscription_features') IS NOT NULL THEN
    DROP POLICY IF EXISTS "subscription_features_read" ON public.subscription_features;
    CREATE POLICY "subscription_features_read" ON public.subscription_features
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "subscription_features_super_admin_write" ON public.subscription_features;
    CREATE POLICY "subscription_features_super_admin_write" ON public.subscription_features
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF to_regclass('public.salaries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "salaries_company" ON public.salaries;
    CREATE POLICY "salaries_company" ON public.salaries FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR user_id = auth.uid()
        OR (public.is_company_admin() AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = salaries.user_id AND u.company_id = public.current_user_company_id()
        ))
      );
  END IF;

  IF to_regclass('public.payrolls') IS NOT NULL THEN
    DROP POLICY IF EXISTS "payrolls_company" ON public.payrolls;
    CREATE POLICY "payrolls_company" ON public.payrolls FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR user_id = auth.uid()
        OR (public.is_company_admin() AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = payrolls.user_id AND u.company_id = public.current_user_company_id()
        ))
      );
  END IF;

  IF to_regclass('public.online_orders') IS NOT NULL THEN
    DROP POLICY IF EXISTS "online_orders_access" ON public.online_orders;
    CREATE POLICY "online_orders_access" ON public.online_orders FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      )
      WITH CHECK (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      );
  END IF;

  IF to_regclass('public.online_order_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "online_order_items_via_order" ON public.online_order_items;
    CREATE POLICY "online_order_items_via_order" ON public.online_order_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.online_orders o WHERE o.id = order_id
          AND (public.is_super_admin() OR o.customer_id = auth.uid()
               OR (o.company_id = public.current_user_company_id() AND public.is_company_staff()))
      ));
  END IF;

  IF to_regclass('public.product_ratings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_ratings_access" ON public.product_ratings;
    CREATE POLICY "product_ratings_access" ON public.product_ratings FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR company_id = public.current_user_company_id()
      )
      WITH CHECK (customer_id = auth.uid() OR public.is_super_admin());
  END IF;

  IF to_regclass('public.product_media') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_media_public_read" ON public.product_media;
    CREATE POLICY "product_media_public_read" ON public.product_media
      FOR SELECT USING (true);
    DROP POLICY IF EXISTS "product_media_company_insert" ON public.product_media;
    DROP POLICY IF EXISTS "product_media_company_update" ON public.product_media;
    DROP POLICY IF EXISTS "product_media_company_delete" ON public.product_media;
    CREATE POLICY "product_media_company_write" ON public.product_media
      FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.customer_addresses') IS NOT NULL THEN
    DROP POLICY IF EXISTS "customer_addresses_own" ON public.customer_addresses;
    CREATE POLICY "customer_addresses_own" ON public.customer_addresses FOR ALL TO authenticated
      USING (customer_id = auth.uid())
      WITH CHECK (customer_id = auth.uid());
  END IF;

  IF to_regclass('public.customer_payment_methods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "customer_payment_methods_own" ON public.customer_payment_methods;
    CREATE POLICY "customer_payment_methods_own" ON public.customer_payment_methods FOR ALL TO authenticated
      USING (customer_id = auth.uid())
      WITH CHECK (customer_id = auth.uid());
  END IF;

  IF to_regclass('public.shop_chat_threads') IS NOT NULL THEN
    DROP POLICY IF EXISTS "shop_chat_threads_access" ON public.shop_chat_threads;
    CREATE POLICY "shop_chat_threads_access" ON public.shop_chat_threads FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      )
      WITH CHECK (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      );
  END IF;

  IF to_regclass('public.shop_chat_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "shop_chat_messages_via_thread" ON public.shop_chat_messages;
    CREATE POLICY "shop_chat_messages_via_thread" ON public.shop_chat_messages FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.shop_chat_threads t WHERE t.id = thread_id
          AND (public.is_super_admin() OR t.customer_id = auth.uid()
               OR (t.company_id = public.current_user_company_id() AND public.is_company_staff()))
      ));
  END IF;

  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "payment_transactions_access" ON public.payment_transactions;
    CREATE POLICY "payment_transactions_access" ON public.payment_transactions FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_admin())
      )
      WITH CHECK (customer_id = auth.uid() OR public.is_super_admin());
  END IF;

  IF to_regclass('public.product_click_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_click_events_read" ON public.product_click_events;
    CREATE POLICY "product_click_events_read" ON public.product_click_events FOR SELECT TO authenticated
      USING (public.is_super_admin() OR company_id = public.current_user_company_id());
  END IF;

  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "inventory_reservations_staff" ON public.inventory_reservations;
    CREATE POLICY "inventory_reservations_staff" ON public.inventory_reservations FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "platform_settings_public_read" ON public.platform_settings;
    CREATE POLICY "platform_settings_public_read" ON public.platform_settings
      FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "platform_settings_super_admin_write" ON public.platform_settings;
    CREATE POLICY "platform_settings_super_admin_write" ON public.platform_settings
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $pol$;

-- RPC + RLS helper grants (required for policies to evaluate without 400 errors)
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_staff() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.company_subscription_active(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rls_company_match(UUID) TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION public.update_warehouse_inventory(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_branch_inventory(UUID, UUID, INTEGER, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_warehouse_stock(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_warehouse_qty(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_online_order(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, NUMERIC, UUID, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_and_fulfill(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_checkout_stock(UUID, JSONB, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_pos_return(UUID, UUID, UUID, UUID, TEXT, JSONB, TEXT) TO service_role;
