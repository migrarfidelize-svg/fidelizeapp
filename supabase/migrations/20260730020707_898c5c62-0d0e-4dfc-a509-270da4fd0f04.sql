CREATE TABLE public.pixel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pixel_id text,
  event_name text NOT NULL,
  path text,
  referrer text,
  session_hash text,
  device text,
  source text NOT NULL DEFAULT 'browser',
  capi_status text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pixel_events_created_at_idx ON public.pixel_events (created_at DESC);
CREATE INDEX pixel_events_event_name_idx ON public.pixel_events (event_name);

GRANT SELECT ON public.pixel_events TO authenticated;
GRANT ALL ON public.pixel_events TO service_role;

ALTER TABLE public.pixel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read pixel events"
  ON public.pixel_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_events;
ALTER TABLE public.pixel_events REPLICA IDENTITY FULL;