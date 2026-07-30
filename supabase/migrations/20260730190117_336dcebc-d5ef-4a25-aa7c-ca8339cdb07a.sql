INSERT INTO public.plans (
  tier, slug, name, description, price_monthly, currency,
  is_active, is_featured, display_order, button_text, features,
  customer_limit, employee_limit, campaign_limit, unit_limit,
  active_card_limit, stamp_limit, email_limit, storage_limit_mb, ticket_limit
) VALUES (
  'business', 'empresarial', 'Empresarial',
  'Para redes e franquias: múltiplas unidades, volume ilimitado, onboarding assistido, SLA prioritário e suporte dedicado. Contratação via time comercial.',
  349.00, 'BRL', true, false, 4, 'Falar com vendas',
  '{"sales_contact": true, "quote_flow": true}'::jsonb,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
SELECT (SELECT id FROM public.plans WHERE slug = 'empresarial'), pf.feature_key, pf.feature_name, pf.enabled
FROM public.plan_features pf
JOIN public.plans p ON p.id = pf.plan_id
WHERE p.slug = 'ilimitado'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.tg_establishment_subscription_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan_order jsonb := '{"free":0,"starter":1,"pro":2,"enterprise":3,"business":4}'::jsonb;
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