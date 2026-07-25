-- Split the menu status trigger:
--   BEFORE: only defaults published_at
--   AFTER : writes the audit row (menu_publish_events) once the parent row exists

CREATE OR REPLACE FUNCTION public.tg_menu_status_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.tg_menu_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.menu_publish_events (menu_id, establishment_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.establishment_id, NULL, NEW.status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.menu_publish_events (menu_id, establishment_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.establishment_id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS trg_restaurant_menus_status ON public.restaurant_menus;

CREATE TRIGGER trg_restaurant_menus_status_defaults
  BEFORE INSERT OR UPDATE ON public.restaurant_menus
  FOR EACH ROW EXECUTE FUNCTION public.tg_menu_status_defaults();

CREATE TRIGGER trg_restaurant_menus_status_history
  AFTER INSERT OR UPDATE ON public.restaurant_menus
  FOR EACH ROW EXECUTE FUNCTION public.tg_menu_status_history();