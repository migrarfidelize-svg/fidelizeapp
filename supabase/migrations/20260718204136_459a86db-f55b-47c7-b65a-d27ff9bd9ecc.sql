
-- =========== 1) Extend plans ===========
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS price_yearly numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS customer_limit integer,
  ADD COLUMN IF NOT EXISTS employee_limit integer,
  ADD COLUMN IF NOT EXISTS campaign_limit integer,
  ADD COLUMN IF NOT EXISTS unit_limit integer,
  ADD COLUMN IF NOT EXISTS active_card_limit integer,
  ADD COLUMN IF NOT EXISTS stamp_limit integer,
  ADD COLUMN IF NOT EXISTS email_limit integer,
  ADD COLUMN IF NOT EXISTS storage_limit_mb integer,
  ADD COLUMN IF NOT EXISTS ticket_limit integer,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS button_text text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.plans SET
  customer_limit = COALESCE(customer_limit, max_customers),
  employee_limit = COALESCE(employee_limit, max_staff),
  campaign_limit = COALESCE(campaign_limit, max_campaigns);

UPDATE public.plans SET slug = tier::text WHERE slug IS NULL;
ALTER TABLE public.plans ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plans_slug_uidx ON public.plans (slug);

DROP TRIGGER IF EXISTS plans_updated_at ON public.plans;
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- =========== 2) plan_features ===========
CREATE TABLE IF NOT EXISTS public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  feature_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  limit_value integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);

GRANT SELECT ON public.plan_features TO anon, authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_features read" ON public.plan_features;
CREATE POLICY "plan_features read" ON public.plan_features FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_features admin write" ON public.plan_features;
CREATE POLICY "plan_features admin write" ON public.plan_features FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans read" ON public.plans;
CREATE POLICY "plans read" ON public.plans FOR SELECT USING (true);
DROP POLICY IF EXISTS "plans admin write" ON public.plans;
CREATE POLICY "plans admin write" ON public.plans FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- =========== 3) Seed initial plans (upsert by tier) ===========
INSERT INTO public.plans (tier, slug, name, description, price_monthly, customer_limit, employee_limit, campaign_limit, is_active, is_featured, display_order, button_text, features, max_customers, max_staff, max_campaigns)
VALUES ('starter','essencial','Essencial','Para pequenos negócios que estão começando a fidelizar seus clientes.',14.90, 10, 1, 1, true, false, 1, 'Assinar Essencial', '{}'::jsonb, 10, 1, 1)
ON CONFLICT (tier) DO UPDATE SET
  slug='essencial', name=EXCLUDED.name, description=EXCLUDED.description, price_monthly=EXCLUDED.price_monthly,
  customer_limit=EXCLUDED.customer_limit, employee_limit=EXCLUDED.employee_limit,
  campaign_limit=EXCLUDED.campaign_limit, is_active=true, display_order=EXCLUDED.display_order,
  button_text=EXCLUDED.button_text, updated_at=now();

INSERT INTO public.plans (tier, slug, name, description, price_monthly, customer_limit, employee_limit, campaign_limit, is_active, is_featured, display_order, button_text, features, max_customers, max_staff, max_campaigns)
VALUES ('pro','profissional','Profissional','Para empresas que desejam crescer e acompanhar melhor seus resultados.',29.90, 300, 3, 3, true, true, 2, 'Assinar Profissional', '{}'::jsonb, 300, 3, 3)
ON CONFLICT (tier) DO UPDATE SET
  slug='profissional', name=EXCLUDED.name, description=EXCLUDED.description, price_monthly=EXCLUDED.price_monthly,
  customer_limit=EXCLUDED.customer_limit, employee_limit=EXCLUDED.employee_limit,
  campaign_limit=EXCLUDED.campaign_limit, is_active=true, is_featured=true,
  display_order=EXCLUDED.display_order, button_text=EXCLUDED.button_text, updated_at=now();

INSERT INTO public.plans (tier, slug, name, description, price_monthly, customer_limit, employee_limit, campaign_limit, is_active, is_featured, display_order, button_text, features, max_customers, max_staff, max_campaigns)
VALUES ('enterprise','ilimitado','Ilimitado','Para empresas que precisam de liberdade total para crescer sem limites.',99.90, NULL, NULL, NULL, true, false, 3, 'Assinar Ilimitado', '{}'::jsonb, NULL, NULL, NULL)
ON CONFLICT (tier) DO UPDATE SET
  slug='ilimitado', name=EXCLUDED.name, description=EXCLUDED.description, price_monthly=EXCLUDED.price_monthly,
  customer_limit=NULL, employee_limit=NULL, campaign_limit=NULL, is_active=true,
  display_order=EXCLUDED.display_order, button_text=EXCLUDED.button_text, updated_at=now();

UPDATE public.plans SET is_active=false, archived_at=COALESCE(archived_at,now()) WHERE tier='free';

-- =========== 4) Features seed ===========
DO $seed$
DECLARE
  p_ess uuid; p_pro uuid; p_ilim uuid;
  feats_ess jsonb := '[
    ["dashboard","Dashboard básico"],["customers","Cadastro de clientes"],
    ["loyalty_card","Cartão fidelidade digital"],["qrcode","QR Code"],
    ["stamps","Carimbos"],["rewards","Recompensas"],
    ["campaigns","Campanhas (1)"],["support_ticket","Suporte por ticket"]
  ]'::jsonb;
  feats_pro jsonb := '[
    ["dashboard","Dashboard"],["customers","Cadastro de clientes"],
    ["loyalty_card","Cartão fidelidade digital"],["qrcode","QR Code"],
    ["stamps","Carimbos"],["rewards","Recompensas"],
    ["campaigns","Até 3 campanhas"],["employees","Até 3 funcionários"],
    ["reports","Relatórios"],["export","Exportação de clientes"],
    ["branding","Personalização da identidade visual"],
    ["email_notifications","Notificações por e-mail"],
    ["history","Histórico completo"],["support_ticket","Suporte por ticket"]
  ]'::jsonb;
  feats_ilim jsonb := '[
    ["dashboard","Dashboard"],["customers","Clientes ilimitados"],
    ["loyalty_card","Cartão fidelidade digital"],["qrcode","QR Code"],
    ["stamps","Carimbos"],["rewards","Recompensas"],
    ["campaigns","Campanhas ilimitadas"],["employees","Funcionários ilimitados"],
    ["reports","Relatórios"],["advanced_reports","Relatórios avançados"],
    ["export","Exportação de dados"],["branding","Personalização da identidade visual"],
    ["custom_domain","Domínio personalizado"],["email_notifications","Notificações por e-mail"],
    ["auto_campaigns","Campanhas automáticas"],["multi_units","Múltiplas unidades"],
    ["custom_permissions","Permissões personalizadas"],["audit","Auditoria"],
    ["api","API"],["webhooks","Webhooks"],["integrations","Integrações"],
    ["priority_support","Suporte prioritário"]
  ]'::jsonb;
  item jsonb;
BEGIN
  SELECT id INTO p_ess FROM public.plans WHERE slug='essencial';
  SELECT id INTO p_pro FROM public.plans WHERE slug='profissional';
  SELECT id INTO p_ilim FROM public.plans WHERE slug='ilimitado';

  FOR item IN SELECT jsonb_array_elements(feats_ess) LOOP
    INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
    VALUES (p_ess, item->>0, item->>1, true)
    ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_name=EXCLUDED.feature_name, enabled=true;
  END LOOP;
  FOR item IN SELECT jsonb_array_elements(feats_pro) LOOP
    INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
    VALUES (p_pro, item->>0, item->>1, true)
    ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_name=EXCLUDED.feature_name, enabled=true;
  END LOOP;
  FOR item IN SELECT jsonb_array_elements(feats_ilim) LOOP
    INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
    VALUES (p_ilim, item->>0, item->>1, true)
    ON CONFLICT (plan_id, feature_key) DO UPDATE SET feature_name=EXCLUDED.feature_name, enabled=true;
  END LOOP;
END $seed$;

-- =========== 5) Helpers ===========
CREATE OR REPLACE FUNCTION public.get_establishment_plan(_est uuid)
RETURNS public.plans
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.plans p
  JOIN public.establishments e ON e.id = _est
  WHERE p.tier = e.plan
  ORDER BY p.is_active DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_plan_feature(_est uuid, _feature text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT pf.enabled FROM public.plan_features pf
    JOIN public.plans p ON p.id = pf.plan_id
    JOIN public.establishments e ON e.id = _est
    WHERE p.tier = e.plan AND pf.feature_key = _feature
    LIMIT 1
  ), false)
$$;

REVOKE EXECUTE ON FUNCTION public.get_establishment_plan(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_plan_feature(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_establishment_plan(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_plan_feature(uuid, text) TO authenticated, service_role;
