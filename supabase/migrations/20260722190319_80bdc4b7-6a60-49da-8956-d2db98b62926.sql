
-- QR destination column on establishments
ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS qr_destination TEXT NOT NULL DEFAULT 'reviews'
    CHECK (qr_destination IN ('reviews','linktree','landing'));

-- Link tree pages (one per establishment)
CREATE TABLE public.link_tree_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  social JSONB NOT NULL DEFAULT '{}'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_tree_pages TO authenticated;
GRANT SELECT ON public.link_tree_pages TO anon;
GRANT ALL ON public.link_tree_pages TO service_role;

ALTER TABLE public.link_tree_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published pages"
  ON public.link_tree_pages FOR SELECT
  USING (published = true);

CREATE POLICY "Members manage their page"
  ON public.link_tree_pages FOR ALL
  TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- Link tree links (ordered items)
CREATE TABLE public.link_tree_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.link_tree_pages(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'custom',
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX link_tree_links_page_order_idx ON public.link_tree_links(page_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_tree_links TO authenticated;
GRANT SELECT ON public.link_tree_links TO anon;
GRANT ALL ON public.link_tree_links TO service_role;

ALTER TABLE public.link_tree_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read links of published pages"
  ON public.link_tree_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.link_tree_pages p
    WHERE p.id = link_tree_links.page_id AND p.published = true
  ));

CREATE POLICY "Members manage links of their page"
  ON public.link_tree_links FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.link_tree_pages p
    WHERE p.id = link_tree_links.page_id
      AND public.has_establishment_access(auth.uid(), p.establishment_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.link_tree_pages p
    WHERE p.id = link_tree_links.page_id
      AND public.has_establishment_access(auth.uid(), p.establishment_id)
  ));

-- updated_at trigger (reuses existing helper if present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER link_tree_pages_updated_at BEFORE UPDATE ON public.link_tree_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER link_tree_links_updated_at BEFORE UPDATE ON public.link_tree_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
