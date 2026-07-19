
-- =============================================================
-- RETENTION + PUSH — schema base
-- =============================================================

-- Enum de tiers
DO $$ BEGIN
  CREATE TYPE public.customer_tier AS ENUM ('bronze','prata','ouro','diamante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 1) retention_settings (1 por estabelecimento)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retention_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  birthday_enabled boolean NOT NULL DEFAULT true,
  birthday_message text NOT NULL DEFAULT 'Feliz aniversário! Um mimo especial te espera na sua próxima visita.',
  birthday_coupon_percent int NOT NULL DEFAULT 0 CHECK (birthday_coupon_percent BETWEEN 0 AND 100),

  reengagement_enabled boolean NOT NULL DEFAULT true,
  reengagement_days int NOT NULL DEFAULT 30 CHECK (reengagement_days BETWEEN 7 AND 365),
  reengagement_message text NOT NULL DEFAULT 'Sentimos sua falta! Que tal voltar e acumular mais carimbos?',

  tiers_enabled boolean NOT NULL DEFAULT true,
  tier_thresholds jsonb NOT NULL DEFAULT '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb,

  referral_enabled boolean NOT NULL DEFAULT true,
  referral_bonus_stamps int NOT NULL DEFAULT 1 CHECK (referral_bonus_stamps BETWEEN 0 AND 5),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.retention_settings TO authenticated;
GRANT ALL ON public.retention_settings TO service_role;
ALTER TABLE public.retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read retention settings"
  ON public.retention_settings FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "managers write retention settings"
  ON public.retention_settings FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_retention_settings_updated_at
BEFORE UPDATE ON public.retention_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ------------------------------------------------------------
-- 2) retention_dispatches
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retention_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('birthday','reengagement','reward_expiring','tier_up','broadcast')),
  channel text NOT NULL CHECK (channel IN ('email','push','both')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_dispatches_est_kind_date
  ON public.retention_dispatches(establishment_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_dispatches_customer_kind
  ON public.retention_dispatches(customer_id, kind, created_at DESC);

GRANT SELECT, INSERT ON public.retention_dispatches TO authenticated;
GRANT ALL ON public.retention_dispatches TO service_role;
ALTER TABLE public.retention_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read retention dispatches"
  ON public.retention_dispatches FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "service inserts retention dispatches"
  ON public.retention_dispatches FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- ------------------------------------------------------------
-- 3) retention_events (tier_up etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('tier_up','tier_down','referral_signup','referral_reward','birthday_sent','reengagement_sent')),
  from_value text,
  to_value text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_events_customer_date
  ON public.retention_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retention_events_est_type_date
  ON public.retention_events(establishment_id, event_type, created_at DESC);

GRANT SELECT, INSERT ON public.retention_events TO authenticated;
GRANT ALL ON public.retention_events TO service_role;
ALTER TABLE public.retention_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read retention events"
  ON public.retention_events FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

-- ------------------------------------------------------------
-- 4) push_subscriptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  preferences jsonb NOT NULL DEFAULT '{"stamp":true,"reward":true,"campaign":true,"birthday":true}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  CONSTRAINT push_subscriptions_owner_chk CHECK (customer_id IS NOT NULL OR user_id IS NOT NULL),
  CONSTRAINT push_subscriptions_endpoint_unq UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_customer ON public.push_subscriptions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subs_est_active ON public.push_subscriptions(establishment_id) WHERE active = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO anon; -- clientes finais gerenciam via token
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- User logado gerencia suas próprias
CREATE POLICY "user manages own push subs"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Members do estabelecimento leem inscrições de seus clientes (para broadcast)
CREATE POLICY "members read customer push subs"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (establishment_id IS NOT NULL AND public.has_establishment_access(auth.uid(), establishment_id));

-- Cliente final (não autenticado) só cria/gerencia via server function que valida o access_token do cartão
-- Nenhuma policy para anon além do que fluxos server-side com service_role fazem.

CREATE TRIGGER trg_push_subs_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ------------------------------------------------------------
-- 5) push_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  url text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','expired')),
  status_code int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_logs_est_date ON public.push_logs(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_logs_customer ON public.push_logs(customer_id, created_at DESC);

GRANT SELECT ON public.push_logs TO authenticated;
GRANT ALL ON public.push_logs TO service_role;
ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read push logs"
  ON public.push_logs FOR SELECT TO authenticated
  USING (establishment_id IS NOT NULL AND public.has_establishment_access(auth.uid(), establishment_id));

-- ------------------------------------------------------------
-- 6) customers: tier, referral_code, referred_by
-- ------------------------------------------------------------
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tier public.customer_tier NOT NULL DEFAULT 'bronze';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referral_code text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_est_referral
  ON public.customers(establishment_id, referral_code) WHERE referral_code IS NOT NULL;

-- Preenche referral_code para linhas existentes
UPDATE public.customers
   SET referral_code = upper(substr(md5(id::text || establishment_id::text), 1, 6))
 WHERE referral_code IS NULL;

-- Função helper: computa tier a partir de nº de visitas e thresholds
CREATE OR REPLACE FUNCTION public.compute_tier(_visits int, _thresholds jsonb)
RETURNS public.customer_tier
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  t public.customer_tier := 'bronze';
BEGIN
  IF _visits >= COALESCE((_thresholds->>'diamante')::int, 50) THEN RETURN 'diamante'; END IF;
  IF _visits >= COALESCE((_thresholds->>'ouro')::int, 25) THEN RETURN 'ouro'; END IF;
  IF _visits >= COALESCE((_thresholds->>'prata')::int, 10) THEN RETURN 'prata'; END IF;
  RETURN 'bronze';
END; $$;

-- Trigger: ao inserir carimbo (não revertido), recalcula tier e loga evento se mudou.
CREATE OR REPLACE FUNCTION public.tg_recompute_tier_after_stamp()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_est_id uuid;
  v_visits int;
  v_from public.customer_tier;
  v_to public.customer_tier;
  v_thresholds jsonb;
BEGIN
  IF NEW.reverted_at IS NOT NULL THEN RETURN NEW; END IF;

  SELECT c.id, c.establishment_id, c.tier, COALESCE(c.visits_count, 0)
    INTO v_customer_id, v_est_id, v_from, v_visits
    FROM public.loyalty_cards lc
    JOIN public.customers c ON c.id = lc.customer_id
   WHERE lc.id = NEW.card_id;

  IF v_customer_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(tier_thresholds, '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb)
    INTO v_thresholds
    FROM public.retention_settings WHERE establishment_id = v_est_id;
  v_thresholds := COALESCE(v_thresholds, '{"bronze":0,"prata":10,"ouro":25,"diamante":50}'::jsonb);

  v_to := public.compute_tier(v_visits, v_thresholds);

  IF v_to <> v_from THEN
    UPDATE public.customers SET tier = v_to, updated_at = now() WHERE id = v_customer_id;
    INSERT INTO public.retention_events (establishment_id, customer_id, event_type, from_value, to_value)
    VALUES (v_est_id, v_customer_id,
            CASE WHEN v_to::text > v_from::text THEN 'tier_up' ELSE 'tier_down' END,
            v_from::text, v_to::text);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_stamps_recompute_tier ON public.stamps;
CREATE TRIGGER trg_stamps_recompute_tier
AFTER INSERT ON public.stamps
FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_tier_after_stamp();
