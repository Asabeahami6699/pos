-- Optional rich marketplace listing data for online products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_online_listing BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS marketplace_listing JSONB;

COMMENT ON COLUMN public.products.marketplace_listing IS
  'Optional online listing: variations, size_guide, key_highlights, specifications, key_features, weight_kg, product_details';
