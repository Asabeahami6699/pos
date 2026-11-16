-- Run this first if ALL_MIGRATIONS_ONCE failed at sellable_inventory / min_stock_level
-- Then re-run ALL_MIGRATIONS_ONCE.sql (idempotent statements will skip what already exists)

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
