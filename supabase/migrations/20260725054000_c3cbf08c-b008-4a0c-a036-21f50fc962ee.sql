
-- 1. New columns on push_subscriptions
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS operating_system TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS permission_status TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

-- 2. push_events table (granular lifecycle logs)
CREATE TABLE IF NOT EXISTS public.push_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  status TEXT,
  hostname TEXT,
  browser TEXT,
  operating_system TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.push_events TO authenticated;
GRANT ALL ON public.push_events TO service_role;

ALTER TABLE public.push_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own push events" ON public.push_events;
CREATE POLICY "users read own push events"
ON public.push_events FOR SELECT TO authenticated
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (establishment_id IS NOT NULL AND public.has_establishment_access(auth.uid(), establishment_id))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "users insert own push events" ON public.push_events;
CREATE POLICY "users insert own push events"
ON public.push_events FOR INSERT TO authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid()
);

CREATE INDEX IF NOT EXISTS idx_push_events_user_created
  ON public.push_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_events_est_created
  ON public.push_events (establishment_id, created_at DESC) WHERE establishment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_events_type
  ON public.push_events (event_type, created_at DESC);
