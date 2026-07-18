
-- 1) Add columns to establishments
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS segment text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2) Add columns to establishment_members
ALTER TABLE public.establishment_members
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS last_pin_used_at timestamptz;

-- 3) establishment_settings (one row per est, JSONB per section)
CREATE TABLE IF NOT EXISTS public.establishment_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  privacy jsonb NOT NULL DEFAULT '{"require_consent":true,"policy_text":"","retention_days":730,"default_marketing_opt_in":false}'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{"channels":{"email":true,"whatsapp":false},"events":{"new_stamp":true,"reward_ready":true,"birthday":false,"inactive_customer":false},"inactive_days":60}'::jsonb,
  appearance jsonb NOT NULL DEFAULT '{"card_shape":"rounded","logo_shape":"circle","stamp_icon":"star","font":"inter"}'::jsonb,
  card jsonb NOT NULL DEFAULT '{"program_name":"Programa Fidelidade","default_stamps_required":10,"default_reward":"Brinde especial","stamp_validity_days":180,"back_text":"","post_reward_message":"Obrigado por participar!"}'::jsonb,
  security jsonb NOT NULL DEFAULT '{"require_pin_to_stamp":false,"session_timeout_minutes":0,"two_factor_required":false}'::jsonb,
  billing_prefs jsonb NOT NULL DEFAULT '{"invoice_email":"","tax_id":"","address":""}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.establishment_settings TO authenticated;
GRANT ALL ON public.establishment_settings TO service_role;
ALTER TABLE public.establishment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_member_read ON public.establishment_settings FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY settings_manager_write ON public.establishment_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY settings_manager_update ON public.establishment_settings FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.establishment_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 4) team_invites
CREATE TABLE IF NOT EXISTS public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  email text NOT NULL,
  role member_role NOT NULL DEFAULT 'staff',
  token text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_invites_est_idx ON public.team_invites(establishment_id);
CREATE INDEX IF NOT EXISTS team_invites_email_idx ON public.team_invites(lower(email));
GRANT SELECT, INSERT, UPDATE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY invites_manager_read ON public.team_invites FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY invites_manager_write ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY invites_manager_update ON public.team_invites FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- 5) notification_templates
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  subject text,
  body text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, event, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY tpl_member_read ON public.notification_templates FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY tpl_manager_write ON public.notification_templates FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE TRIGGER trg_tpl_updated BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 6) data_requests (LGPD)
CREATE TABLE IF NOT EXISTS public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_phone text,
  kind text NOT NULL CHECK (kind IN ('export','delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  result_url text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_requests_est_idx ON public.data_requests(establishment_id);
GRANT SELECT, INSERT, UPDATE ON public.data_requests TO authenticated;
GRANT ALL ON public.data_requests TO service_role;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY dr_manager_read ON public.data_requests FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY dr_manager_write ON public.data_requests FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY dr_manager_update ON public.data_requests FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- 7) subscriptions (structural, phase 2 will wire providers)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  tier plan_tier NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trial','active','past_due','canceled','paused')),
  provider text,
  external_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  trial_ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_member_read ON public.subscriptions FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 8) coupons (structural)
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_pct numeric(5,2),
  discount_amount numeric(10,2),
  plan_tier plan_tier,
  valid_from timestamptz,
  valid_until timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY coupons_admin_all ON public.coupons FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- 9) webhooks + deliveries
CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhooks_manager_all ON public.webhooks FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE TRIGGER trg_webhooks_updated BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  status_code integer,
  ok boolean NOT NULL DEFAULT false,
  payload jsonb,
  response text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY wd_manager_read ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.webhooks w
    WHERE w.id = webhook_deliveries.webhook_id
    AND public.has_establishment_role(auth.uid(), w.establishment_id, 'manager')));

-- 10) api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  prefix text NOT NULL,
  key_hash text NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY apik_manager_read ON public.api_keys FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY apik_manager_write ON public.api_keys FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY apik_manager_update ON public.api_keys FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- 11) payment_provider_credentials (structural, values encrypted server-side)
CREATE TABLE IF NOT EXISTS public.payment_provider_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('asaas','mercadopago','paghiper','stripe')),
  credentials_ciphertext text,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, provider)
);
GRANT SELECT ON public.payment_provider_credentials TO authenticated;
GRANT ALL ON public.payment_provider_credentials TO service_role;
ALTER TABLE public.payment_provider_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY ppc_manager_read ON public.payment_provider_credentials FOR SELECT TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'owner'));
CREATE TRIGGER trg_ppc_updated BEFORE UPDATE ON public.payment_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 12) Seed default subscription row for existing establishments
INSERT INTO public.subscriptions (establishment_id, tier, status)
SELECT e.id, e.plan, 'active' FROM public.establishments e
ON CONFLICT (establishment_id) DO NOTHING;

-- 13) Seed default settings row for existing establishments
INSERT INTO public.establishment_settings (establishment_id)
SELECT id FROM public.establishments
ON CONFLICT (establishment_id) DO NOTHING;
