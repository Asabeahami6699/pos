-- Marketplace feature tables: wishlist, promos, tracking, returns, loyalty, guest orders

ALTER TABLE public.online_orders
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT,
  ADD COLUMN IF NOT EXISTS guest_order_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code TEXT,
  ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS carrier_name TEXT;

CREATE INDEX IF NOT EXISTS idx_online_orders_guest_token ON public.online_orders(guest_order_token);

CREATE TABLE IF NOT EXISTS public.customer_wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (code, company_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_platform_code_uidx
  ON public.promo_codes (code) WHERE company_id IS NULL;

CREATE TABLE IF NOT EXISTS public.order_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON public.order_tracking_events(order_id, created_at);

CREATE TABLE IF NOT EXISTS public.return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'refunded', 'cancelled')),
  items JSONB NOT NULL DEFAULT '[]',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seller_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, customer_id)
);

CREATE TABLE IF NOT EXISTS public.abandoned_cart_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT,
  email TEXT,
  cart_json JSONB NOT NULL DEFAULT '[]',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  reminder_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_abandoned_cart_customer ON public.abandoned_cart_snapshots(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS abandoned_cart_customer_uidx
  ON public.abandoned_cart_snapshots(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_abandoned_cart_session ON public.abandoned_cart_snapshots(session_id);

CREATE TABLE IF NOT EXISTS public.customer_loyalty_points (
  customer_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  lifetime_points INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_views_session ON public.product_view_events(session_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_views_customer ON public.product_view_events(customer_id, viewed_at DESC);

-- Platform-wide welcome promo (10% off, min ₵50)
INSERT INTO public.promo_codes (company_id, code, description, discount_type, discount_value, min_order_amount, max_uses, active)
SELECT NULL, 'WELCOME10', '10% off your first order', 'percent', 10, 50, 10000, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.promo_codes WHERE code = 'WELCOME10' AND company_id IS NULL
);

DROP FUNCTION IF EXISTS public.fulfill_online_order(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, NUMERIC, UUID, TEXT
);

DROP FUNCTION IF EXISTS public.fulfill_online_order(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, NUMERIC, UUID, TEXT,
  TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, DATE
);
CREATE OR REPLACE FUNCTION public.fulfill_online_order(
  p_customer_id UUID,
  p_company_id UUID,
  p_total NUMERIC,
  p_shipping_name TEXT,
  p_shipping_phone TEXT,
  p_shipping_address TEXT,
  p_fulfillment_type TEXT,
  p_payment_method TEXT,
  p_payment_status TEXT,
  p_items JSONB,
  p_paystack_reference TEXT DEFAULT NULL,
  p_payment_transaction_id UUID DEFAULT NULL,
  p_platform_fee NUMERIC DEFAULT 0,
  p_address_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_order_token TEXT DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT 0,
  p_discount_amount NUMERIC DEFAULT 0,
  p_promo_code TEXT DEFAULT NULL,
  p_estimated_delivery_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_unit_price NUMERIC;
  v_product_name TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    PERFORM public.deduct_sellable_stock(p_company_id, v_product_id, v_qty);
  END LOOP;

  INSERT INTO public.online_orders (
    company_id, customer_id, total, shipping_name, shipping_phone,
    shipping_address, fulfillment_type, payment_method, payment_status,
    momo_reference, address_id, notes, status, payment_transaction_id, platform_fee,
    guest_email, guest_phone, guest_order_token,
    shipping_fee, discount_amount, promo_code, estimated_delivery_date
  ) VALUES (
    p_company_id, p_customer_id, p_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_fulfillment_type, p_payment_method, p_payment_status,
    p_paystack_reference, p_address_id, p_notes, 'pending', p_payment_transaction_id, p_platform_fee,
    p_guest_email, p_guest_phone, p_guest_order_token,
    COALESCE(p_shipping_fee, 0), COALESCE(p_discount_amount, 0), p_promo_code, p_estimated_delivery_date
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC;
    v_product_name := v_item->>'product_name';

    INSERT INTO public.online_order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price
    ) VALUES (
      v_order_id, v_product_id, v_product_name, v_qty, v_unit_price, v_unit_price * v_qty
    );
  END LOOP;

  INSERT INTO public.order_tracking_events (order_id, status, message)
  VALUES (v_order_id, 'pending', 'Order placed');

  IF p_payment_transaction_id IS NOT NULL THEN
    DELETE FROM public.inventory_reservations
    WHERE payment_transaction_id = p_payment_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$$;

-- RLS (service role used by API; basic customer policies)
ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_wishlists_own ON public.customer_wishlists;
CREATE POLICY customer_wishlists_own ON public.customer_wishlists
  FOR ALL TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS seller_ratings_read ON public.seller_ratings;
CREATE POLICY seller_ratings_read ON public.seller_ratings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS seller_ratings_write ON public.seller_ratings;
CREATE POLICY seller_ratings_write ON public.seller_ratings
  FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS return_requests_customer ON public.return_requests;
CREATE POLICY return_requests_customer ON public.return_requests
  FOR ALL TO authenticated USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS order_tracking_read ON public.order_tracking_events;
CREATE POLICY order_tracking_read ON public.order_tracking_events
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.online_orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
