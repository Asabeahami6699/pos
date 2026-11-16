-- RLS for product_media so company staff can manage gallery rows

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_media_public_read" ON public.product_media;
CREATE POLICY "product_media_public_read"
  ON public.product_media FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "product_media_company_insert" ON public.product_media;
CREATE POLICY "product_media_company_insert"
  ON public.product_media FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "product_media_company_update" ON public.product_media;
CREATE POLICY "product_media_company_update"
  ON public.product_media FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "product_media_company_delete" ON public.product_media;
CREATE POLICY "product_media_company_delete"
  ON public.product_media FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );
