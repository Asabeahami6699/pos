-- Align allocations / allocation_items with app + shared database.types
-- Old schema used branch_id + quantity; app uses to_branch_id, sales_type,
-- from_warehouse, completed_at, retail_quantity, wholesale_quantity.

-- ---------------------------------------------------------------------------
-- allocations
-- ---------------------------------------------------------------------------
ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS from_warehouse BOOLEAN DEFAULT true;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS to_branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS sales_type TEXT NOT NULL DEFAULT 'both';

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill destination branch from legacy branch_id
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

    -- Allow inserts that only set to_branch_id
    ALTER TABLE public.allocations ALTER COLUMN branch_id DROP NOT NULL;
  END IF;
END $$;

-- Completed rows without completed_at use created_at
UPDATE public.allocations
SET completed_at = COALESCE(completed_at, created_at, now())
WHERE status = 'completed' AND completed_at IS NULL;

-- Prefer NOT NULL to_branch_id when every row has a destination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allocations WHERE to_branch_id IS NULL
  ) THEN
    ALTER TABLE public.allocations ALTER COLUMN to_branch_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN
    NULL; -- leave nullable if constraint cannot be applied yet
END $$;

CREATE INDEX IF NOT EXISTS allocations_to_branch_id_idx
  ON public.allocations (to_branch_id);

CREATE INDEX IF NOT EXISTS allocations_company_id_idx
  ON public.allocations (company_id);

-- ---------------------------------------------------------------------------
-- allocation_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.allocation_items
  ADD COLUMN IF NOT EXISTS retail_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.allocation_items
  ADD COLUMN IF NOT EXISTS wholesale_quantity INTEGER NOT NULL DEFAULT 0;

-- Backfill from legacy quantity column
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
