ALTER TABLE public.retention_events DROP CONSTRAINT IF EXISTS retention_events_event_type_check;
ALTER TABLE public.retention_events ADD CONSTRAINT retention_events_event_type_check CHECK (event_type = ANY (ARRAY['tier_up','tier_down','referral_click','referral_share','referral_signup','referral_reward','birthday_sent','reengagement_sent']));

-- Allow anonymous inserts ONLY for referral tracking events (click/share).
-- Guarded by RLS: cannot insert other event types via anon.
CREATE POLICY "anon can log referral tracking" ON public.retention_events
  FOR INSERT TO anon
  WITH CHECK (event_type IN ('referral_click','referral_share'));

GRANT INSERT ON public.retention_events TO anon;