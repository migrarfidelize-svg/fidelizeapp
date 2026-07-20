
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  mode text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_test_status text,
  last_test_message text,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_category_provider_unique UNIQUE (category, provider),
  CONSTRAINT integrations_category_check CHECK (category IN ('ai','payments','email','sms','storage','other')),
  CONSTRAINT integrations_mode_check CHECK (mode IS NULL OR mode IN ('sandbox','production'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_super_admin_select" ON public.integrations
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "integrations_super_admin_insert" ON public.integrations
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "integrations_super_admin_update" ON public.integrations
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "integrations_super_admin_delete" ON public.integrations
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TRIGGER integrations_set_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

INSERT INTO public.integrations (category, provider, enabled, mode, config, credentials_ref)
VALUES (
  'payments','mercadopago', true, 'production',
  jsonb_build_object('managed_by','payment_settings','note','Configuração oficial permanece em /admin/pagamentos'),
  jsonb_build_object(
    'access_token_secret','MERCADOPAGO_ACCESS_TOKEN',
    'webhook_secret','MERCADOPAGO_WEBHOOK_SECRET',
    'public_key_secret','MERCADOPAGO_PUBLIC_KEY'
  )
) ON CONFLICT (category, provider) DO NOTHING;
