-- Fix 400 errors: authenticated role must EXECUTE RLS helper functions used in policies

GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_staff() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.company_subscription_active(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rls_company_match(UUID) TO authenticated, anon, service_role;

-- products_company_write was FOR ALL and blocked SELECT when subscription inactive
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
