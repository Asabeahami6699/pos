-- Run in Supabase SQL Editor if marketplace shows "No products found"
-- while products exist in admin/POS.
-- Marketplace APIs only return rows with is_online_listing = true.

UPDATE public.products
SET is_online_listing = true
WHERE is_online_listing = false;
