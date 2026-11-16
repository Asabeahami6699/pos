-- Run once in Supabase SQL editor if migration not applied yet.
-- Company POS tax / discount / support line settings

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 16,
  ADD COLUMN IF NOT EXISTS pos_discounts_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pos_max_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pos_quick_discounts JSONB NOT NULL DEFAULT '[5, 10, 15]'::jsonb,
  ADD COLUMN IF NOT EXISTS support_phone TEXT,
  ADD COLUMN IF NOT EXISTS support_email TEXT;

-- Safe defaults for existing rows
UPDATE public.companies
SET
  tax_rate_percent = COALESCE(tax_rate_percent, 16),
  pos_discounts_enabled = COALESCE(pos_discounts_enabled, true),
  pos_max_discount_percent = COALESCE(pos_max_discount_percent, 100),
  pos_quick_discounts = COALESCE(pos_quick_discounts, '[5, 10, 15]'::jsonb)
WHERE true;
