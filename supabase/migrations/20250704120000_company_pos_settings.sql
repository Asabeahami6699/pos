-- Company POS pricing + support contact (admin-configurable)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 16
    CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
  ADD COLUMN IF NOT EXISTS pos_discounts_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pos_max_discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 100
    CHECK (pos_max_discount_percent >= 0 AND pos_max_discount_percent <= 100),
  ADD COLUMN IF NOT EXISTS pos_quick_discounts JSONB NOT NULL DEFAULT '[5, 10, 15]'::jsonb,
  ADD COLUMN IF NOT EXISTS support_phone TEXT,
  ADD COLUMN IF NOT EXISTS support_email TEXT;

COMMENT ON COLUMN public.companies.tax_rate_percent IS 'POS sales tax percent applied after discounts';
COMMENT ON COLUMN public.companies.pos_discounts_enabled IS 'Whether cashiers can apply cart/item discounts';
COMMENT ON COLUMN public.companies.pos_max_discount_percent IS 'Max cart discount percent cashiers may enter';
COMMENT ON COLUMN public.companies.pos_quick_discounts IS 'Quick item discount percent chips shown in POS cart';
COMMENT ON COLUMN public.companies.support_phone IS 'Support hotline shown to sales staff';
COMMENT ON COLUMN public.companies.support_email IS 'Support email shown to sales staff';
