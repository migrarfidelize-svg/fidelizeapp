-- =====================================================================
-- MÓDULO: Destaque Patrocinado (Sponsored Ads) — Fase 1
-- =====================================================================

-- ---------- 1. PACOTES ----------
CREATE TABLE public.sponsored_ad_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_days integer NOT NULL CHECK (duration_days > 0 AND duration_days <= 365),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT ON public.sponsored_ad_packages TO authenticated;
GRANT ALL ON public.sponsored_ad_packages TO service_role;
ALTER TABLE public.sponsored_ad_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_packages_read_active_authenticated"
  ON public.sponsored_ad_packages FOR SELECT TO authenticated
  USING (is_active = true OR public.is_super_admin(auth.uid()));

CREATE POLICY "ads_packages_admin_all"
  ON public.sponsored_ad_packages FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_ads_packages_updated_at
  BEFORE UPDATE ON public.sponsored_ad_packages
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ---------- 2. CONFIGURAÇÕES GLOBAIS (singleton) ----------
CREATE TABLE public.sponsored_ad_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  max_ads_per_category integer NOT NULL DEFAULT 3 CHECK (max_ads_per_category BETWEEN 1 AND 10),
  impression_dedupe_minutes integer NOT NULL DEFAULT 30 CHECK (impression_dedupe_minutes BETWEEN 1 AND 1440),
  click_dedupe_minutes integer NOT NULL DEFAULT 5 CHECK (click_dedupe_minutes BETWEEN 1 AND 1440),
  max_impressions_per_session_24h integer NOT NULL DEFAULT 3 CHECK (max_impressions_per_session_24h BETWEEN 1 AND 50),
  allowed_categories text[] NOT NULL DEFAULT ARRAY['alimentacao','beleza','saude','moda','fitness','pet','servicos','lazer','outros'],
  default_gateway text NOT NULL DEFAULT 'mercadopago' CHECK (default_gateway IN ('mercadopago','asaas')),
  pix_expiration_minutes integer NOT NULL DEFAULT 30 CHECK (pix_expiration_minutes BETWEEN 5 AND 1440),
  allow_self_pause boolean NOT NULL DEFAULT true,
  self_pause_extends_period boolean NOT NULL DEFAULT false,
  advertiser_terms text NOT NULL DEFAULT 'Ao enviar um anúncio você declara que o conteúdo é verdadeiro, próprio ou licenciado, e que não viola leis, direitos de terceiros ou a política de conteúdo da Fidelize. Anúncios enganosos, ofensivos, adultos, políticos, discriminatórios ou com ofertas inexistentes serão rejeitados sem reembolso.',
  advertiser_terms_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.sponsored_ad_settings TO authenticated;
GRANT ALL ON public.sponsored_ad_settings TO service_role;
ALTER TABLE public.sponsored_ad_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_settings_read_authenticated"
  ON public.sponsored_ad_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "ads_settings_admin_write"
  ON public.sponsored_ad_settings FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.sponsored_ad_settings (id) VALUES (true);

-- ---------- 3. CAMPANHAS ----------
CREATE TABLE public.sponsored_ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.sponsored_ad_packages(id) ON DELETE SET NULL,
  category_id text NOT NULL CHECK (category_id IN ('alimentacao','beleza','saude','moda','fitness','pet','servicos','lazer','outros')),

  title text NOT NULL DEFAULT '' CHECK (char_length(title) <= 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 140),
  image_path text,
  image_source text NOT NULL DEFAULT 'upload' CHECK (image_source IN ('upload','logo','cover')),
  cta_label text NOT NULL DEFAULT 'Saiba mais' CHECK (cta_label IN (
    'Conhecer estabelecimento','Ver oferta','Ver catálogo','Ver cardápio','Ver benefícios','Saiba mais'
  )),
  destination_type text NOT NULL DEFAULT 'establishment' CHECK (destination_type IN ('establishment','catalog','menu','linktree','loyalty_card')),
  destination_slug text NOT NULL DEFAULT '',

  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_review','changes_requested','approved_awaiting_payment','payment_pending',
    'payment_confirmed','scheduled','active','paused','expired','rejected','cancelled',
    'refund_pending','refunded'
  )),

  requested_start_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  paused_at timestamptz,
  pause_origin text,
  pause_reason text,
  total_paused_seconds integer NOT NULL DEFAULT 0,

  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  rejection_reason text,
  changes_requested_reason text,

  is_courtesy boolean NOT NULL DEFAULT false,
  courtesy_reason text,

  package_name_snapshot text,
  duration_days_snapshot integer,
  price_cents_snapshot integer,
  currency_snapshot text,
  settings_snapshot jsonb,

  terms_accepted_at timestamptz,
  terms_version integer,
  terms_accepted_by uuid,

  tracking_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex') UNIQUE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsored_ad_campaigns TO authenticated;
GRANT ALL ON public.sponsored_ad_campaigns TO service_role;
ALTER TABLE public.sponsored_ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ads_campaigns_est_status ON public.sponsored_ad_campaigns (establishment_id, status, created_at DESC);
CREATE INDEX idx_ads_campaigns_status ON public.sponsored_ad_campaigns (status);
CREATE INDEX idx_ads_campaigns_rotation ON public.sponsored_ad_campaigns (category_id, starts_at, ends_at) WHERE status = 'active';
CREATE INDEX idx_ads_campaigns_scheduling ON public.sponsored_ad_campaigns (starts_at) WHERE status IN ('scheduled','active');

CREATE POLICY "ads_campaigns_select_own"
  ON public.sponsored_ad_campaigns FOR SELECT TO authenticated
  USING (public.member_can(auth.uid(), establishment_id, 'ads.manage') OR public.is_super_admin(auth.uid()));

CREATE POLICY "ads_campaigns_insert_own_draft"
  ON public.sponsored_ad_campaigns FOR INSERT TO authenticated
  WITH CHECK (
    status = 'draft'
    AND public.member_can(auth.uid(), establishment_id, 'ads.manage')
  );

CREATE POLICY "ads_campaigns_update_editable"
  ON public.sponsored_ad_campaigns FOR UPDATE TO authenticated
  USING (
    status IN ('draft','changes_requested')
    AND public.member_can(auth.uid(), establishment_id, 'ads.manage')
  )
  WITH CHECK (
    status IN ('draft','changes_requested')
    AND public.member_can(auth.uid(), establishment_id, 'ads.manage')
  );

CREATE POLICY "ads_campaigns_delete_draft"
  ON public.sponsored_ad_campaigns FOR DELETE TO authenticated
  USING (
    status = 'draft'
    AND public.member_can(auth.uid(), establishment_id, 'ads.manage')
  );

CREATE TRIGGER trg_ads_campaigns_updated_at
  BEFORE UPDATE ON public.sponsored_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE OR REPLACE FUNCTION public.tg_sponsored_ad_campaign_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'draft';
    NEW.starts_at := NULL;
    NEW.ends_at := NULL;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_by := NULL;
    NEW.is_courtesy := false;
    NEW.price_cents_snapshot := NULL;
    NEW.duration_days_snapshot := NULL;
    NEW.package_name_snapshot := NULL;
    NEW.currency_snapshot := NULL;
    NEW.settings_snapshot := NULL;
    NEW.total_paused_seconds := 0;
    NEW.paused_at := NULL;
    NEW.submitted_at := NULL;
    NEW.terms_accepted_at := NULL;
    NEW.terms_version := NULL;
    NEW.terms_accepted_by := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.establishment_id IS DISTINCT FROM OLD.establishment_id
     OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
     OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
     OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.changes_requested_reason IS DISTINCT FROM OLD.changes_requested_reason
     OR NEW.price_cents_snapshot IS DISTINCT FROM OLD.price_cents_snapshot
     OR NEW.duration_days_snapshot IS DISTINCT FROM OLD.duration_days_snapshot
     OR NEW.package_name_snapshot IS DISTINCT FROM OLD.package_name_snapshot
     OR NEW.currency_snapshot IS DISTINCT FROM OLD.currency_snapshot
     OR NEW.settings_snapshot IS DISTINCT FROM OLD.settings_snapshot
     OR NEW.is_courtesy IS DISTINCT FROM OLD.is_courtesy
     OR NEW.paused_at IS DISTINCT FROM OLD.paused_at
     OR NEW.total_paused_seconds IS DISTINCT FROM OLD.total_paused_seconds
     OR NEW.tracking_token IS DISTINCT FROM OLD.tracking_token
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at
     OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
  THEN
    RAISE EXCEPTION 'Alteração não permitida: status, período, preço e aprovação são controlados pelo servidor.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_sponsored_ad_campaign_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ads_campaigns_guard
  BEFORE INSERT OR UPDATE ON public.sponsored_ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_sponsored_ad_campaign_guard();

-- ---------- 4. PEDIDOS (pagamento avulso) ----------
CREATE TABLE public.sponsored_ad_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sponsored_ad_campaigns(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  gateway text NOT NULL CHECK (gateway IN ('mercadopago','asaas')),
  payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix')),
  external_payment_id text,
  idempotency_key text NOT NULL UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled','refunded','failed')),
  pix_code text,
  pix_qr_code text,
  pix_expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  gateway_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsored_ad_orders TO authenticated;
GRANT ALL ON public.sponsored_ad_orders TO service_role;
ALTER TABLE public.sponsored_ad_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ads_orders_campaign ON public.sponsored_ad_orders (campaign_id, created_at DESC);
CREATE INDEX idx_ads_orders_external ON public.sponsored_ad_orders (gateway, external_payment_id);
CREATE INDEX idx_ads_orders_status ON public.sponsored_ad_orders (status);

CREATE POLICY "ads_orders_select_own"
  ON public.sponsored_ad_orders FOR SELECT TO authenticated
  USING (public.member_can(auth.uid(), establishment_id, 'ads.manage') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_ads_orders_updated_at
  BEFORE UPDATE ON public.sponsored_ad_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ---------- 5. EVENTOS (append-only, sem PII) ----------
CREATE TABLE public.sponsored_ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sponsored_ad_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  session_hash text NOT NULL,
  viewer_user_id uuid,
  category_id text,
  placement text NOT NULL DEFAULT 'wallet_discover',
  dedupe_bucket text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsored_ad_events_dedupe_uk UNIQUE (campaign_id, event_type, session_hash, dedupe_bucket)
);

GRANT ALL ON public.sponsored_ad_events TO service_role;
ALTER TABLE public.sponsored_ad_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ads_events_campaign_date ON public.sponsored_ad_events (campaign_id, occurred_at DESC);

CREATE TRIGGER trg_ads_events_immutable
  BEFORE UPDATE OR DELETE ON public.sponsored_ad_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

-- ---------- 6. MÉTRICAS DIÁRIAS ----------
CREATE TABLE public.sponsored_ad_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sponsored_ad_campaigns(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  unique_impressions integer NOT NULL DEFAULT 0,
  unique_clicks integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sponsored_ad_daily_metrics_uk UNIQUE (campaign_id, metric_date)
);

GRANT SELECT ON public.sponsored_ad_daily_metrics TO authenticated;
GRANT ALL ON public.sponsored_ad_daily_metrics TO service_role;
ALTER TABLE public.sponsored_ad_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_metrics_select_own"
  ON public.sponsored_ad_daily_metrics FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.sponsored_ad_campaigns c
      WHERE c.id = sponsored_ad_daily_metrics.campaign_id
        AND public.member_can(auth.uid(), c.establishment_id, 'ads.manage')
    )
  );

-- ---------- 7. HISTÓRICO DE MODERAÇÃO ----------
CREATE TABLE public.sponsored_ad_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.sponsored_ad_campaigns(id) ON DELETE CASCADE,
  admin_user_id uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  note text,
  creative_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sponsored_ad_reviews TO authenticated;
GRANT ALL ON public.sponsored_ad_reviews TO service_role;
ALTER TABLE public.sponsored_ad_reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_ads_reviews_campaign ON public.sponsored_ad_reviews (campaign_id, created_at DESC);

CREATE POLICY "ads_reviews_select_scoped"
  ON public.sponsored_ad_reviews FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.sponsored_ad_campaigns c
      WHERE c.id = sponsored_ad_reviews.campaign_id
        AND public.member_can(auth.uid(), c.establishment_id, 'ads.manage')
    )
  );

CREATE TRIGGER trg_ads_reviews_immutable
  BEFORE UPDATE OR DELETE ON public.sponsored_ad_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_block_mutation();

-- ---------- 8. PACOTES INICIAIS ----------
INSERT INTO public.sponsored_ad_packages (name, description, duration_days, price_cents, display_order)
VALUES
  ('Destaque 7 dias',  'Uma semana de destaque na vitrine Descobrir.', 7,  4900,  1),
  ('Destaque 15 dias', 'Quinze dias de destaque na vitrine Descobrir.', 15, 8900,  2),
  ('Destaque 30 dias', 'Um mês inteiro de destaque na vitrine Descobrir.', 30, 14900, 3);

-- ---------- 9. POLICIES DO BUCKET DE CRIATIVOS ----------
CREATE POLICY "ads_creatives_member_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sponsored-ads'
    AND public.member_can(auth.uid(), public.menu_storage_est_id(name), 'ads.manage')
  );

CREATE POLICY "ads_creatives_member_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sponsored-ads'
    AND public.member_can(auth.uid(), public.menu_storage_est_id(name), 'ads.manage')
  );

CREATE POLICY "ads_creatives_member_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sponsored-ads'
    AND public.member_can(auth.uid(), public.menu_storage_est_id(name), 'ads.manage')
  );
