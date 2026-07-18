
-- ENUMS
CREATE TYPE public.member_role AS ENUM ('owner','manager','staff');
CREATE TYPE public.campaign_type AS ENUM ('stamps','points');
CREATE TYPE public.plan_tier AS ENUM ('free','starter','pro','enterprise');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT, avatar_url TEXT, phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_write" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.tg_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ESTABLISHMENTS
CREATE TABLE public.establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT, address TEXT, phone TEXT, whatsapp TEXT, instagram TEXT, email TEXT,
  business_hours TEXT, logo_url TEXT, cover_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#5B21B6',
  accent_color TEXT NOT NULL DEFAULT '#F97066',
  theme TEXT NOT NULL DEFAULT 'light',
  plan public.plan_tier NOT NULL DEFAULT 'free',
  active BOOLEAN NOT NULL DEFAULT true,
  average_ticket NUMERIC(10,2),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.establishments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishments TO authenticated;
GRANT ALL ON public.establishments TO service_role;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER est_updated BEFORE UPDATE ON public.establishments FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- MEMBERS
CREATE TABLE public.establishment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'staff',
  invited_email TEXT, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_members TO authenticated;
GRANT ALL ON public.establishment_members TO service_role;
ALTER TABLE public.establishment_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_establishment_access(_user UUID, _est UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.establishment_members
                 WHERE user_id = _user AND establishment_id = _est AND active = true);
$$;
CREATE OR REPLACE FUNCTION public.has_establishment_role(_user UUID, _est UUID, _min_role public.member_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true
    AND (
      _min_role = 'staff'
      OR (_min_role = 'manager' AND role IN ('manager','owner'))
      OR (_min_role = 'owner'   AND role = 'owner')
    )
  );
$$;

CREATE POLICY "est_public_read" ON public.establishments FOR SELECT TO anon USING (active = true);
CREATE POLICY "est_auth_read" ON public.establishments FOR SELECT TO authenticated USING (active = true OR public.has_establishment_access(auth.uid(), id));
CREATE POLICY "est_owner_insert" ON public.establishments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "est_owner_update" ON public.establishments FOR UPDATE TO authenticated USING (public.has_establishment_role(auth.uid(), id, 'owner'));
CREATE POLICY "est_owner_delete" ON public.establishments FOR DELETE TO authenticated USING (public.has_establishment_role(auth.uid(), id, 'owner'));

CREATE POLICY "members_self_read" ON public.establishment_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY "members_insert" ON public.establishment_members FOR INSERT TO authenticated WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'owner') OR (user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "members_update" ON public.establishment_members FOR UPDATE TO authenticated USING (public.has_establishment_role(auth.uid(), establishment_id, 'owner'));
CREATE POLICY "members_delete" ON public.establishment_members FOR DELETE TO authenticated USING (public.has_establishment_role(auth.uid(), establishment_id, 'owner'));

-- CAMPAIGNS
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.campaign_type NOT NULL DEFAULT 'stamps',
  stamps_required INT NOT NULL DEFAULT 10 CHECK (stamps_required BETWEEN 2 AND 50),
  reward_title TEXT NOT NULL,
  reward_description TEXT, rules TEXT,
  stamp_icon TEXT NOT NULL DEFAULT 'coffee',
  stamp_validity_days INT, reward_validity_days INT DEFAULT 60,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER camp_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE POLICY "camp_public_read" ON public.campaigns FOR SELECT TO anon USING (active = true);
CREATE POLICY "camp_auth_read" ON public.campaigns FOR SELECT TO authenticated USING (active = true OR public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "camp_manager_write" ON public.campaigns FOR ALL TO authenticated USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager')) WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, birthdate DATE,
  code TEXT NOT NULL DEFAULT upper(substring(md5(gen_random_uuid()::text) from 1 for 8)),
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24),'hex'),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  blocked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT, last_visit_at TIMESTAMPTZ,
  visits_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, phone),
  UNIQUE(establishment_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX customers_est_phone ON public.customers(establishment_id, phone);
CREATE INDEX customers_token ON public.customers(access_token);
CREATE TRIGGER cust_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE POLICY "cust_member_read" ON public.customers FOR SELECT TO authenticated USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "cust_staff_insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "cust_staff_update" ON public.customers FOR UPDATE TO authenticated USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "cust_manager_delete" ON public.customers FOR DELETE TO authenticated USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- LOYALTY CARDS
CREATE TABLE public.loyalty_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  stamps INT NOT NULL DEFAULT 0,
  cycle INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(customer_id, campaign_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_cards TO authenticated;
GRANT ALL ON public.loyalty_cards TO service_role;
ALTER TABLE public.loyalty_cards ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER card_updated BEFORE UPDATE ON public.loyalty_cards FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE POLICY "card_member_read" ON public.loyalty_cards FOR SELECT TO authenticated USING (public.has_establishment_access(auth.uid(), establishment_id));

-- STAMPS
CREATE TABLE public.stamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cycle INT NOT NULL,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.stamps TO authenticated;
GRANT ALL ON public.stamps TO service_role;
ALTER TABLE public.stamps ENABLE ROW LEVEL SECURITY;
CREATE INDEX stamps_card_idx ON public.stamps(card_id, created_at DESC);
CREATE POLICY "stamps_member_read" ON public.stamps FOR SELECT TO authenticated USING (public.has_establishment_access(auth.uid(), establishment_id));

-- REWARDS
CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.loyalty_cards(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  cycle INT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE INDEX rewards_card_idx ON public.rewards(card_id, unlocked_at DESC);
CREATE POLICY "rewards_member_read" ON public.rewards FOR SELECT TO authenticated USING (public.has_establishment_access(auth.uid(), establishment_id));

-- AUDIT
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT, entity_id UUID,
  metadata JSONB, ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_est_idx ON public.audit_logs(establishment_id, created_at DESC);
CREATE POLICY "audit_manager_read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- PLANS
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.plan_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_customers INT, max_staff INT, max_campaigns INT,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.plans (tier, name, price_monthly, max_customers, max_staff, max_campaigns, features) VALUES
  ('free',     'Gratuito',   0,     100,  1, 1, '{"branding":true,"exports":false,"reports":"basic"}'::jsonb),
  ('starter',  'Inicial',   49,    1000,  3, 2, '{"branding":true,"exports":true,"reports":"intermediate"}'::jsonb),
  ('pro',      'Profissional', 129, 10000, 10, 5, '{"branding":false,"exports":true,"reports":"advanced","segmentation":true}'::jsonb),
  ('enterprise','Empresarial', 349, NULL, NULL, NULL, '{"branding":false,"exports":true,"reports":"advanced","segmentation":true,"multi_unit":true}'::jsonb);

-- CONSENTS
CREATE TABLE public.consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL DEFAULT '1.0',
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT
);
GRANT SELECT, INSERT ON public.consents TO authenticated;
GRANT ALL ON public.consents TO service_role;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents_member_read" ON public.consents FOR SELECT TO authenticated USING (public.has_establishment_access(auth.uid(), establishment_id));

-- SEED demo establishment (created_by NULL to skip auth.users dependency)
DO $$
DECLARE
  demo_est UUID := '11111111-1111-1111-1111-111111111111';
  demo_camp UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.establishments WHERE id = demo_est) THEN
    INSERT INTO public.establishments (id, slug, name, description, address, phone, whatsapp, instagram, business_hours, primary_color, accent_color, plan, average_ticket)
    VALUES (demo_est, 'cafe-do-centro', 'Café do Centro', 'Café artesanal, grãos selecionados e atendimento acolhedor no coração da cidade.', 'Rua das Flores, 123 — Centro', '(11) 3333-4444', '5511999998888', 'cafedocentro', 'Seg a Sáb, 7h às 20h', '#7C2D12', '#F59E0B', 'pro', 18.50);

    INSERT INTO public.campaigns (id, establishment_id, name, type, stamps_required, reward_title, reward_description, rules, stamp_icon)
    VALUES (demo_camp, demo_est, 'Café Premiado', 'stamps', 10, 'Um café especial grátis', 'Válido para expresso, coado ou cappuccino tradicional.', 'Um carimbo por compra. Recompensa válida por 60 dias após a conquista.', 'coffee');

    INSERT INTO public.customers (establishment_id, name, phone, visits_count, last_visit_at, created_at)
    SELECT demo_est,
      (ARRAY['Ana Silva','Bruno Costa','Carla Santos','Diego Alves','Eduarda Lima','Felipe Rocha','Gabriela Souza','Hugo Martins','Isabela Freitas','João Pereira','Karina Melo','Lucas Nunes','Mariana Dias','Nicolas Ribeiro','Olívia Barros','Pedro Cardoso','Queila Ramos','Rafael Teixeira','Sofia Machado','Thiago Gomes','Ursula Pinto','Vitor Araujo','Wesley Cunha','Ximena Duarte','Yara Moreira','Zeca Correia','Amanda Reis','Bernardo Fonseca','Camila Torres','Daniel Vieira'])[i],
      '11' || lpad((900000000 + i * 1234)::text, 9, '0'),
      (5 + (i % 15))::int,
      now() - ((i % 20) || ' days')::interval,
      now() - ((30 + i) || ' days')::interval
    FROM generate_series(1,30) i;

    INSERT INTO public.loyalty_cards (customer_id, campaign_id, establishment_id, stamps, cycle)
    SELECT c.id, demo_camp, demo_est,
           (row_number() OVER (ORDER BY c.created_at) % 11)::int, 1
    FROM public.customers c WHERE c.establishment_id = demo_est;

    INSERT INTO public.stamps (card_id, establishment_id, cycle, created_at)
    SELECT lc.id, demo_est, 1, now() - ((s * 3) || ' days')::interval
    FROM public.loyalty_cards lc
    CROSS JOIN LATERAL generate_series(1, GREATEST(lc.stamps,1)) s
    WHERE lc.establishment_id = demo_est AND lc.stamps > 0;

    INSERT INTO public.rewards (card_id, campaign_id, establishment_id, cycle, unlocked_at, redeemed_at)
    SELECT lc.id, demo_camp, demo_est, 1, now() - '10 days'::interval, now() - '8 days'::interval
    FROM public.loyalty_cards lc
    WHERE lc.establishment_id = demo_est
    LIMIT 8;
  END IF;
END $$;
