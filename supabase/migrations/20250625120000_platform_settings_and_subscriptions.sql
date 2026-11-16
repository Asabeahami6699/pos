-- Platform-wide settings (super admin managed)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id, platform_fee_percent)
VALUES (1, 5)
ON CONFLICT (id) DO NOTHING;

-- Company subscription / plan dates
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_renewal_at TIMESTAMPTZ;

UPDATE public.companies
SET plan_started_at = COALESCE(plan_started_at, created_at),
    plan_renewal_at = COALESCE(plan_renewal_at, created_at + INTERVAL '30 days')
WHERE plan_started_at IS NULL OR plan_renewal_at IS NULL;

ALTER TABLE public.companies
  ALTER COLUMN plan_started_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_companies_plan_renewal
  ON public.companies(plan_renewal_at);
