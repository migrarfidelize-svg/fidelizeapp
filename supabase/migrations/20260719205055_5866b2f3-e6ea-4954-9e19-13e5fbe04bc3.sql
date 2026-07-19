
CREATE TABLE public.review_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  auto_prompt boolean NOT NULL DEFAULT true,
  prompt_title text NOT NULL DEFAULT 'Como foi seu atendimento?',
  prompt_message text NOT NULL DEFAULT 'Sua opinião nos ajuda a melhorar. Leva menos de 30 segundos!',
  ask_nps boolean NOT NULL DEFAULT false,
  ask_categories boolean NOT NULL DEFAULT true,
  google_place_url text,
  google_redirect_min_rating int NOT NULL DEFAULT 5 CHECK (google_redirect_min_rating BETWEEN 1 AND 5),
  public_page_enabled boolean NOT NULL DEFAULT true,
  thank_you_message text NOT NULL DEFAULT 'Obrigado pelo seu feedback!',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_settings TO authenticated;
GRANT SELECT ON public.review_settings TO anon;
GRANT ALL ON public.review_settings TO service_role;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_settings public read" ON public.review_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "review_settings owner manage" ON public.review_settings FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE TRIGGER trg_review_settings_updated BEFORE UPDATE ON public.review_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  card_id uuid REFERENCES public.loyalty_cards(id) ON DELETE SET NULL,
  stamp_id uuid REFERENCES public.stamps(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  nps int CHECK (nps BETWEEN 0 AND 10),
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  customer_name text,
  reply text,
  replied_at timestamptz,
  replied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'voucher',
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_est ON public.reviews(establishment_id, created_at DESC);
CREATE INDEX idx_reviews_customer ON public.reviews(customer_id);
CREATE UNIQUE INDEX ux_reviews_one_per_stamp ON public.reviews(stamp_id) WHERE stamp_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "reviews owner read" ON public.reviews FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "reviews insert public" ON public.reviews FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "reviews owner update" ON public.reviews FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY "reviews owner delete" ON public.reviews FOR DELETE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
SELECT p.id, x.feature_key, x.feature_name, x.enabled
FROM public.plans p
JOIN (VALUES
  ('starter','reviews','Avaliações de atendimento',true),
  ('starter','reviews_reply','Responder avaliações',false),
  ('starter','reviews_categories','Categorias de avaliação',false),
  ('starter','reviews_nps','NPS',false),
  ('starter','reviews_export','Exportar avaliações',false),
  ('starter','reviews_public_page','Página pública de avaliações',false),
  ('starter','reviews_google','Redirecionar para Google Reviews',false),
  ('pro','reviews','Avaliações de atendimento',true),
  ('pro','reviews_reply','Responder avaliações',true),
  ('pro','reviews_categories','Categorias de avaliação',true),
  ('pro','reviews_nps','NPS',false),
  ('pro','reviews_export','Exportar avaliações',true),
  ('pro','reviews_public_page','Página pública de avaliações',true),
  ('pro','reviews_google','Redirecionar para Google Reviews',false),
  ('enterprise','reviews','Avaliações de atendimento',true),
  ('enterprise','reviews_reply','Responder avaliações',true),
  ('enterprise','reviews_categories','Categorias de avaliação',true),
  ('enterprise','reviews_nps','NPS',true),
  ('enterprise','reviews_export','Exportar avaliações',true),
  ('enterprise','reviews_public_page','Página pública de avaliações',true),
  ('enterprise','reviews_google','Redirecionar para Google Reviews',true)
) AS x(tier_key, feature_key, feature_name, enabled) ON p.tier::text = x.tier_key
ON CONFLICT DO NOTHING;
