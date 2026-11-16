-- Product long-form description for marketplace detail pages
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT;
