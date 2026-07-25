CREATE TABLE public.channel_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('linktree','reviews','loyalty','qr')),
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view','link_click','qr_scan')),
  ref_id TEXT,
  ref_label TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ua TEXT,
  ip_hash TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX channel_events_est_channel_time_idx
  ON public.channel_events (establishment_id, channel, occurred_at DESC);
CREATE INDEX channel_events_est_time_idx
  ON public.channel_events (establishment_id, occurred_at DESC);

GRANT SELECT ON public.channel_events TO authenticated;
GRANT ALL ON public.channel_events TO service_role;

ALTER TABLE public.channel_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read channel events"
  ON public.channel_events
  FOR SELECT
  TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));