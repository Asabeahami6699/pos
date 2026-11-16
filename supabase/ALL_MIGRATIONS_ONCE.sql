-- =============================================================================
-- POS Inventory — combined one-shot migration for a fresh Supabase project
-- Generated: 2026-11-14 23:29:56
-- Source files: 23 migrations
-- Safe to re-run on a partially applied DB
-- =============================================================================


-- ---------------------------------------------------------------------------
-- FILE: 20250619000000_initial_schema.sql
-- ---------------------------------------------------------------------------

-- POS Inventory initial schema (version-controlled baseline)
-- Apply with: supabase db push  OR  supabase migration up

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'company_admin', 'salesperson')),
  full_name TEXT,
  email TEXT,
  sales_type TEXT CHECK (sales_type IN ('retail', 'wholesale', 'both')),
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sales_type TEXT NOT NULL DEFAULT 'retail' CHECK (sales_type IN ('retail', 'wholesale', 'both')),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branch_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  wholesale_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  low_stock_threshold INTEGER DEFAULT 5,
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branch_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  retail_quantity INTEGER,
  wholesale_quantity INTEGER,
  low_stock BOOLEAN DEFAULT false,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (branch_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.central_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  total NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2),
  discount_amount NUMERIC(12,2),
  tax_amount NUMERIC(12,2),
  payment_method TEXT NOT NULL,
  payment_received NUMERIC(12,2),
  change_given NUMERIC(12,2),
  payment_notes TEXT,
  sales_type TEXT NOT NULL CHECK (sales_type IN ('retail', 'wholesale')),
  customer_name TEXT,
  customer_phone TEXT,
  customer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  original_price NUMERIC(12,2),
  wholesale_price NUMERIC(12,2),
  sales_type TEXT NOT NULL CHECK (sales_type IN ('retail', 'wholesale')),
  discount_amount NUMERIC(12,2),
  total_price NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  salesperson_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  total_refund NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sales_type TEXT DEFAULT 'retail',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL,
  restocked BOOLEAN DEFAULT false,
  restocked_at TIMESTAMPTZ,
  sales_type TEXT
);

CREATE TABLE IF NOT EXISTS public.restock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  requested_quantity INTEGER NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT,
  delivery_date TIMESTAMPTZ,
  delivered_by UUID REFERENCES public.users(id),
  invoice_number TEXT,
  fulfilled_at TIMESTAMPTZ,
  fulfilled_quantity INTEGER,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  items JSONB,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.restock_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  restock_request_id UUID NOT NULL REFERENCES public.restock_requests(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  total_items INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  delivered_by UUID NOT NULL REFERENCES public.users(id),
  delivery_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.restock_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restock_request_id UUID NOT NULL REFERENCES public.restock_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_requested INTEGER NOT NULL,
  quantity_delivered INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total_price NUMERIC(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  allocated_by UUID NOT NULL REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.allocation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  old_price NUMERIC(12,2) NOT NULL,
  new_price NUMERIC(12,2) NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transaction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_sales INTEGER DEFAULT 0,
  total_revenue NUMERIC(12,2) DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  threshold INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_company ON public.users(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch ON public.sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_branch ON public.branch_inventory(branch_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "products_company_read" ON public.products
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));


-- ---------------------------------------------------------------------------
-- FILE: 20250619120000_online_orders.sql
-- ---------------------------------------------------------------------------

-- Online orders for customer e-commerce (run on Supabase when ready)

-- Allow customer accounts for marketplace shoppers
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'company_admin', 'salesperson', 'customer'));

CREATE TABLE IF NOT EXISTS public.online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  total NUMERIC(12, 2) NOT NULL,
  shipping_name TEXT,
  shipping_phone TEXT,
  shipping_address TEXT,
  payment_method TEXT NOT NULL DEFAULT 'pay_on_delivery',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.online_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_online_orders_company ON public.online_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer ON public.online_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_online_order_items_order ON public.online_order_items(order_id);

-- Optional: allow anon read of active companies/products via RLS policies (adjust as needed)
-- ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read active companies" ON public.companies FOR SELECT USING (status = 'active');


-- ---------------------------------------------------------------------------
-- FILE: 20250620120000_product_ratings.sql
-- ---------------------------------------------------------------------------

-- Customer product ratings for marketplace

CREATE TABLE IF NOT EXISTS public.product_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_product_ratings_product ON public.product_ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_company ON public.product_ratings(company_id);


-- ---------------------------------------------------------------------------
-- FILE: 20250620140000_product_images.sql
-- ---------------------------------------------------------------------------

-- Product images for marketplace display

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Supabase Storage bucket for product photos (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated users can upload to their company folder
DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
CREATE POLICY "Authenticated update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;
CREATE POLICY "Authenticated delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');


-- ---------------------------------------------------------------------------
-- FILE: 20250621120000_ecommerce_enhancements.sql
-- ---------------------------------------------------------------------------

-- E-commerce enhancements: media, customer profile, chat, order fulfillment

-- Multiple product images/videos
CREATE TABLE IF NOT EXISTS public.product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id);

-- Customer saved addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT,
  phone TEXT,
  address_line TEXT NOT NULL,
  city TEXT,
  region TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON public.customer_addresses(customer_id);

-- Customer saved payment methods (MoMo etc.)
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mobile_money', 'card', 'pay_on_delivery')),
  provider TEXT,
  phone_number TEXT,
  label TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer ON public.customer_payment_methods(customer_id);

-- Live chat between customers and store admins
CREATE TABLE IF NOT EXISTS public.shop_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (customer_id, company_id)
);

CREATE TABLE IF NOT EXISTS public.shop_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.shop_chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_chat_messages_thread ON public.shop_chat_messages(thread_id);

-- Order fulfillment & payment fields
ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'delivery';

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS momo_phone TEXT;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS momo_provider TEXT;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS momo_reference TEXT;

ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS address_id UUID REFERENCES public.customer_addresses(id);

-- Extend status flow (ready = packed for pickup/dispatch)
ALTER TABLE public.online_orders DROP CONSTRAINT IF EXISTS online_orders_status_check;
ALTER TABLE public.online_orders ADD CONSTRAINT online_orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'shipped', 'delivered', 'cancelled'));

-- Allow videos in product-images bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime'
]
WHERE id = 'product-images';


-- ---------------------------------------------------------------------------
-- FILE: 20250622120000_paystack_payments.sql
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- FILE: 20250623120000_product_media_rls.sql
-- ---------------------------------------------------------------------------

-- RLS for product_media so company staff can manage gallery rows

ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_media_public_read" ON public.product_media;
CREATE POLICY "product_media_public_read"
  ON public.product_media FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "product_media_company_insert" ON public.product_media;
CREATE POLICY "product_media_company_insert"
  ON public.product_media FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "product_media_company_update" ON public.product_media;
CREATE POLICY "product_media_company_update"
  ON public.product_media FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "product_media_company_delete" ON public.product_media;
CREATE POLICY "product_media_company_delete"
  ON public.product_media FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
  );


-- ---------------------------------------------------------------------------
-- FILE: 20250623140000_chat_realtime.sql
-- ---------------------------------------------------------------------------

-- Enable realtime for live customer ↔ store chat

ALTER TABLE public.shop_chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.shop_chat_threads REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_chat_threads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- FILE: 20250624120000_paystack_subaccounts.sql
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- FILE: 20250625120000_platform_settings_and_subscriptions.sql
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- FILE: 20250625140000_platform_support_contact.sql
-- ---------------------------------------------------------------------------

-- Platform support contact for subscription renewal / lock screens

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS support_email TEXT,
  ADD COLUMN IF NOT EXISTS support_phone TEXT;


-- ---------------------------------------------------------------------------
-- FILE: 20250626120000_production_hardening.sql
-- ---------------------------------------------------------------------------

-- Production hardening (aligned to live Supabase schema)
-- Safe to re-run: idempotent DDL, DROP-before-create for functions/policies

-- ---------------------------------------------------------------------------
-- Minimal schema additions (only what live DB lacks)
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Warehouse columns used by admin UI + sellable_inventory (missing from initial schema)
ALTER TABLE public.warehouse_inventory
  ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS batch_lot_number TEXT,
  ADD COLUMN IF NOT EXISTS date_received DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT DEFAULT 'Main Warehouse',
  ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost_per_box NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS boxes_received INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_stock BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_inventory_company_product_uidx
  ON public.warehouse_inventory (company_id, product_id);

CREATE INDEX IF NOT EXISTS idx_products_sku_company ON public.products(company_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode_company ON public.products(company_id, barcode);

CREATE OR REPLACE VIEW public.sellable_inventory AS
SELECT
  wi.company_id,
  wi.product_id,
  p.name AS product_name,
  p.sku,
  p.barcode,
  wi.quantity AS sellable_quantity,
  wi.min_stock_level,
  (wi.quantity <= COALESCE(wi.min_stock_level, p.low_stock_threshold, 5)) AS low_stock
FROM public.warehouse_inventory wi
JOIN public.products p ON p.id = wi.product_id;

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product
  ON public.inventory_reservations(company_id, product_id, expires_at);

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.rls_company_match(UUID);
DROP FUNCTION IF EXISTS public.company_subscription_active(UUID);
DROP FUNCTION IF EXISTS public.user_has_branch_access(UUID);
DROP FUNCTION IF EXISTS public.is_company_admin();
DROP FUNCTION IF EXISTS public.is_company_staff();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_user_company_id();

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('company_admin', 'salesperson')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'company_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_super_admin()
    OR public.is_company_admin()
    OR EXISTS (
      SELECT 1 FROM public.branch_staff bs
      WHERE bs.user_id = auth.uid() AND bs.branch_id = p_branch_id
    )
$$;

CREATE OR REPLACE FUNCTION public.company_subscription_active(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND c.status NOT IN ('suspended', 'expired')
      AND (c.plan_renewal_at IS NULL OR c.plan_renewal_at >= now())
  )
$$;

CREATE OR REPLACE FUNCTION public.rls_company_match(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR p_company_id = public.current_user_company_id()
$$;

-- ---------------------------------------------------------------------------
-- Atomic inventory / order RPCs (live column names: updated_at, not last_updated)
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_warehouse_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_warehouse_inventory(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_branch_inventory(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.update_branch_inventory(UUID, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_available_warehouse_qty(UUID, UUID);
DROP FUNCTION IF EXISTS public.reserve_checkout_stock(UUID, JSONB, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.release_checkout_reservations(UUID);
DROP FUNCTION IF EXISTS public.fulfill_online_order(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, NUMERIC, UUID, TEXT
);
DROP FUNCTION IF EXISTS public.complete_payment_and_fulfill(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS public.process_pos_return(UUID, UUID, UUID, UUID, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.update_warehouse_inventory(
  p_product_id UUID,
  p_company_id UUID,
  p_quantity_change INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_qty INTEGER;
BEGIN
  IF p_quantity_change < 0 THEN
    UPDATE public.warehouse_inventory
    SET quantity = quantity + p_quantity_change,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND quantity + p_quantity_change >= 0
    RETURNING quantity INTO v_new_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient warehouse stock for product %', p_product_id;
    END IF;
  ELSE
    INSERT INTO public.warehouse_inventory (company_id, product_id, quantity, updated_at, last_restocked_at)
    VALUES (p_company_id, p_product_id, p_quantity_change, now(), now())
    ON CONFLICT (company_id, product_id) DO UPDATE
    SET quantity = public.warehouse_inventory.quantity + EXCLUDED.quantity,
        updated_at = now(),
        last_restocked_at = now()
    RETURNING quantity INTO v_new_qty;
  END IF;

  RETURN v_new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_branch_inventory(
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity_change INTEGER,
  p_retail_change INTEGER DEFAULT 0,
  p_wholesale_change INTEGER DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id UUID;
  v_new_qty INTEGER;
BEGIN
  SELECT company_id INTO v_company_id FROM public.branches WHERE id = p_branch_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Branch not found';
  END IF;

  IF p_quantity_change < 0 THEN
    UPDATE public.branch_inventory
    SET quantity = quantity + p_quantity_change,
        retail_quantity = GREATEST(0, COALESCE(retail_quantity, 0) + p_retail_change),
        wholesale_quantity = GREATEST(0, COALESCE(wholesale_quantity, 0) + p_wholesale_change),
        updated_at = now()
    WHERE branch_id = p_branch_id
      AND product_id = p_product_id
      AND quantity + p_quantity_change >= 0
    RETURNING quantity INTO v_new_qty;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient branch stock for product %', p_product_id;
    END IF;
  ELSE
    INSERT INTO public.branch_inventory (
      company_id, branch_id, product_id, quantity,
      retail_quantity, wholesale_quantity, updated_at
    )
    VALUES (
      v_company_id, p_branch_id, p_product_id, p_quantity_change,
      GREATEST(0, p_retail_change), GREATEST(0, p_wholesale_change), now()
    )
    ON CONFLICT (branch_id, product_id) DO UPDATE
    SET quantity = public.branch_inventory.quantity + EXCLUDED.quantity,
        retail_quantity = GREATEST(0, COALESCE(public.branch_inventory.retail_quantity, 0) + p_retail_change),
        wholesale_quantity = GREATEST(0, COALESCE(public.branch_inventory.wholesale_quantity, 0) + p_wholesale_change),
        updated_at = now()
    RETURNING quantity INTO v_new_qty;
  END IF;

  RETURN v_new_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_warehouse_stock(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id FROM public.products WHERE id = p_product_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  RETURN public.update_warehouse_inventory(p_product_id, v_company_id, p_quantity);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_warehouse_qty(
  p_company_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(wi.quantity, 0) - COALESCE((
    SELECT SUM(r.quantity)::INTEGER
    FROM public.inventory_reservations r
    WHERE r.company_id = p_company_id
      AND r.product_id = p_product_id
      AND r.expires_at > now()
  ), 0)
  FROM public.warehouse_inventory wi
  WHERE wi.company_id = p_company_id AND wi.product_id = p_product_id
$$;

CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(
  p_company_id UUID,
  p_items JSONB,
  p_payment_transaction_id UUID,
  p_ttl_minutes INTEGER DEFAULT 15
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_available INTEGER;
BEGIN
  DELETE FROM public.inventory_reservations
  WHERE payment_transaction_id = p_payment_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    v_available := public.get_available_warehouse_qty(p_company_id, v_product_id);
    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    INSERT INTO public.inventory_reservations (
      company_id, product_id, quantity, payment_transaction_id, expires_at
    ) VALUES (
      p_company_id, v_product_id, v_qty, p_payment_transaction_id,
      now() + (p_ttl_minutes || ' minutes')::INTERVAL
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_checkout_reservations(p_payment_transaction_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.inventory_reservations
  WHERE payment_transaction_id = p_payment_transaction_id
$$;

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
  p_notes TEXT DEFAULT NULL
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
  v_rows INTEGER;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    UPDATE public.warehouse_inventory
    SET quantity = quantity - v_qty,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = v_product_id
      AND quantity >= v_qty;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;
  END LOOP;

  INSERT INTO public.online_orders (
    company_id, customer_id, total, shipping_name, shipping_phone,
    shipping_address, fulfillment_type, payment_method, payment_status,
    momo_reference, address_id, notes, status, payment_transaction_id, platform_fee
  ) VALUES (
    p_company_id, p_customer_id, p_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_fulfillment_type, p_payment_method, p_payment_status,
    p_paystack_reference, p_address_id, p_notes, 'pending', p_payment_transaction_id, p_platform_fee
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

  IF p_payment_transaction_id IS NOT NULL THEN
    DELETE FROM public.inventory_reservations
    WHERE payment_transaction_id = p_payment_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_payment_and_fulfill(
  p_transaction_id UUID,
  p_customer_id UUID,
  p_paystack_response JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx RECORD;
  v_payload JSONB;
  v_order_id UUID;
  v_shipping_address TEXT;
BEGIN
  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF v_tx.customer_id != p_customer_id THEN
    RAISE EXCEPTION 'Unauthorized payment reference';
  END IF;

  IF v_tx.status = 'success' AND v_tx.order_id IS NOT NULL THEN
    RETURN v_tx.order_id;
  END IF;

  v_payload := v_tx.checkout_payload;

  v_shipping_address := CASE
    WHEN (v_payload->>'fulfillment_type') = 'pickup' THEN 'Store pickup'
    ELSE COALESCE(v_payload->>'shipping_address', '')
  END;

  v_order_id := public.fulfill_online_order(
    p_customer_id := p_customer_id,
    p_company_id := (v_payload->>'company_id')::UUID,
    p_total := v_tx.amount,
    p_shipping_name := v_payload->>'shipping_name',
    p_shipping_phone := v_payload->>'shipping_phone',
    p_shipping_address := v_shipping_address,
    p_fulfillment_type := COALESCE(v_payload->>'fulfillment_type', 'delivery'),
    p_payment_method := 'paystack',
    p_payment_status := 'paid',
    p_items := v_payload->'items',
    p_paystack_reference := v_tx.paystack_reference,
    p_payment_transaction_id := p_transaction_id,
    p_platform_fee := COALESCE(v_tx.platform_fee, 0),
    p_address_id := NULLIF(v_payload->>'address_id', '')::UUID,
    p_notes := v_payload->>'notes'
  );

  UPDATE public.payment_transactions
  SET status = 'success',
      order_id = v_order_id,
      paystack_response = p_paystack_response,
      verified_at = now(),
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_pos_return(
  p_sale_id UUID,
  p_branch_id UUID,
  p_company_id UUID,
  p_salesperson_id UUID,
  p_reason TEXT,
  p_items JSONB,
  p_sales_type TEXT DEFAULT 'retail'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_return_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_price NUMERIC;
  v_total_refund NUMERIC := 0;
  v_ts TIMESTAMPTZ := now();
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_total_refund := v_total_refund
      + ((v_item->>'price')::NUMERIC * (v_item->>'quantity')::INTEGER);
  END LOOP;

  INSERT INTO public.returns (
    sale_id, company_id, branch_id, salesperson_id,
    total_refund, reason, status, sales_type,
    resolved_by, resolved_at, created_at
  ) VALUES (
    p_sale_id, p_company_id, p_branch_id, p_salesperson_id,
    v_total_refund, p_reason, 'completed', p_sales_type,
    p_salesperson_id, v_ts, v_ts
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;
    v_price := (v_item->>'price')::NUMERIC;

    INSERT INTO public.return_items (
      return_id, product_id, quantity, price, refund_amount,
      restocked, restocked_at, sales_type
    ) VALUES (
      v_return_id, v_product_id, v_qty, v_price, v_price * v_qty,
      true, v_ts, p_sales_type
    );

    PERFORM public.update_branch_inventory(
      p_branch_id, v_product_id, v_qty,
      CASE WHEN p_sales_type = 'retail' THEN v_qty ELSE 0 END,
      CASE WHEN p_sales_type = 'wholesale' THEN v_qty ELSE 0 END
    );
  END LOOP;

  INSERT INTO public.transaction_logs (
    company_id, branch_id, user_id,
    action_type, reference_id, amount, details
  ) VALUES (
    p_company_id, p_branch_id, p_salesperson_id,
    'return', v_return_id, v_total_refund,
    jsonb_build_object('reason', p_reason, 'sale_id', p_sale_id)
  );

  RETURN v_return_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (tables present in live DB)
-- ---------------------------------------------------------------------------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $rls$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'subscriptions', 'subscription_features',
    'branches', 'branch_staff', 'branch_inventory', 'warehouse_inventory',
    'central_inventory', 'sales', 'sale_items', 'returns', 'return_items',
    'restock_requests', 'restock_invoices', 'restock_invoice_items',
    'invoices', 'invoice_items',
    'salaries', 'payrolls',
    'allocations', 'allocation_items', 'notifications', 'price_history',
    'transaction_logs', 'activity_log',
    'online_orders', 'online_order_items', 'product_ratings', 'product_media',
    'customer_addresses', 'customer_payment_methods',
    'shop_chat_threads', 'shop_chat_messages', 'payment_transactions',
    'product_click_events', 'inventory_reservations', 'platform_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $rls$;

-- Companies
DROP POLICY IF EXISTS "companies_public_active_read" ON public.companies;
CREATE POLICY "companies_public_active_read" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (status = 'active' OR public.is_super_admin());

DROP POLICY IF EXISTS "companies_staff_read_own" ON public.companies;
CREATE POLICY "companies_staff_read_own" ON public.companies
  FOR SELECT TO authenticated
  USING (id = public.current_user_company_id() OR public.is_super_admin());

DROP POLICY IF EXISTS "companies_super_admin_write" ON public.companies;
CREATE POLICY "companies_super_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Users
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_company_staff_read" ON public.users;
CREATE POLICY "users_company_staff_read" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_admin())
  );

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Products
DROP POLICY IF EXISTS "products_company_read" ON public.products;
DROP POLICY IF EXISTS "products_public_marketplace_read" ON public.products;
CREATE POLICY "products_public_marketplace_read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT id FROM public.companies WHERE status = 'active')
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;
CREATE POLICY "products_company_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  );

CREATE POLICY "products_company_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  );

CREATE POLICY "products_company_delete" ON public.products
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_admin()
        AND public.company_subscription_active(company_id))
  );

-- Core tenant tables
DO $pol$ BEGIN
  IF to_regclass('public.branches') IS NOT NULL THEN
    DROP POLICY IF EXISTS "branches_company" ON public.branches;
    CREATE POLICY "branches_company" ON public.branches FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.branch_staff') IS NOT NULL THEN
    DROP POLICY IF EXISTS "branch_staff_company" ON public.branch_staff;
    CREATE POLICY "branch_staff_company" ON public.branch_staff FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_id AND public.rls_company_match(b.company_id)
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.branches b
        WHERE b.id = branch_id AND public.rls_company_match(b.company_id)
      ));
  END IF;

  IF to_regclass('public.branch_inventory') IS NOT NULL THEN
    DROP POLICY IF EXISTS "branch_inventory_company" ON public.branch_inventory;
    CREATE POLICY "branch_inventory_company" ON public.branch_inventory FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.warehouse_inventory') IS NOT NULL THEN
    DROP POLICY IF EXISTS "warehouse_inventory_company" ON public.warehouse_inventory;
    CREATE POLICY "warehouse_inventory_company" ON public.warehouse_inventory FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.central_inventory') IS NOT NULL THEN
    DROP POLICY IF EXISTS "central_inventory_company" ON public.central_inventory;
    CREATE POLICY "central_inventory_company" ON public.central_inventory FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.sales') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sales_company_branch" ON public.sales;
    CREATE POLICY "sales_company_branch" ON public.sales FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND (public.is_company_admin() OR public.user_has_branch_access(branch_id)))
      )
      WITH CHECK (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND public.company_subscription_active(company_id)
            AND (public.is_company_admin() OR public.user_has_branch_access(branch_id)))
      );
  END IF;

  IF to_regclass('public.sale_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "sale_items_via_sale" ON public.sale_items;
    CREATE POLICY "sale_items_via_sale" ON public.sale_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.sales s WHERE s.id = sale_id
          AND (public.is_super_admin() OR (
            s.company_id = public.current_user_company_id()
            AND (public.is_company_admin() OR public.user_has_branch_access(s.branch_id))
          ))
      ));
  END IF;

  IF to_regclass('public.returns') IS NOT NULL THEN
    DROP POLICY IF EXISTS "returns_company_branch" ON public.returns;
    CREATE POLICY "returns_company_branch" ON public.returns FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND (public.is_company_admin() OR public.user_has_branch_access(branch_id)))
      )
      WITH CHECK (
        public.is_super_admin()
        OR (company_id = public.current_user_company_id()
            AND public.company_subscription_active(company_id))
      );
  END IF;

  IF to_regclass('public.return_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "return_items_via_return" ON public.return_items;
    CREATE POLICY "return_items_via_return" ON public.return_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.returns r WHERE r.id = return_id
          AND (public.is_super_admin() OR r.company_id = public.current_user_company_id())
      ));
  END IF;

  IF to_regclass('public.restock_requests') IS NOT NULL THEN
    DROP POLICY IF EXISTS "restock_requests_company" ON public.restock_requests;
    CREATE POLICY "restock_requests_company" ON public.restock_requests FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.restock_invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "restock_invoices_company" ON public.restock_invoices;
    CREATE POLICY "restock_invoices_company" ON public.restock_invoices FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.restock_invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "restock_invoice_items_via_request" ON public.restock_invoice_items;
    CREATE POLICY "restock_invoice_items_via_request" ON public.restock_invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.restock_requests rr
        WHERE rr.id = restock_request_id AND public.rls_company_match(rr.company_id)
      ));
  END IF;

  IF to_regclass('public.invoices') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoices_company" ON public.invoices;
    CREATE POLICY "invoices_company" ON public.invoices FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "invoice_items_via_invoice" ON public.invoice_items;
    CREATE POLICY "invoice_items_via_invoice" ON public.invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i
        JOIN public.restock_requests rr ON rr.id = i.restock_request_id
        WHERE i.id = invoice_id AND public.rls_company_match(rr.company_id)
      ));
  END IF;

  IF to_regclass('public.allocations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "allocations_company" ON public.allocations;
    CREATE POLICY "allocations_company" ON public.allocations FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.allocation_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "allocation_items_via_allocation" ON public.allocation_items;
    CREATE POLICY "allocation_items_via_allocation" ON public.allocation_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.allocations a
        WHERE a.id = allocation_id AND public.rls_company_match(a.company_id)
      ));
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS "notifications_company" ON public.notifications;
    CREATE POLICY "notifications_company" ON public.notifications FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.price_history') IS NOT NULL THEN
    DROP POLICY IF EXISTS "price_history_company" ON public.price_history;
    CREATE POLICY "price_history_company" ON public.price_history FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.transaction_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "transaction_logs_company" ON public.transaction_logs;
    CREATE POLICY "transaction_logs_company" ON public.transaction_logs FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.activity_log') IS NOT NULL THEN
    DROP POLICY IF EXISTS "activity_log_company" ON public.activity_log;
    CREATE POLICY "activity_log_company" ON public.activity_log FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "subscriptions_company" ON public.subscriptions;
    CREATE POLICY "subscriptions_company" ON public.subscriptions FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.is_super_admin());
  END IF;

  IF to_regclass('public.subscription_features') IS NOT NULL THEN
    DROP POLICY IF EXISTS "subscription_features_read" ON public.subscription_features;
    CREATE POLICY "subscription_features_read" ON public.subscription_features
      FOR SELECT TO authenticated USING (true);
    DROP POLICY IF EXISTS "subscription_features_super_admin_write" ON public.subscription_features;
    CREATE POLICY "subscription_features_super_admin_write" ON public.subscription_features
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;

  IF to_regclass('public.salaries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "salaries_company" ON public.salaries;
    CREATE POLICY "salaries_company" ON public.salaries FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR user_id = auth.uid()
        OR (public.is_company_admin() AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = salaries.user_id AND u.company_id = public.current_user_company_id()
        ))
      );
  END IF;

  IF to_regclass('public.payrolls') IS NOT NULL THEN
    DROP POLICY IF EXISTS "payrolls_company" ON public.payrolls;
    CREATE POLICY "payrolls_company" ON public.payrolls FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR user_id = auth.uid()
        OR (public.is_company_admin() AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = payrolls.user_id AND u.company_id = public.current_user_company_id()
        ))
      );
  END IF;

  IF to_regclass('public.online_orders') IS NOT NULL THEN
    DROP POLICY IF EXISTS "online_orders_access" ON public.online_orders;
    CREATE POLICY "online_orders_access" ON public.online_orders FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      )
      WITH CHECK (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      );
  END IF;

  IF to_regclass('public.online_order_items') IS NOT NULL THEN
    DROP POLICY IF EXISTS "online_order_items_via_order" ON public.online_order_items;
    CREATE POLICY "online_order_items_via_order" ON public.online_order_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.online_orders o WHERE o.id = order_id
          AND (public.is_super_admin() OR o.customer_id = auth.uid()
               OR (o.company_id = public.current_user_company_id() AND public.is_company_staff()))
      ));
  END IF;

  IF to_regclass('public.product_ratings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_ratings_access" ON public.product_ratings;
    CREATE POLICY "product_ratings_access" ON public.product_ratings FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR company_id = public.current_user_company_id()
      )
      WITH CHECK (customer_id = auth.uid() OR public.is_super_admin());
  END IF;

  IF to_regclass('public.product_media') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_media_public_read" ON public.product_media;
    CREATE POLICY "product_media_public_read" ON public.product_media
      FOR SELECT USING (true);
    DROP POLICY IF EXISTS "product_media_company_insert" ON public.product_media;
    DROP POLICY IF EXISTS "product_media_company_update" ON public.product_media;
    DROP POLICY IF EXISTS "product_media_company_delete" ON public.product_media;
    CREATE POLICY "product_media_company_write" ON public.product_media
      FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id) AND public.company_subscription_active(company_id));
  END IF;

  IF to_regclass('public.customer_addresses') IS NOT NULL THEN
    DROP POLICY IF EXISTS "customer_addresses_own" ON public.customer_addresses;
    CREATE POLICY "customer_addresses_own" ON public.customer_addresses FOR ALL TO authenticated
      USING (customer_id = auth.uid())
      WITH CHECK (customer_id = auth.uid());
  END IF;

  IF to_regclass('public.customer_payment_methods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "customer_payment_methods_own" ON public.customer_payment_methods;
    CREATE POLICY "customer_payment_methods_own" ON public.customer_payment_methods FOR ALL TO authenticated
      USING (customer_id = auth.uid())
      WITH CHECK (customer_id = auth.uid());
  END IF;

  IF to_regclass('public.shop_chat_threads') IS NOT NULL THEN
    DROP POLICY IF EXISTS "shop_chat_threads_access" ON public.shop_chat_threads;
    CREATE POLICY "shop_chat_threads_access" ON public.shop_chat_threads FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      )
      WITH CHECK (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_staff())
      );
  END IF;

  IF to_regclass('public.shop_chat_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "shop_chat_messages_via_thread" ON public.shop_chat_messages;
    CREATE POLICY "shop_chat_messages_via_thread" ON public.shop_chat_messages FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.shop_chat_threads t WHERE t.id = thread_id
          AND (public.is_super_admin() OR t.customer_id = auth.uid()
               OR (t.company_id = public.current_user_company_id() AND public.is_company_staff()))
      ));
  END IF;

  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "payment_transactions_access" ON public.payment_transactions;
    CREATE POLICY "payment_transactions_access" ON public.payment_transactions FOR ALL TO authenticated
      USING (
        public.is_super_admin()
        OR customer_id = auth.uid()
        OR (company_id = public.current_user_company_id() AND public.is_company_admin())
      )
      WITH CHECK (customer_id = auth.uid() OR public.is_super_admin());
  END IF;

  IF to_regclass('public.product_click_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_click_events_read" ON public.product_click_events;
    CREATE POLICY "product_click_events_read" ON public.product_click_events FOR SELECT TO authenticated
      USING (public.is_super_admin() OR company_id = public.current_user_company_id());
  END IF;

  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "inventory_reservations_staff" ON public.inventory_reservations;
    CREATE POLICY "inventory_reservations_staff" ON public.inventory_reservations FOR ALL TO authenticated
      USING (public.rls_company_match(company_id))
      WITH CHECK (public.rls_company_match(company_id));
  END IF;

  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "platform_settings_public_read" ON public.platform_settings;
    CREATE POLICY "platform_settings_public_read" ON public.platform_settings
      FOR SELECT TO anon, authenticated USING (true);
    DROP POLICY IF EXISTS "platform_settings_super_admin_write" ON public.platform_settings;
    CREATE POLICY "platform_settings_super_admin_write" ON public.platform_settings
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END $pol$;

-- RPC + RLS helper grants (required for policies to evaluate without 400 errors)
GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_staff() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.company_subscription_active(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rls_company_match(UUID) TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION public.update_warehouse_inventory(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_branch_inventory(UUID, UUID, INTEGER, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_warehouse_stock(UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_warehouse_qty(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_online_order(
  UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, UUID, NUMERIC, UUID, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_payment_and_fulfill(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_checkout_stock(UUID, JSONB, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_pos_return(UUID, UUID, UUID, UUID, TEXT, JSONB, TEXT) TO service_role;


-- ---------------------------------------------------------------------------
-- FILE: 20250626130000_rls_helper_grants.sql
-- ---------------------------------------------------------------------------

-- Fix 400 errors: authenticated role must EXECUTE RLS helper functions used in policies

GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_staff() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.company_subscription_active(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rls_company_match(UUID) TO authenticated, anon, service_role;

-- products_company_write was FOR ALL and blocked SELECT when subscription inactive
DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;

CREATE POLICY "products_company_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  );

CREATE POLICY "products_company_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_staff()
        AND public.company_subscription_active(company_id))
  );

CREATE POLICY "products_company_delete" ON public.products
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (company_id = public.current_user_company_id() AND public.is_company_admin()
        AND public.company_subscription_active(company_id))
  );


-- ---------------------------------------------------------------------------
-- FILE: 20250626140000_rls_inline_policies.sql
-- ---------------------------------------------------------------------------

-- Fix PostgREST 400: replace function-based RLS with inline subqueries (Supabase standard)
-- Safe to re-run. Does not remove RPCs — only policy expressions change.

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_public_active_read" ON public.companies;
DROP POLICY IF EXISTS "companies_staff_read_own" ON public.companies;
DROP POLICY IF EXISTS "companies_super_admin_write" ON public.companies;

CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "companies_super_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_company_staff_read" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR (
      company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_company_read" ON public.products;
DROP POLICY IF EXISTS "products_public_marketplace_read" ON public.products;
DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;

CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "products_insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR (
      company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role IN ('company_admin', 'salesperson')
      )
    )
  );

CREATE POLICY "products_update" ON public.products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );

CREATE POLICY "products_delete" ON public.products
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR (
      company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Helper macro: company-scoped SELECT for tenant tables
-- ---------------------------------------------------------------------------
DO $fix$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'restock_requests', 'branch_inventory', 'warehouse_inventory',
    'branches', 'allocations', 'notifications', 'price_history',
    'transaction_logs', 'activity_log', 'central_inventory',
    'restock_invoices', 'returns'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    -- Skip child tables without company_id (handled via parent join below)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant_delete', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'returns_company_branch', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_select', tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_insert', tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_update', tbl
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )',
      tbl || '_tenant_delete', tbl
    );
  END LOOP;
END $fix$;

-- sales: drop old named policies explicitly
DROP POLICY IF EXISTS "sales_company_branch" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_select" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_insert" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_update" ON public.sales;
DROP POLICY IF EXISTS "sales_tenant_delete" ON public.sales;

CREATE POLICY "sales_tenant_select" ON public.sales FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );
CREATE POLICY "sales_tenant_insert" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );
CREATE POLICY "sales_tenant_update" ON public.sales FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );
CREATE POLICY "sales_tenant_delete" ON public.sales FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );

-- sale_items via parent sale
DROP POLICY IF EXISTS "sale_items_via_sale" ON public.sale_items;
CREATE POLICY "sale_items_tenant_select" ON public.sale_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )
  ));
CREATE POLICY "sale_items_tenant_insert" ON public.sale_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
      AND (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )
  ));
CREATE POLICY "sale_items_tenant_update" ON public.sale_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));
CREATE POLICY "sale_items_tenant_delete" ON public.sale_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- branch_staff (no company_id column)
DROP POLICY IF EXISTS "branch_staff_company" ON public.branch_staff;
DROP POLICY IF EXISTS "branch_staff_select" ON public.branch_staff;
DROP POLICY IF EXISTS "branch_staff_write" ON public.branch_staff;

CREATE POLICY "branch_staff_select" ON public.branch_staff FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
        AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    )
  );
CREATE POLICY "branch_staff_insert" ON public.branch_staff FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
        AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );
CREATE POLICY "branch_staff_delete" ON public.branch_staff FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id
        AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'company_admin')
    )
  );

-- return_items via parent
DROP POLICY IF EXISTS "return_items_via_return" ON public.return_items;
CREATE POLICY "return_items_tenant_select" ON public.return_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.returns r WHERE r.id = return_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR r.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- allocation_items via parent
DROP POLICY IF EXISTS "allocation_items_via_allocation" ON public.allocation_items;
CREATE POLICY "allocation_items_tenant_select" ON public.allocation_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.allocations a WHERE a.id = allocation_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR a.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- restock_invoice_items via restock_requests
DROP POLICY IF EXISTS "restock_invoice_items_via_request" ON public.restock_invoice_items;
CREATE POLICY "restock_invoice_items_select" ON public.restock_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.restock_requests rr WHERE rr.id = restock_request_id
      AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
           OR rr.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
  ));

-- Ensure authenticated can use schema + tables (RLS still applies)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Keep helper function grants for RPC callers
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;


-- ---------------------------------------------------------------------------
-- FILE: 20250626150000_rls_policy_reset.sql
-- ---------------------------------------------------------------------------

-- Nuclear policy cleanup: drop ALL public RLS policies and apply minimal inline policies
-- Fixes 400 errors from broken/duplicate function-based policies

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- companies
CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "companies_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));

-- users (subqueries only read auth.uid() row — no recursion)
CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- products
CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
  );

CREATE POLICY "products_modify" ON public.products
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  );

-- Macro for tables with company_id column
DO $pol$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'branches', 'branch_inventory', 'warehouse_inventory', 'central_inventory',
    'sales', 'restock_requests', 'allocations', 'notifications', 'price_history',
    'transaction_logs', 'activity_log', 'returns', 'restock_invoices',
    'subscriptions', 'invoices'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
    ) THEN CONTINUE; END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (
         EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
         OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
       )
       WITH CHECK (
         EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = ''super_admin'')
         OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
       )',
      tbl || '_tenant', tbl
    );
  END LOOP;
END $pol$;

-- salaries / payrolls (user_id only, no company_id)
DO $pol$ BEGIN
  IF to_regclass('public.salaries') IS NOT NULL THEN
    CREATE POLICY "salaries_tenant" ON public.salaries FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = salaries.user_id
            AND u.company_id = (SELECT c.company_id FROM public.users c WHERE c.id = auth.uid())
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'company_admin'))
      );
  END IF;
  IF to_regclass('public.payrolls') IS NOT NULL THEN
    CREATE POLICY "payrolls_tenant" ON public.payrolls FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = payrolls.user_id
            AND u.company_id = (SELECT c.company_id FROM public.users c WHERE c.id = auth.uid())
        )
      )
      WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'company_admin'))
      );
  END IF;
  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    CREATE POLICY "invoice_items_tenant" ON public.invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR i.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.subscription_features') IS NOT NULL THEN
    CREATE POLICY "subscription_features_read" ON public.subscription_features
      FOR SELECT TO authenticated USING (true);
    CREATE POLICY "subscription_features_admin" ON public.subscription_features
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $pol$;

-- sale_items
DO $pol$ BEGIN
  IF to_regclass('public.sale_items') IS NOT NULL THEN
    CREATE POLICY "sale_items_tenant" ON public.sale_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.sales s
        WHERE s.id = sale_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR s.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
END $pol$;

-- branch_staff
DO $pol$ BEGIN
  IF to_regclass('public.branch_staff') IS NOT NULL THEN
    CREATE POLICY "branch_staff_tenant" ON public.branch_staff FOR ALL TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = branch_id
            AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR EXISTS (
          SELECT 1 FROM public.branches b
          WHERE b.id = branch_id
            AND b.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        )
      );
  END IF;
END $pol$;

-- return_items, allocation_items, restock_invoice_items
DO $pol$ BEGIN
  IF to_regclass('public.return_items') IS NOT NULL THEN
    CREATE POLICY "return_items_tenant" ON public.return_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.returns r WHERE r.id = return_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR r.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.allocation_items') IS NOT NULL THEN
    CREATE POLICY "allocation_items_tenant" ON public.allocation_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.allocations a WHERE a.id = allocation_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR a.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.restock_invoice_items') IS NOT NULL THEN
    CREATE POLICY "restock_invoice_items_tenant" ON public.restock_invoice_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.restock_requests rr WHERE rr.id = restock_request_id
          AND (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
               OR rr.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
END $pol$;

-- e-commerce / customer tables
DO $pol$ BEGIN
  IF to_regclass('public.online_orders') IS NOT NULL THEN
    CREATE POLICY "online_orders_access" ON public.online_orders FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
        OR customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
      );
  END IF;
  IF to_regclass('public.online_order_items') IS NOT NULL THEN
    CREATE POLICY "online_order_items_access" ON public.online_order_items FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.online_orders o WHERE o.id = order_id
          AND (o.customer_id = auth.uid()
               OR o.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
               OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      ));
  END IF;
  IF to_regclass('public.customer_addresses') IS NOT NULL THEN
    CREATE POLICY "customer_addresses_own" ON public.customer_addresses FOR ALL TO authenticated
      USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
  END IF;
  IF to_regclass('public.customer_payment_methods') IS NOT NULL THEN
    CREATE POLICY "customer_payment_methods_own" ON public.customer_payment_methods FOR ALL TO authenticated
      USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());
  END IF;
  IF to_regclass('public.product_ratings') IS NOT NULL THEN
    CREATE POLICY "product_ratings_access" ON public.product_ratings FOR ALL TO authenticated
      USING (
        customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.product_media') IS NOT NULL THEN
    CREATE POLICY "product_media_public_read" ON public.product_media FOR SELECT USING (true);
    CREATE POLICY "product_media_write" ON public.product_media FOR ALL TO authenticated
      USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      WITH CHECK (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()));
  END IF;
  IF to_regclass('public.payment_transactions') IS NOT NULL THEN
    CREATE POLICY "payment_transactions_access" ON public.payment_transactions FOR ALL TO authenticated
      USING (
        customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.shop_chat_threads') IS NOT NULL THEN
    CREATE POLICY "shop_chat_threads_access" ON public.shop_chat_threads FOR ALL TO authenticated
      USING (
        customer_id = auth.uid()
        OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.shop_chat_messages') IS NOT NULL THEN
    CREATE POLICY "shop_chat_messages_access" ON public.shop_chat_messages FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.shop_chat_threads t WHERE t.id = thread_id
          AND (t.customer_id = auth.uid()
               OR t.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()))
      ));
  END IF;
  IF to_regclass('public.product_click_events') IS NOT NULL THEN
    CREATE POLICY "product_click_events_read" ON public.product_click_events FOR SELECT TO authenticated
      USING (
        company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin')
      );
  END IF;
  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    CREATE POLICY "inventory_reservations_tenant" ON public.inventory_reservations FOR ALL TO authenticated
      USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid()));
  END IF;
  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    CREATE POLICY "platform_settings_read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
    CREATE POLICY "platform_settings_admin" ON public.platform_settings FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'super_admin'));
  END IF;
END $pol$;

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- FILE: 20250626160000_rls_fix_users_recursion.sql
-- ---------------------------------------------------------------------------

-- Fix 500 on users (RLS recursion) — SAFE TO RE-RUN (drops before every create)

DROP FUNCTION IF EXISTS public.current_user_company_id();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.is_super_admin();
DROP FUNCTION IF EXISTS public.is_company_admin();
DROP FUNCTION IF EXISTS public.is_company_staff();

CREATE OR REPLACE FUNCTION public.current_user_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'company_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('company_admin', 'salesperson')
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_user_company_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_admin() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_staff() TO PUBLIC;

-- users (no self-subquery — prevents infinite recursion)
DROP POLICY IF EXISTS "users_select" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "users_company_staff_read" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;

CREATE POLICY "users_select" ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_super_admin()
    OR (public.is_company_admin() AND company_id = public.current_user_company_id())
  );

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- companies
DROP POLICY IF EXISTS "companies_select" ON public.companies;
DROP POLICY IF EXISTS "companies_public_active_read" ON public.companies;
DROP POLICY IF EXISTS "companies_staff_read_own" ON public.companies;
DROP POLICY IF EXISTS "companies_admin_write" ON public.companies;
DROP POLICY IF EXISTS "companies_super_admin_write" ON public.companies;

CREATE POLICY "companies_select" ON public.companies
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR id = public.current_user_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "companies_admin_write" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- products
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_modify" ON public.products;
DROP POLICY IF EXISTS "products_public_marketplace_read" ON public.products;
DROP POLICY IF EXISTS "products_company_insert" ON public.products;
DROP POLICY IF EXISTS "products_company_update" ON public.products;
DROP POLICY IF EXISTS "products_company_delete" ON public.products;
DROP POLICY IF EXISTS "products_company_read" ON public.products;
DROP POLICY IF EXISTS "products_company_write" ON public.products;
DROP POLICY IF EXISTS "products_tenant" ON public.products;

CREATE POLICY "products_select" ON public.products
  FOR SELECT TO anon, authenticated
  USING (
    company_id IN (SELECT c.id FROM public.companies c WHERE c.status = 'active')
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

CREATE POLICY "products_modify" ON public.products
  FOR ALL TO authenticated
  USING (public.is_super_admin() OR company_id = public.current_user_company_id())
  WITH CHECK (public.is_super_admin() OR company_id = public.current_user_company_id());

-- company_id tables: always DROP then CREATE
DO $fix$
DECLARE
  tbl TEXT;
  tables_with_company TEXT[] := ARRAY[
    'branches', 'branch_inventory', 'warehouse_inventory', 'central_inventory',
    'sales', 'restock_requests', 'allocations', 'notifications', 'price_history',
    'transaction_logs', 'activity_log', 'returns', 'restock_invoices',
    'subscriptions', 'invoices', 'inventory_reservations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_with_company
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'company_id'
    ) THEN CONTINUE; END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_tenant', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (public.is_super_admin() OR company_id = public.current_user_company_id())
       WITH CHECK (public.is_super_admin() OR company_id = public.current_user_company_id())',
      tbl || '_tenant', tbl
    );
  END LOOP;
END $fix$;

-- sale_items
DROP POLICY IF EXISTS "sale_items_tenant" ON public.sale_items;
DROP POLICY IF EXISTS "sale_items_via_sale" ON public.sale_items;
CREATE POLICY "sale_items_tenant" ON public.sale_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (public.is_super_admin() OR s.company_id = public.current_user_company_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sales s WHERE s.id = sale_id
      AND (public.is_super_admin() OR s.company_id = public.current_user_company_id())
  ));

-- branch_staff
DROP POLICY IF EXISTS "branch_staff_tenant" ON public.branch_staff;
DROP POLICY IF EXISTS "branch_staff_company" ON public.branch_staff;
CREATE POLICY "branch_staff_tenant" ON public.branch_staff FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.company_id = public.current_user_company_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = branch_id AND b.company_id = public.current_user_company_id()
    )
  );

-- online_orders (customer + company)
DROP POLICY IF EXISTS "online_orders_access" ON public.online_orders;
DROP POLICY IF EXISTS "online_orders_tenant" ON public.online_orders;
CREATE POLICY "online_orders_access" ON public.online_orders FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
  )
  WITH CHECK (
    public.is_super_admin() OR customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
  );

DROP POLICY IF EXISTS "online_order_items_access" ON public.online_order_items;
DROP POLICY IF EXISTS "online_order_items_via_order" ON public.online_order_items;
DROP POLICY IF EXISTS "online_order_items_tenant" ON public.online_order_items;
CREATE POLICY "online_order_items_access" ON public.online_order_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.online_orders o WHERE o.id = order_id
      AND (public.is_super_admin() OR o.customer_id = auth.uid()
           OR o.company_id = public.current_user_company_id())
  ));

-- salaries / payrolls (optional tables — not in baseline schema)
DO $pol$ BEGIN
  IF to_regclass('public.salaries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "salaries_tenant" ON public.salaries;
    CREATE POLICY "salaries_tenant" ON public.salaries FOR ALL TO authenticated
      USING (
        user_id = auth.uid() OR public.is_super_admin()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = salaries.user_id AND u.company_id = public.current_user_company_id()
        )
      );
  END IF;

  IF to_regclass('public.payrolls') IS NOT NULL THEN
    DROP POLICY IF EXISTS "payrolls_tenant" ON public.payrolls;
    CREATE POLICY "payrolls_tenant" ON public.payrolls FOR ALL TO authenticated
      USING (
        user_id = auth.uid() OR public.is_super_admin()
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = payrolls.user_id AND u.company_id = public.current_user_company_id()
        )
      );
  END IF;
END $pol$;

-- e-commerce / customer tables (not plain company_id tenant)
DROP POLICY IF EXISTS "customer_addresses_own" ON public.customer_addresses;
CREATE POLICY "customer_addresses_own" ON public.customer_addresses FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "customer_payment_methods_own" ON public.customer_payment_methods;
CREATE POLICY "customer_payment_methods_own" ON public.customer_payment_methods FOR ALL TO authenticated
  USING (customer_id = auth.uid()) WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "product_ratings_access" ON public.product_ratings;
DROP POLICY IF EXISTS "product_ratings_tenant" ON public.product_ratings;
CREATE POLICY "product_ratings_access" ON public.product_ratings FOR ALL TO authenticated
  USING (
    customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "product_media_public_read" ON public.product_media;
DROP POLICY IF EXISTS "product_media_write" ON public.product_media;
DROP POLICY IF EXISTS "product_media_tenant" ON public.product_media;
CREATE POLICY "product_media_public_read" ON public.product_media FOR SELECT USING (true);
CREATE POLICY "product_media_write" ON public.product_media FOR ALL TO authenticated
  USING (public.is_super_admin() OR company_id = public.current_user_company_id())
  WITH CHECK (public.is_super_admin() OR company_id = public.current_user_company_id());

DROP POLICY IF EXISTS "payment_transactions_access" ON public.payment_transactions;
DROP POLICY IF EXISTS "payment_transactions_tenant" ON public.payment_transactions;
CREATE POLICY "payment_transactions_access" ON public.payment_transactions FOR ALL TO authenticated
  USING (
    customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "shop_chat_threads_access" ON public.shop_chat_threads;
DROP POLICY IF EXISTS "shop_chat_threads_tenant" ON public.shop_chat_threads;
CREATE POLICY "shop_chat_threads_access" ON public.shop_chat_threads FOR ALL TO authenticated
  USING (
    customer_id = auth.uid()
    OR company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "shop_chat_messages_access" ON public.shop_chat_messages;
CREATE POLICY "shop_chat_messages_access" ON public.shop_chat_messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shop_chat_threads t WHERE t.id = thread_id
      AND (t.customer_id = auth.uid()
           OR t.company_id = public.current_user_company_id()
           OR public.is_super_admin())
  ));

DROP POLICY IF EXISTS "product_click_events_read" ON public.product_click_events;
DROP POLICY IF EXISTS "product_click_events_tenant" ON public.product_click_events;
CREATE POLICY "product_click_events_read" ON public.product_click_events FOR SELECT TO authenticated
  USING (
    company_id = public.current_user_company_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "platform_settings_read" ON public.platform_settings;
DROP POLICY IF EXISTS "platform_settings_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_read" ON public.platform_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "platform_settings_admin" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC;

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- FILE: 20250627120000_company_branding.sql
-- ---------------------------------------------------------------------------

-- Company store branding for marketplace

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

COMMENT ON COLUMN public.companies.logo_url IS 'Square store logo shown on marketplace listings';
COMMENT ON COLUMN public.companies.banner_url IS 'Wide banner shown on the store page';


-- ---------------------------------------------------------------------------
-- FILE: 20250627140000_company_inventory_model.sql
-- ---------------------------------------------------------------------------

-- Companies without a central warehouse use branch inventory for marketplace/POS stock.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS inventory_model TEXT NOT NULL DEFAULT 'warehouse';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_inventory_model_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_inventory_model_check
  CHECK (inventory_model IN ('warehouse', 'branch_only'));

COMMENT ON COLUMN public.companies.inventory_model IS
  'warehouse = central warehouse + allocations; branch_only = stock lives at branches only';

-- Unified sellable quantity (warehouse OR summed branches, minus active reservations)
CREATE OR REPLACE FUNCTION public.get_sellable_qty(
  p_company_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_model TEXT;
  v_raw INTEGER := 0;
  v_reserved INTEGER := 0;
BEGIN
  SELECT COALESCE(c.inventory_model, 'warehouse') INTO v_model
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_model = 'branch_only' THEN
    SELECT COALESCE(SUM(bi.quantity), 0)::INTEGER INTO v_raw
    FROM public.branch_inventory bi
    WHERE bi.company_id = p_company_id
      AND bi.product_id = p_product_id;
  ELSE
    SELECT COALESCE(wi.quantity, 0)::INTEGER INTO v_raw
    FROM public.warehouse_inventory wi
    WHERE wi.company_id = p_company_id
      AND wi.product_id = p_product_id;
  END IF;

  SELECT COALESCE(SUM(r.quantity), 0)::INTEGER INTO v_reserved
  FROM public.inventory_reservations r
  WHERE r.company_id = p_company_id
    AND r.product_id = p_product_id
    AND r.expires_at > now();

  RETURN GREATEST(0, v_raw - v_reserved);
END;
$$;

-- Backward-compatible alias used by checkout RPCs
CREATE OR REPLACE FUNCTION public.get_available_warehouse_qty(
  p_company_id UUID,
  p_product_id UUID
)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_sellable_qty(p_company_id, p_product_id);
$$;

CREATE OR REPLACE FUNCTION public.deduct_sellable_stock(
  p_company_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_model TEXT;
  v_remaining INTEGER;
  rec RECORD;
  v_take INTEGER;
  v_rows INTEGER;
BEGIN
  IF p_qty <= 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(c.inventory_model, 'warehouse') INTO v_model
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_model = 'branch_only' THEN
    v_remaining := p_qty;

    FOR rec IN
      SELECT bi.branch_id, bi.quantity
      FROM public.branch_inventory bi
      WHERE bi.company_id = p_company_id
        AND bi.product_id = p_product_id
        AND bi.quantity > 0
      ORDER BY bi.quantity DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(rec.quantity, v_remaining);
      PERFORM public.update_branch_inventory(rec.branch_id, p_product_id, -v_take);
      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
    END IF;
  ELSE
    UPDATE public.warehouse_inventory
    SET quantity = quantity - p_qty,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND quantity >= p_qty;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'Insufficient stock for product %', p_product_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(
  p_company_id UUID,
  p_items JSONB,
  p_payment_transaction_id UUID,
  p_ttl_minutes INTEGER DEFAULT 15
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_qty INTEGER;
  v_available INTEGER;
BEGIN
  DELETE FROM public.inventory_reservations
  WHERE payment_transaction_id = p_payment_transaction_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_qty := (v_item->>'quantity')::INTEGER;

    v_available := public.get_sellable_qty(p_company_id, v_product_id);
    IF v_available < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product_id;
    END IF;

    INSERT INTO public.inventory_reservations (
      company_id, product_id, quantity, payment_transaction_id, expires_at
    ) VALUES (
      p_company_id, v_product_id, v_qty, p_payment_transaction_id,
      now() + (p_ttl_minutes || ' minutes')::INTERVAL
    );
  END LOOP;
END;
$$;

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
  p_notes TEXT DEFAULT NULL
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
    momo_reference, address_id, notes, status, payment_transaction_id, platform_fee
  ) VALUES (
    p_company_id, p_customer_id, p_total, p_shipping_name, p_shipping_phone,
    p_shipping_address, p_fulfillment_type, p_payment_method, p_payment_status,
    p_paystack_reference, p_address_id, p_notes, 'pending', p_payment_transaction_id, p_platform_fee
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

  IF p_payment_transaction_id IS NOT NULL THEN
    DELETE FROM public.inventory_reservations
    WHERE payment_transaction_id = p_payment_transaction_id;
  END IF;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_sellable_stock(
  p_company_id UUID,
  p_product_id UUID,
  p_qty INTEGER
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_model TEXT;
  v_branch_id UUID;
BEGIN
  IF p_qty <= 0 THEN
    RETURN;
  END IF;

  SELECT COALESCE(c.inventory_model, 'warehouse') INTO v_model
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_model = 'branch_only' THEN
    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.company_id = p_company_id
    ORDER BY b.created_at ASC
    LIMIT 1;

    IF v_branch_id IS NULL THEN
      RAISE EXCEPTION 'No branch available to restore stock';
    END IF;

    PERFORM public.update_branch_inventory(v_branch_id, p_product_id, p_qty);
  ELSE
    PERFORM public.update_warehouse_inventory(p_product_id, p_company_id, p_qty);
  END IF;
END;
$$;

CREATE OR REPLACE VIEW public.sellable_inventory AS
SELECT
  s.company_id,
  s.product_id,
  p.name AS product_name,
  p.sku,
  p.barcode,
  s.sellable_quantity,
  s.min_stock_level,
  (s.sellable_quantity <= COALESCE(s.min_stock_level, p.low_stock_threshold, 5)) AS low_stock
FROM (
  SELECT
    wi.company_id,
    wi.product_id,
    wi.quantity AS sellable_quantity,
    wi.min_stock_level
  FROM public.warehouse_inventory wi
  JOIN public.companies c ON c.id = wi.company_id
  WHERE COALESCE(c.inventory_model, 'warehouse') = 'warehouse'

  UNION ALL

  SELECT
    bi.company_id,
    bi.product_id,
    SUM(bi.quantity)::INTEGER AS sellable_quantity,
    NULL::INTEGER AS min_stock_level
  FROM public.branch_inventory bi
  JOIN public.companies c ON c.id = bi.company_id
  WHERE c.inventory_model = 'branch_only'
  GROUP BY bi.company_id, bi.product_id
) s
JOIN public.products p ON p.id = s.product_id;

GRANT EXECUTE ON FUNCTION public.get_sellable_qty(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deduct_sellable_stock(UUID, UUID, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_sellable_stock(UUID, UUID, INTEGER) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- FILE: 20250628120000_marketplace_features.sql
-- ---------------------------------------------------------------------------

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


-- ---------------------------------------------------------------------------
-- FILE: 20250629120000_push_and_customer_notifications.sql
-- ---------------------------------------------------------------------------

-- Web push subscriptions + marketplace customer in-app notifications

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS public.customer_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_notifications_customer
  ON public.customer_notifications(customer_id, created_at DESC);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS customer_notifications_own ON public.customer_notifications;
CREATE POLICY customer_notifications_own ON public.customer_notifications
  FOR ALL TO authenticated
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

NOTIFY pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- FILE: 20250630120000_customer_payment_card_fields.sql
-- ---------------------------------------------------------------------------

-- Saved card metadata (last 4 + expiry only — never store full PAN)
ALTER TABLE public.customer_payment_methods
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS card_exp_month SMALLINT,
  ADD COLUMN IF NOT EXISTS card_exp_year SMALLINT;

COMMENT ON COLUMN public.customer_payment_methods.card_last4 IS 'Last 4 digits of saved card';
COMMENT ON COLUMN public.customer_payment_methods.card_exp_month IS 'Card expiry month 1-12';
COMMENT ON COLUMN public.customer_payment_methods.card_exp_year IS 'Card expiry year (4-digit)';


-- ---------------------------------------------------------------------------
-- FILE: 20250701120000_product_description.sql
-- ---------------------------------------------------------------------------

-- Product long-form description for marketplace detail pages
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT;


-- ---------------------------------------------------------------------------
-- FILE: 20250702120000_product_marketplace_listing.sql
-- ---------------------------------------------------------------------------

-- Optional rich marketplace listing data for online products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_online_listing BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS marketplace_listing JSONB;

COMMENT ON COLUMN public.products.marketplace_listing IS
  'Optional online listing: variations, size_guide, key_highlights, specifications, key_features, weight_kg, product_details';


-- ---------------------------------------------------------------------------
-- FILE: 20250703120000_allocations_schema_align.sql
-- ---------------------------------------------------------------------------

-- Align allocations / allocation_items with app + shared database.types
ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS from_warehouse BOOLEAN DEFAULT true;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS to_branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS sales_type TEXT NOT NULL DEFAULT 'both';

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'allocations'
      AND column_name = 'branch_id'
  ) THEN
    UPDATE public.allocations
    SET to_branch_id = branch_id
    WHERE to_branch_id IS NULL AND branch_id IS NOT NULL;

    ALTER TABLE public.allocations ALTER COLUMN branch_id DROP NOT NULL;
  END IF;
END $$;

UPDATE public.allocations
SET completed_at = COALESCE(completed_at, created_at, now())
WHERE status = 'completed' AND completed_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allocations WHERE to_branch_id IS NULL
  ) THEN
    ALTER TABLE public.allocations ALTER COLUMN to_branch_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

CREATE INDEX IF NOT EXISTS allocations_to_branch_id_idx
  ON public.allocations (to_branch_id);

CREATE INDEX IF NOT EXISTS allocations_company_id_idx
  ON public.allocations (company_id);

ALTER TABLE public.allocation_items
  ADD COLUMN IF NOT EXISTS retail_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.allocation_items
  ADD COLUMN IF NOT EXISTS wholesale_quantity INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'allocation_items'
      AND column_name = 'quantity'
  ) THEN
    UPDATE public.allocation_items
    SET retail_quantity = COALESCE(NULLIF(retail_quantity, 0), quantity, 0)
    WHERE COALESCE(retail_quantity, 0) = 0
      AND COALESCE(wholesale_quantity, 0) = 0
      AND quantity IS NOT NULL;

    ALTER TABLE public.allocation_items ALTER COLUMN quantity DROP NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.allocations.to_branch_id IS
  'Destination branch for warehouse → branch stock allocation';
COMMENT ON COLUMN public.allocations.completed_at IS
  'When the allocation was completed; set on create for immediate allocations';

-- =============================================================================
-- End of combined migration (24 files)
-- =============================================================================
