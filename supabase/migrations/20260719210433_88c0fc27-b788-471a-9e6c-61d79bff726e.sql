
-- ========== ENUMS ==========
CREATE TYPE public.public_review_status AS ENUM ('new','analyzing','contacting','resolved','archived');
CREATE TYPE public.public_review_action AS ENUM ('apologize','ask_details','thank','invite_google','invite_share','none');
CREATE TYPE public.public_review_qtype AS ENUM ('stars','nps','yes_no','choice','short','long');
CREATE TYPE public.public_review_source AS ENUM ('linktree','direct_url','qr','embed');

-- ========== review_forms ==========
CREATE TABLE public.review_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  title text NOT NULL DEFAULT 'Como foi sua experiência conosco?',
  question text NOT NULL DEFAULT 'Sua opinião nos ajuda a melhorar.',
  description text,
  submit_label text NOT NULL DEFAULT 'Enviar avaliação',
  success_message text NOT NULL DEFAULT 'Obrigado pela sua avaliação!',
  star_color text NOT NULL DEFAULT '#FACC15',
  button_color text NOT NULL DEFAULT '#7C3AED',
  google_review_url text,
  redirect_to_google_enabled boolean NOT NULL DEFAULT false,
  show_average boolean NOT NULL DEFAULT true,
  show_review_count boolean NOT NULL DEFAULT true,
  anonymous_allowed boolean NOT NULL DEFAULT true,
  name_required boolean NOT NULL DEFAULT false,
  phone_required boolean NOT NULL DEFAULT false,
  email_required boolean NOT NULL DEFAULT false,
  comment_required boolean NOT NULL DEFAULT false,
  allow_multiple boolean NOT NULL DEFAULT false,
  cooldown_hours int NOT NULL DEFAULT 24 CHECK (cooldown_hours >= 0 AND cooldown_hours <= 720),
  consent_text text DEFAULT 'Ao enviar, você autoriza o uso destes dados para que a empresa possa responder à sua avaliação.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_forms TO authenticated;
GRANT ALL ON public.review_forms TO service_role;
ALTER TABLE public.review_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active forms" ON public.review_forms FOR SELECT TO anon USING (active = true);
CREATE POLICY "members read own form" ON public.review_forms FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "managers manage form" ON public.review_forms FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_review_forms_updated BEFORE UPDATE ON public.review_forms
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ========== review_rating_options ==========
CREATE TABLE public.review_rating_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_form_id uuid NOT NULL REFERENCES public.review_forms(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  enabled boolean NOT NULL DEFAULT true,
  label text NOT NULL,
  selection_message text,
  comment_required boolean NOT NULL DEFAULT false,
  post_submit_action public.public_review_action NOT NULL DEFAULT 'thank',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_form_id, rating)
);

GRANT SELECT ON public.review_rating_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_rating_options TO authenticated;
GRANT ALL ON public.review_rating_options TO service_role;
ALTER TABLE public.review_rating_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read options of active form" ON public.review_rating_options FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND f.active = true));
CREATE POLICY "members read options" ON public.review_rating_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_access(auth.uid(), f.establishment_id)));
CREATE POLICY "managers manage options" ON public.review_rating_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_role(auth.uid(), f.establishment_id, 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_role(auth.uid(), f.establishment_id, 'manager')));

CREATE TRIGGER trg_review_options_updated BEFORE UPDATE ON public.review_rating_options
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ========== review_questions ==========
CREATE TABLE public.review_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_form_id uuid NOT NULL REFERENCES public.review_forms(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_type public.public_review_qtype NOT NULL DEFAULT 'short',
  choices jsonb,
  required boolean NOT NULL DEFAULT false,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_questions TO authenticated;
GRANT ALL ON public.review_questions TO service_role;
ALTER TABLE public.review_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active questions" ON public.review_questions FOR SELECT TO anon
  USING (active = true AND EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND f.active = true));
CREATE POLICY "members read questions" ON public.review_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_access(auth.uid(), f.establishment_id)));
CREATE POLICY "managers manage questions" ON public.review_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_role(auth.uid(), f.establishment_id, 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_role(auth.uid(), f.establishment_id, 'manager')));

CREATE TRIGGER trg_review_questions_updated BEFORE UPDATE ON public.review_questions
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ========== customer_reviews ==========
CREATE TABLE public.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  review_form_id uuid NOT NULL REFERENCES public.review_forms(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  customer_name text,
  customer_phone text,
  customer_email text,
  employee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  branch_id uuid,
  order_reference text,
  source public.public_review_source NOT NULL DEFAULT 'linktree',
  status public.public_review_status NOT NULL DEFAULT 'new',
  anonymous boolean NOT NULL DEFAULT false,
  device_hash text,
  ip_hash text,
  internal_note text,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_reviews_est_created ON public.customer_reviews(establishment_id, created_at DESC);
CREATE INDEX idx_customer_reviews_form ON public.customer_reviews(review_form_id);
CREATE INDEX idx_customer_reviews_status ON public.customer_reviews(establishment_id, status);
CREATE INDEX idx_customer_reviews_cooldown ON public.customer_reviews(review_form_id, device_hash, submitted_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_reviews TO authenticated;
GRANT ALL ON public.customer_reviews TO service_role;
ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;
-- no public SELECT: aggregates são retornados por server function.
CREATE POLICY "members read reviews" ON public.customer_reviews FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "managers update reviews" ON public.customer_reviews FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE POLICY "managers delete reviews" ON public.customer_reviews FOR DELETE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
-- INSERT: só via service role (server fn valida cooldown/rate).

CREATE TRIGGER trg_customer_reviews_updated BEFORE UPDATE ON public.customer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ========== review_answers ==========
CREATE TABLE public.review_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.customer_reviews(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.review_questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_number numeric,
  answer_boolean boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_answers_review ON public.review_answers(review_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_answers TO authenticated;
GRANT ALL ON public.review_answers TO service_role;
ALTER TABLE public.review_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read answers" ON public.review_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_reviews r WHERE r.id = review_id AND public.has_establishment_access(auth.uid(), r.establishment_id)));

-- ========== review_events ==========
CREATE TABLE public.review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_form_id uuid NOT NULL REFERENCES public.review_forms(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.customer_reviews(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_events_form_created ON public.review_events(review_form_id, created_at DESC);
GRANT SELECT, INSERT ON public.review_events TO authenticated;
GRANT ALL ON public.review_events TO service_role;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read events" ON public.review_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.review_forms f WHERE f.id = review_form_id AND public.has_establishment_access(auth.uid(), f.establishment_id)));
