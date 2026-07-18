
-- 1) payment_settings (singleton com metadados; credenciais ficam em secrets)
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  public_key text,
  webhook_url text,
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin manages payment_settings" ON public.payment_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_payment_settings_updated BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- singleton bootstrap row
INSERT INTO public.payment_settings (environment) VALUES ('production');

-- 2) payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  plan_slug text,
  mp_payment_id text UNIQUE,
  mp_order_id text,
  mp_preference_id text,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  method text NOT NULL CHECK (method IN ('pix','credit_card','boleto')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_process','approved','authorized','rejected','cancelled','refunded','charged_back')),
  status_detail text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_copy_paste text,
  pix_expires_at timestamptz,
  boleto_url text,
  receipt_url text,
  card_last4 text,
  card_brand text,
  installments int,
  payer_email text,
  payer_doc text,
  idempotency_key text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own payments" ON public.payments FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "owners insert own payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'owner'));

CREATE POLICY "super admin manages payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE INDEX idx_payments_establishment ON public.payments(establishment_id, created_at DESC);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_mp_payment_id ON public.payments(mp_payment_id);

CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 3) subscriptions: adicionar colunas Mercado Pago
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS mp_customer_id text,
  ADD COLUMN IF NOT EXISTS mp_subscription_id text,
  ADD COLUMN IF NOT EXISTS mp_last_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS next_billing_date timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

-- Recria coluna status como TEXT com CHECK amplo (evita quebrar enum existente).
-- Se já for text mantém; se for enum, criamos coluna auxiliar.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='subscriptions' AND column_name='status') = 'USER-DEFINED' THEN
    ALTER TABLE public.subscriptions ADD COLUMN status_new text;
    UPDATE public.subscriptions SET status_new = status::text;
    ALTER TABLE public.subscriptions DROP COLUMN status;
    ALTER TABLE public.subscriptions RENAME COLUMN status_new TO status;
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trial','active','pending','awaiting_payment','past_due','cancelled','suspended','incomplete'));

-- 4) payment_logs (idempotência + auditoria de webhooks)
CREATE TABLE public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  mp_resource text,
  mp_id text,
  action text,
  live_mode boolean,
  signature_valid boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  error text,
  payload jsonb,
  headers jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads payment_logs" ON public.payment_logs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
CREATE INDEX idx_payment_logs_mp_id ON public.payment_logs(mp_resource, mp_id);
CREATE INDEX idx_payment_logs_created ON public.payment_logs(created_at DESC);
