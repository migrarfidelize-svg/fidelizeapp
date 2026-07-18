CREATE OR REPLACE FUNCTION public.tg_establishment_subscription_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_order jsonb := '{"free":0,"starter":1,"pro":2,"enterprise":3}'::jsonb;
  from_rank int;
  to_rank int;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      from_rank := (plan_order->>(OLD.plan::text))::int;
      to_rank := (plan_order->>(NEW.plan::text))::int;
      INSERT INTO public.subscription_events (establishment_id, event_type, from_plan, to_plan, actor_id, message)
      VALUES (
        NEW.id,
        CASE WHEN to_rank > from_rank THEN 'upgrade'
             WHEN to_rank < from_rank THEN 'downgrade'
             ELSE 'plan_change' END,
        OLD.plan, NEW.plan, auth.uid(),
        'Plano alterado de ' || OLD.plan::text || ' para ' || NEW.plan::text
      );
    END IF;
    IF NEW.active IS DISTINCT FROM OLD.active THEN
      INSERT INTO public.subscription_events (establishment_id, event_type, from_plan, to_plan, actor_id, message)
      VALUES (
        NEW.id,
        CASE WHEN NEW.active THEN 'reactivate' ELSE 'cancel' END,
        OLD.plan, NEW.plan, auth.uid(),
        CASE WHEN NEW.active THEN 'Estabelecimento reativado' ELSE 'Estabelecimento bloqueado/cancelado' END
      );
    END IF;
  END IF;
  RETURN NEW;
END; $function$;