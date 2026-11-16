-- Paystack payment transactions + click-based promotions

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL UNIQUE,
  paystack_reference TEXT NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL,
  amount_kobo INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
  payment_method TEXT NOT NULL DEFAULT 'paystack',
  order_id UUID REFERENCES public.online_orders(id) ON DELETE SET NULL,
  checkout_payload JSONB NOT NULL,
  paystack_response JSONB,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer ON public.payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company ON public.payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON public.payment_transactions(status);

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID REFERENCES public.payment_transactions(id);

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Customer product clicks for personalized promotions
CREATE TABLE IF NOT EXISTS public.product_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_clicks_customer ON public.product_click_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_clicks_session ON public.product_click_events(session_id);
CREATE INDEX IF NOT EXISTS idx_product_clicks_category ON public.product_click_events(category);
