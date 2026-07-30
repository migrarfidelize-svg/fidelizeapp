CREATE TABLE IF NOT EXISTS public.landing_content (
  key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.landing_content TO anon;
GRANT SELECT ON public.landing_content TO authenticated;
GRANT ALL ON public.landing_content TO service_role;

ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landing_content public read" ON public.landing_content
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "landing_content admin write" ON public.landing_content
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER landing_content_updated_at BEFORE UPDATE ON public.landing_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();