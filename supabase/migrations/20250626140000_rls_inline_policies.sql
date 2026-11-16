-- Fix PostgREST 400: replace function-based RLS with inline subqueries (Supabase standard)
-- Safe to re-run. Does not remove RPCs — only policy expressions change.

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_public_active_read" ON public.companies;
DROP POLICY IF EXISTS "companies_staff_read_own" ON public.companies;
DROP POLICY IF EXISTS "companies_super_admin_write" ON public.companies;

CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "companies_super_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_company_staff_read" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR (
      company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_company_read" ON public.products;
DROP POLICY IF EXISTS "products_public_marketplace_read" ON public.products;
DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;

CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR (
      company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('company_admin', 'salesperson')
      )
    )
  );

CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );

CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR (
      company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Helper macro: company-scoped SELECT for tenant tables
-- ---------------------------------------------------------------------------
DO $fix$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'restock_requests', 'branch_inventory', 'warehouse_inventory',
    'branches', 'allocations', 'notifications', 'price_history',
    'transaction_logs', 'activity_log', 'central_inventory',
    'restock_invoices', 'returns'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    -- Skip child tables without company_id (handled via parent join below)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'returns_company_branch', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_select', tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_insert', tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_update', tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_delete', tbl
    );
  END LOOP;
END $fix$;

-- sales: drop old named policies explicitly
DROP POLICY IF EXISTS "sales_company_branch" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_select" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_update" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_delete" ON public.sales;

CREATE POLICY "sales_tenant_select" ON public.sales FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );
CREATE POLICY "sales_tenant_insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );
CREATE POLICY "sales_tenant_update" ON public.sales FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );
CREATE POLICY "sales_tenant_delete" ON public.sales FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );

-- sale_items via parent sale
DROP POLICY IF EXISTS "sale_items_via_sale" ON public.sale_items;
CREATE POLICY "sale_items_tenant_select" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )
  ));
CREATE POLICY "sale_items_tenant_insert" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )
  ));
CREATE POLICY "sale_items_tenant_update" ON public.sale_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));
CREATE POLICY "sale_items_tenant_delete" ON public.sale_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- branch_staff (no company_id column)
DROP POLICY IF EXISTS "branch_staff_company" ON public.branch_staff;
DROP POLICY IF EXISTS "branch_staff_select" ON public.branch_staff;
DROP POLICY IF EXISTS "branch_staff_write" ON public.branch_staff;

CREATE POLICY "branch_staff_select" ON public.branch_staff FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
        AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    )
  );
CREATE POLICY "branch_staff_insert" ON public.branch_staff FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
        AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );
CREATE POLICY "branch_staff_delete" ON public.branch_staff FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
        AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );

-- return_items via parent
DROP POLICY IF EXISTS "return_items_via_return" ON public.return_items;
CREATE POLICY "return_items_tenant_select" ON public.return_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.returns r WHERE r.id = return_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR r.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- allocation_items via parent
DROP POLICY IF EXISTS "allocation_items_via_allocation" ON public.allocation_items;
CREATE POLICY "allocation_items_tenant_select" ON public.allocation_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.allocations a WHERE a.id = allocation_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR a.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- restock_invoice_items via restock_requests
DROP POLICY IF EXISTS "restock_invoice_items_via_request" ON public.restock_invoice_items;
CREATE POLICY "restock_invoice_items_select" ON public.restock_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restock_requests rr WHERE rr.id = restock_request_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR rr.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- Ensure authenticated can use schema + tables (RLS still applies)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Keep helper function grants for RPC callers
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;
