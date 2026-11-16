-- Nuclear policy cleanup: drop ALL public RLS policies and apply minimal inline policies
-- Fixes 400 errors from broken/duplicate function-based policies

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- companies
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "companies_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

-- users (subqueries only read auth.uid() row — no recursion)
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- products
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "products_modify" ON public.products
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );

-- Macro for tables with company_id column
DO $pol$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'branches', 'branch_inventory', 'warehouse_inventory', 'central_inventory',
    'sales', 'restock_requests', 'allocations', 'notifications', 'price_history',
    'transaction_logs', 'activity_log', 'returns', 'restock_invoices',
    'subscriptions', 'invoices'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
    ) THEN CONTINUE; END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (
         EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
         OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
       )
       WITH CHECK (
         EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
         OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
       )',
      tbl || '_tenant', tbl
    );
  END LOOP;
END $pol$;

-- salaries / payrolls (user_id only, no company_id)
DO $pol$ BEGIN
  IF to_regclass('public.salaries') IS NOT NULL THEN
    CREATE POLICY "salaries_tenant" ON public.salaries FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = salaries.user_id
            AND u.company_id = (SELECT c.company_id FROM public.users c WHERE c.id = auth.uid())
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'company_admin'))
      );
  END IF;
  IF to_regclass('public.payrolls') IS NOT NULL THEN
    CREATE POLICY "payrolls_tenant" ON public.payrolls FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = payrolls.user_id
            AND u.company_id = (SELECT c.company_id FROM public.users c WHERE c.id = auth.uid())
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'company_admin'))
      );
  END IF;
  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    CREATE POLICY "invoice_items_tenant" ON public.invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR i.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.subscription_features') IS NOT NULL THEN
    CREATE POLICY "subscription_features_read" ON public.subscription_features
      FOR SELECT TO authenticated USING (true);
    CREATE POLICY "subscription_features_admin" ON public.subscription_features
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $pol$;

-- sale_items
DO $pol$ BEGIN
  IF to_regclass('public.sale_items') IS NOT NULL THEN
    CREATE POLICY "sale_items_tenant" ON public.sale_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
END $pol$;

-- branch_staff
DO $pol$ BEGIN
  IF to_regclass('public.branch_staff') IS NOT NULL THEN
    CREATE POLICY "branch_staff_tenant" ON public.branch_staff FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = branch_id
            AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = branch_id
            AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        )
      );
  END IF;
END $pol$;

-- return_items, allocation_items, restock_invoice_items
DO $pol$ BEGIN
  IF to_regclass('public.return_items') IS NOT NULL THEN
    CREATE POLICY "return_items_tenant" ON public.return_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.returns r WHERE r.id = return_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR r.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.allocation_items') IS NOT NULL THEN
    CREATE POLICY "allocation_items_tenant" ON public.allocation_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.allocations a WHERE a.id = allocation_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR a.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.restock_invoice_items') IS NOT NULL THEN
    CREATE POLICY "restock_invoice_items_tenant" ON public.restock_invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.restock_requests rr WHERE rr.id = restock_request_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR rr.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
END $pol$;

-- e-commerce / customer tables
DO $pol$ BEGIN
  IF to_regclass('public.online_orders') IS NOT NULL THEN
    CREATE POLICY "online_orders_access" ON public.online_orders FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      );
  END IF;
  IF to_regclass('public.online_order_items') IS NOT NULL THEN
    CREATE POLICY "online_order_items_access" ON public.online_order_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.online_orders o WHERE o.id = order_id
          AND (o.customer_id = auth.uid()
               OR o.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
               OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      ));
  END IF;
  IF to_regclass('public.customer_addresses') IS NOT NULL THEN
    CREATE POLICY "customer_addresses_own" ON public.customer_addresses FOR ALL TO authenticated
      USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
  END IF;
  IF to_regclass('public.customer_payment_methods') IS NOT NULL THEN
    CREATE POLICY "customer_payment_methods_own" ON public.customer_payment_methods FOR ALL TO authenticated
      USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
  END IF;
  IF to_regclass('public.product_ratings') IS NOT NULL THEN
    CREATE POLICY "product_ratings_access" ON public.product_ratings FOR ALL TO authenticated
      USING (
        customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.product_media') IS NOT NULL THEN
    CREATE POLICY "product_media_public_read" ON public.product_media FOR SELECT USING (true);
    CREATE POLICY "product_media_write" ON public.product_media FOR ALL TO authenticated
      USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      WITH CHECK (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()));
  END IF;
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    CREATE POLICY "payment_transactions_access" ON public.payment_transactions FOR ALL TO authenticated
      USING (
        customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.shop_chat_threads') IS NOT NULL THEN
    CREATE POLICY "shop_chat_threads_access" ON public.shop_chat_threads FOR ALL TO authenticated
      USING (
        customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.shop_chat_messages') IS NOT NULL THEN
    CREATE POLICY "shop_chat_messages_access" ON public.shop_chat_messages FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.shop_chat_threads t WHERE t.id = thread_id
          AND (t.customer_id = auth.uid()
               OR t.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.product_click_events') IS NOT NULL THEN
    CREATE POLICY "product_click_events_read" ON public.product_click_events FOR SELECT TO authenticated
      USING (
        company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    CREATE POLICY "inventory_reservations_tenant" ON public.inventory_reservations FOR ALL TO authenticated
      USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()));
  END IF;
  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    CREATE POLICY "platform_settings_read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY "platform_settings_admin" ON public.platform_settings FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $pol$;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';
