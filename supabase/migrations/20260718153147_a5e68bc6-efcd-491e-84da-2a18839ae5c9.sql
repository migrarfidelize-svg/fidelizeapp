
-- Subscription events table
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('upgrade','downgrade','cancel','reactivate','payment_failed','plan_change')),
  from_plan text,
  to_plan text,
  message text,
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subev_admin_all ON public.subscription_events
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY subev_manager_read ON public.subscription_events
  FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));

CREATE INDEX idx_subev_est_created ON public.subscription_events (establishment_id, created_at DESC);
CREATE INDEX idx_subev_unack ON public.subscription_events (created_at DESC) WHERE acknowledged_at IS NULL;

-- Auto-emit events on establishment plan/active changes
CREATE OR REPLACE FUNCTION public.tg_establishment_subscription_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_order jsonb := '{"free":0,"starter":1,"pro":2,"enterprise":3}'::jsonb;
  from_rank int;
  to_rank int;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      from_rank := (plan_order->>OLD.plan)::int;
      to_rank := (plan_order->>NEW.plan)::int;
      INSERT INTO public.subscription_events (establishment_id, event_type, from_plan, to_plan, actor_id, message)
      VALUES (
        NEW.id,
        CASE WHEN to_rank > from_rank THEN 'upgrade'
             WHEN to_rank < from_rank THEN 'downgrade'
             ELSE 'plan_change' END,
        OLD.plan, NEW.plan, auth.uid(),
        'Plano alterado de ' || OLD.plan || ' para ' || NEW.plan
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
END; $$;

DROP TRIGGER IF EXISTS trg_establishment_sub_events ON public.establishments;
CREATE TRIGGER trg_establishment_sub_events
AFTER UPDATE ON public.establishments
FOR EACH ROW EXECUTE FUNCTION public.tg_establishment_subscription_events();

REVOKE ALL ON FUNCTION public.tg_establishment_subscription_events() FROM PUBLIC, anon, authenticated;
