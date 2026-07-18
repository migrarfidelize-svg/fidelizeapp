CREATE TABLE IF NOT EXISTS public.help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.help_categories TO anon, authenticated;
GRANT ALL ON public.help_categories TO service_role;
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_categories_read_all" ON public.help_categories FOR SELECT USING (true);
CREATE POLICY "help_categories_admin_write" ON public.help_categories FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.help_categories(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  keywords text,
  reading_time int NOT NULL DEFAULT 3,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  views int NOT NULL DEFAULT 0,
  helpful_yes int NOT NULL DEFAULT 0,
  helpful_no int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, slug)
);
GRANT SELECT ON public.help_articles TO anon, authenticated;
GRANT ALL ON public.help_articles TO service_role;
GRANT UPDATE (views, helpful_yes, helpful_no) ON public.help_articles TO authenticated;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_articles_read_published" ON public.help_articles FOR SELECT USING (published = true OR public.is_super_admin(auth.uid()));
CREATE POLICY "help_articles_admin_write" ON public.help_articles FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.help_article_views (
  id bigserial PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_article_views TO authenticated;
GRANT USAGE ON SEQUENCE public.help_article_views_id_seq TO authenticated;
GRANT ALL ON public.help_article_views TO service_role;
GRANT ALL ON SEQUENCE public.help_article_views_id_seq TO service_role;
ALTER TABLE public.help_article_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_article_views_insert_authed" ON public.help_article_views FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "help_article_views_read_admin" ON public.help_article_views FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.help_feedback (
  id bigserial PRIMARY KEY,
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  user_id uuid,
  helpful boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.help_feedback TO authenticated;
GRANT USAGE ON SEQUENCE public.help_feedback_id_seq TO authenticated;
GRANT ALL ON public.help_feedback TO service_role;
GRANT ALL ON SEQUENCE public.help_feedback_id_seq TO service_role;
ALTER TABLE public.help_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_feedback_insert_authed" ON public.help_feedback FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "help_feedback_read_admin" ON public.help_feedback FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON public.help_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_help_articles_search ON public.help_articles USING gin (to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'') || ' ' || coalesce(keywords,'')));

CREATE TRIGGER trg_help_categories_updated_at BEFORE UPDATE ON public.help_categories FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_help_articles_updated_at BEFORE UPDATE ON public.help_articles FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();