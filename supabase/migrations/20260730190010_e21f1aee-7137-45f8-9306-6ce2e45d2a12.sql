CREATE TABLE public.plan_funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  stage text NOT NULL CHECK (stage IN ('landing_select','auth_intent','checkout_open','checkout_mismatch')),
  plan_slug text,
  plan_name text,
  amount numeric(10,2),
  source text,
  provider text,
  user_id uuid,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX plan_funnel_events_created_idx ON public.plan_funnel_events (created_at DESC);
CREATE INDEX plan_funnel_events_session_idx ON public.plan_funnel_events (session_id, created_at DESC);

GRANT SELECT ON public.plan_funnel_events TO authenticated;
GRANT ALL ON public.plan_funnel_events TO service_role;

ALTER TABLE public.plan_funnel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan funnel admin read" ON public.plan_funnel_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

ALTER TYPE public.plan_tier ADD VALUE IF NOT EXISTS 'business';