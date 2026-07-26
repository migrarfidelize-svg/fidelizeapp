ALTER TABLE public.channel_events DROP CONSTRAINT IF EXISTS channel_events_channel_check;
ALTER TABLE public.channel_events ADD CONSTRAINT channel_events_channel_check
  CHECK (channel = ANY (ARRAY['linktree'::text,'reviews'::text,'loyalty'::text,'qr'::text,'menu'::text,'catalog'::text]));