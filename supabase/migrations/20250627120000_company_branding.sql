-- Company store branding for marketplace

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

COMMENT ON COLUMN public.companies.logo_url IS 'Square store logo shown on marketplace listings';
COMMENT ON COLUMN public.companies.banner_url IS 'Wide banner shown on the store page';
