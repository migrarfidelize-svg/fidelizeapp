ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS track_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_qty integer;

CREATE OR REPLACE FUNCTION public.tg_menu_items_stock_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.track_stock THEN
    IF COALESCE(NEW.stock_qty, 0) <= 0 THEN
      NEW.stock_qty := COALESCE(NEW.stock_qty, 0);
      NEW.stock_status := 'out_of_stock';
    ELSIF NEW.stock_status = 'out_of_stock' THEN
      NEW.stock_status := 'in_stock';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_items_stock_status ON public.menu_items;
CREATE TRIGGER trg_menu_items_stock_status
BEFORE INSERT OR UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.tg_menu_items_stock_status();