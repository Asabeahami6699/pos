-- Marketplace RLS tighten + transactional POS sale + tenant access audit

-- 1) Public can only see online-listed products of active companies
DROP POLICY IF EXISTS "products_select" ON public.products;
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    (
      is_online_listing = true
      AND company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    )
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

-- 2) Super-admin tenant access audit log
CREATE TABLE IF NOT EXISTS public.tenant_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('enter', 'exit', 'api')),
  path TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tenant_access_logs_company_idx
  ON public.tenant_access_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tenant_access_logs_actor_idx
  ON public.tenant_access_logs (actor_user_id, created_at DESC);

ALTER TABLE public.tenant_access_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access_logs_super_admin" ON public.tenant_access_logs;
CREATE POLICY "tenant_access_logs_super_admin" ON public.tenant_access_logs
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 3) Transactional POS sale (idempotent by sale id)
CREATE OR REPLACE FUNCTION public.process_pos_sale(
  p_id UUID,
  p_company_id UUID,
  p_branch_id UUID,
  p_salesperson_id UUID,
  p_total NUMERIC,
  p_payment_method TEXT,
  p_payment_received NUMERIC,
  p_change_given NUMERIC,
  p_payment_notes TEXT,
  p_sales_type TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_created_at TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing JSONB;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_available INTEGER;
  v_inv RECORD;
  v_sale JSONB;
  v_branch_company UUID;
BEGIN
  SELECT to_jsonb(s) INTO v_existing
  FROM public.sales s
  WHERE s.id = p_id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('sale', v_existing, 'idempotent', true);
  END IF;

  SELECT company_id INTO v_branch_company
  FROM public.branches
  WHERE id = p_branch_id;

  IF v_branch_company IS NULL OR v_branch_company <> p_company_id THEN
    RAISE EXCEPTION 'Invalid branch for company';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    SELECT quantity INTO v_available
    FROM public.branch_inventory
    WHERE branch_id = p_branch_id AND product_id = v_product_id
    FOR UPDATE;

    IF COALESCE(v_available, 0) < v_qty THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%:%:%', v_product_id, v_qty, COALESCE(v_available, 0);
    END IF;
  END LOOP;

  INSERT INTO public.sales (
    id, company_id, branch_id, salesperson_id,
    total, payment_method, payment_received, change_given, payment_notes,
    sales_type, customer_name, customer_phone, created_at
  ) VALUES (
    p_id, p_company_id, p_branch_id, p_salesperson_id,
    p_total, p_payment_method, p_payment_received, p_change_given, p_payment_notes,
    p_sales_type, p_customer_name, p_customer_phone, p_created_at
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, price, original_price, wholesale_price, sales_type
    ) VALUES (
      p_id,
      v_product_id,
      v_qty,
      (v_item->>'price')::NUMERIC,
      COALESCE((v_item->>'original_price')::NUMERIC, (v_item->>'price')::NUMERIC),
      NULLIF(v_item->>'wholesale_price', '')::NUMERIC,
      p_sales_type
    );

    SELECT quantity, retail_quantity, wholesale_quantity
    INTO v_inv
    FROM public.branch_inventory
    WHERE branch_id = p_branch_id AND product_id = v_product_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.branch_inventory
      SET
        quantity = GREATEST(0, COALESCE(quantity, 0) - v_qty),
        retail_quantity = CASE
          WHEN p_sales_type = 'retail' AND retail_quantity IS NOT NULL
            THEN GREATEST(0, COALESCE(retail_quantity, 0) - v_qty)
          ELSE retail_quantity
        END,
        wholesale_quantity = CASE
          WHEN p_sales_type = 'wholesale' AND wholesale_quantity IS NOT NULL
            THEN GREATEST(0, COALESCE(wholesale_quantity, 0) - v_qty)
          ELSE wholesale_quantity
        END,
        last_updated = now()
      WHERE branch_id = p_branch_id AND product_id = v_product_id;
    END IF;
  END LOOP;

  SELECT to_jsonb(s) INTO v_sale FROM public.sales s WHERE s.id = p_id;
  RETURN jsonb_build_object('sale', v_sale, 'idempotent', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pos_sale(
  UUID, UUID, UUID, UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) TO service_role;
