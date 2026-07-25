CREATE TABLE public.app_engagement_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  audience text NOT NULL CHECK (audience IN ('merchant','customer')),
  event_type text NOT NULL CHECK (event_type IN (
    'install_prompt_shown','install_accepted','install_dismissed','install_manual_guide',
    'push_enabled','push_denied','push_blocked','push_dismissed','push_disabled','push_failed'
  )),
  platform text,
  browser text,
  standalone boolean,
  ua text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX app_engagement_events_est_time_idx ON public.app_engagement_events (establishment_id, occurred_at DESC);
CREATE INDEX app_engagement_events_type_time_idx ON public.app_engagement_events (event_type, occurred_at DESC);
CREATE INDEX app_engagement_events_user_idx ON public.app_engagement_events (user_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.app_engagement_events TO authenticated;
GRANT ALL ON public.app_engagement_events TO service_role;

ALTER TABLE public.app_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own engagement events"
  ON public.app_engagement_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "read own engagement events"
  ON public.app_engagement_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "members read establishment engagement events"
  ON public.app_engagement_events FOR SELECT TO authenticated
  USING (establishment_id IS NOT NULL AND public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "super admin reads engagement events"
  ON public.app_engagement_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));