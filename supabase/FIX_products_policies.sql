-- Quick unblock if you only need to continue past the products policy error
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;
DROP POLICY IF EXISTS "products_company_write" ON public.products;