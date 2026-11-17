-- Align price_history with app expectations

ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS change_type TEXT
    CHECK (change_type IS NULL OR change_type IN ('retail', 'wholesale'));

ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS quantity_at_change INTEGER;

ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ;

UPDATE public.price_history
SET changed_at = COALESCE(changed_at, created_at, now())
WHERE changed_at IS NULL;

ALTER TABLE public.price_history
  ALTER COLUMN changed_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.price_history_sync_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.changed_at IS NULL THEN
    NEW.changed_at := COALESCE(NEW.created_at, now());
  END IF;
  IF NEW.created_at IS NULL THEN
    NEW.created_at := COALESCE(NEW.changed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_history_sync_timestamps ON public.price_history;
CREATE TRIGGER trg_price_history_sync_timestamps
  BEFORE INSERT OR UPDATE ON public.price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.price_history_sync_timestamps();
