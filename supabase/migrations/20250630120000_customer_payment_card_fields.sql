-- Saved card metadata (last 4 + expiry only — never store full PAN)
ALTER TABLE public.customer_payment_methods
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_exp_month SMALLINT,
  ADD COLUMN IF NOT EXISTS card_exp_year SMALLINT;

COMMENT ON COLUMN public.customer_payment_methods.card_last4 IS 'Last 4 digits of saved card';
COMMENT ON COLUMN public.customer_payment_methods.card_exp_month IS 'Card expiry month 1-12';
COMMENT ON COLUMN public.customer_payment_methods.card_exp_year IS 'Card expiry year (4-digit)';
