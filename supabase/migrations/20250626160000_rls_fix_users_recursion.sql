-- Fix 500 on users (RLS recursion) — SAFE TO RE-RUN (drops before every create)

DROP FUNCTION IF EXISTS public.current_user_company_id();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.is_company_admin();
DROP FUNCTION IF EXISTS public.is_company_staff();

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

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'company_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('company_admin', 'salesperson')
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_staff() TO PUBLIC;

-- users (no self-subquery — prevents infinite recursion)
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_company_staff_read" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (public.is_company_admin() AND company_id = public.current_user_company_id())
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- companies
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "companies_public_active_read" ON public.companies;
DROP POLICY IF EXISTS "companies_staff_read_own" ON public.companies;
DROP POLICY IF EXISTS "companies_admin_write" ON public.companies;
DROP POLICY IF EXISTS "companies_super_admin_write" ON public.companies;

CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR id = public.current_user_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "companies_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- products
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_modify" ON public.products;
DROP POLICY IF EXISTS "products_public_marketplace_read" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;
DROP POLICY IF EXISTS "products_company_read" ON public.products;
DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_tenant" ON public.products;

CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "products_modify" ON public.products
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR company_id = public.current_user_company_id())
  WITH CHECK (public.is_super_admin() OR company_id = public.current_user_company_id());

-- company_id tables: always DROP then CREATE
DO $fix$
DECLARE
  tbl TEXT;
  tables_with_company TEXT[] := ARRAY[
    'branches', 'branch_inventory', 'warehouse_inventory', 'central_inventory',
    'sales', 'restock_requests', 'allocations', 'notifications', 'price_history',
    'transaction_logs', 'activity_log', 'returns', 'restock_invoices',
    'subscriptions', 'invoices', 'inventory_reservations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_with_company
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
    ) THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (public.is_super_admin() OR company_id = public.current_user_company_id())
       WITH CHECK (public.is_super_admin() OR company_id = public.current_user_company_id())',
      tbl || '_tenant', tbl
    );
  END LOOP;
END $fix$;

-- sale_items
DROP POLICY IF EXISTS "sale_items_tenant" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_via_sale" ON public.sale_items;
CREATE POLICY "sale_items_tenant" ON public.sale_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (public.is_super_admin() OR s.company_id = public.current_user_company_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (public.is_super_admin() OR s.company_id = public.current_user_company_id())
  ));

-- branch_staff
DROP POLICY IF EXISTS "branch_staff_tenant" ON public.branch_staff;
DROP POLICY IF EXISTS "branch_staff_company" ON public.branch_staff;
CREATE POLICY "branch_staff_tenant" ON public.branch_staff FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.company_id = public.current_user_company_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.company_id = public.current_user_company_id()
    )
  );

-- online_orders (customer + company)
DROP POLICY IF EXISTS "online_orders_access" ON public.online_orders;
DROP POLICY IF EXISTS "online_orders_tenant" ON public.online_orders;
CREATE POLICY "online_orders_access" ON public.online_orders FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
  )
  WITH CHECK (
    public.is_super_admin() OR customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
  );

DROP POLICY IF EXISTS "online_order_items_access" ON public.online_order_items;
DROP POLICY IF EXISTS "online_order_items_via_order" ON public.online_order_items;
DROP POLICY IF EXISTS "online_order_items_tenant" ON public.online_order_items;
CREATE POLICY "online_order_items_access" ON public.online_order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.online_orders o WHERE o.id = order_id
      AND (public.is_super_admin() OR o.customer_id = auth.uid()
           OR o.company_id = public.current_user_company_id())
  ));

-- salaries / payrolls (optional tables — not in baseline schema)
DO $pol$ BEGIN
  IF to_regclass('public.salaries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "salaries_tenant" ON public.salaries;
    CREATE POLICY "salaries_tenant" ON public.salaries FOR ALL TO authenticated
      USING (
        user_id = auth.uid() OR public.is_super_admin()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = salaries.user_id AND u.company_id = public.current_user_company_id()
        )
      );
  END IF;

  IF to_regclass('public.payrolls') IS NOT NULL THEN
    DROP POLICY IF EXISTS "payrolls_tenant" ON public.payrolls;
    CREATE POLICY "payrolls_tenant" ON public.payrolls FOR ALL TO authenticated
      USING (
        user_id = auth.uid() OR public.is_super_admin()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = payrolls.user_id AND u.company_id = public.current_user_company_id()
        )
      );
  END IF;
END $pol$;

-- e-commerce / customer tables (not plain company_id tenant)
DROP POLICY IF EXISTS "customer_addresses_own" ON public.customer_addresses;
CREATE POLICY "customer_addresses_own" ON public.customer_addresses FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "customer_payment_methods_own" ON public.customer_payment_methods;
CREATE POLICY "customer_payment_methods_own" ON public.customer_payment_methods FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "product_ratings_access" ON public.product_ratings;
DROP POLICY IF EXISTS "product_ratings_tenant" ON public.product_ratings;
CREATE POLICY "product_ratings_access" ON public.product_ratings FOR ALL TO authenticated
  USING (
    customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "product_media_public_read" ON public.product_media;
DROP POLICY IF EXISTS "product_media_write" ON public.product_media;
DROP POLICY IF EXISTS "product_media_tenant" ON public.product_media;
CREATE POLICY "product_media_public_read" ON public.product_media FOR SELECT USING (true);
CREATE POLICY "product_media_write" ON public.product_media FOR ALL TO authenticated
  USING (public.is_super_admin() OR company_id = public.current_user_company_id())
  WITH CHECK (public.is_super_admin() OR company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "payment_transactions_access" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_tenant" ON public.payment_transactions;
CREATE POLICY "payment_transactions_access" ON public.payment_transactions FOR ALL TO authenticated
  USING (
    customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "shop_chat_threads_access" ON public.shop_chat_threads;
DROP POLICY IF EXISTS "shop_chat_threads_tenant" ON public.shop_chat_threads;
CREATE POLICY "shop_chat_threads_access" ON public.shop_chat_threads FOR ALL TO authenticated
  USING (
    customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "shop_chat_messages_access" ON public.shop_chat_messages;
CREATE POLICY "shop_chat_messages_access" ON public.shop_chat_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_chat_threads t WHERE t.id = thread_id
      AND (t.customer_id = auth.uid()
           OR t.company_id = public.current_user_company_id()
           OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS "product_click_events_read" ON public.product_click_events;
DROP POLICY IF EXISTS "product_click_events_tenant" ON public.product_click_events;
CREATE POLICY "product_click_events_read" ON public.product_click_events FOR SELECT TO authenticated
  USING (
    company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "platform_settings_admin" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;

NOTIFY pgrst, 'reload schema';
