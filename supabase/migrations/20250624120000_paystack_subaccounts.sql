-- Paystack subaccount / vendor payout fields per company

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subaccount_status TEXT NOT NULL DEFAULT 'none'
    CHECK (paystack_subaccount_status IN ('none', 'pending', 'active', 'error')),
  ADD COLUMN IF NOT EXISTS payout_settlement_bank TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_number TEXT,
  ADD COLUMN IF NOT EXISTS payout_account_name TEXT,
  ADD COLUMN IF NOT EXISTS payout_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS payout_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5, 2);

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_amount NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_companies_paystack_subaccount
  ON public.companies(paystack_subaccount_code)
  WHERE paystack_subaccount_code IS NOT NULL;
