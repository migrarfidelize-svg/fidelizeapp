ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.discover_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_url text,
  bg_color text,
  text_color text,
  cta_label text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.discover_banners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discover_banners TO authenticated;
GRANT ALL ON public.discover_banners TO service_role;

ALTER TABLE public.discover_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active discover banners" ON public.discover_banners;
CREATE POLICY "Authenticated read active discover banners"
  ON public.discover_banners FOR SELECT TO authenticated
  USING (active = true OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin manages discover banners" ON public.discover_banners;
CREATE POLICY "Super admin manages discover banners"
  ON public.discover_banners FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_discover_banners_updated_at ON public.discover_banners;
CREATE TRIGGER trg_discover_banners_updated_at
  BEFORE UPDATE ON public.discover_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_discover_banners_active ON public.discover_banners(active, sort_order);