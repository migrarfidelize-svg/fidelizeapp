
-- ============================================================
-- MÓDULO CARDÁPIO VIRTUAL — F1: schema base (aditivo)
-- ============================================================

CREATE TYPE public.menu_status AS ENUM ('draft','published','paused');
CREATE TYPE public.menu_default_view AS ENUM ('stories','list');
CREATE TYPE public.menu_media_kind AS ENUM ('image','video');

-- ---------- restaurant_menus ----------
CREATE TABLE public.restaurant_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id UUID NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  status public.menu_status NOT NULL DEFAULT 'draft',
  default_view public.menu_default_view NOT NULL DEFAULT 'list',
  display_name TEXT,
  tagline TEXT,
  cover_url TEXT,
  logo_url TEXT,
  theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact JSONB NOT NULL DEFAULT '{}'::jsonb,
  hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  closed_message TEXT,
  order_defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_menus TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_menus TO authenticated;
GRANT ALL ON public.restaurant_menus TO service_role;
ALTER TABLE public.restaurant_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_menus_public_read_published" ON public.restaurant_menus
  FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "restaurant_menus_members_read" ON public.restaurant_menus
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "restaurant_menus_members_write" ON public.restaurant_menus
  FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_restaurant_menus_updated
  BEFORE UPDATE ON public.restaurant_menus
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ---------- menu_categories ----------
CREATE TABLE public.menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.restaurant_menus(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  available_days SMALLINT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[],
  available_start TIME,
  available_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_categories_menu ON public.menu_categories(menu_id, position);
GRANT SELECT ON public.menu_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_categories_public_read" ON public.menu_categories
  FOR SELECT TO anon, authenticated
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.restaurant_menus m
    WHERE m.id = menu_categories.menu_id AND m.status = 'published'
  ));

CREATE POLICY "menu_categories_members_read" ON public.menu_categories
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "menu_categories_members_write" ON public.menu_categories
  FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_menu_categories_updated
  BEFORE UPDATE ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ---------- menu_items ----------
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.restaurant_menus(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_desc TEXT,
  long_desc TEXT,
  price NUMERIC(10,2),
  promo_price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'BRL',
  image_url TEXT,
  video_url TEXT,
  video_poster_url TEXT,
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  addons JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  badges JSONB NOT NULL DEFAULT '{}'::jsonb,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  prep_minutes INTEGER,
  order_action JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  available_days SMALLINT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[],
  time_start TIME,
  time_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_items_menu ON public.menu_items(menu_id, position);
CREATE INDEX idx_menu_items_category ON public.menu_items(category_id, position);
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items_public_read" ON public.menu_items
  FOR SELECT TO anon, authenticated
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.restaurant_menus m
    WHERE m.id = menu_items.menu_id AND m.status = 'published'
  ));

CREATE POLICY "menu_items_members_read" ON public.menu_items
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "menu_items_members_write" ON public.menu_items
  FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_menu_items_updated
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ---------- menu_item_media ----------
CREATE TABLE public.menu_item_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  kind public.menu_media_kind NOT NULL,
  url TEXT NOT NULL,
  poster_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT,
  mime TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_item_media_item ON public.menu_item_media(item_id, position);
GRANT SELECT ON public.menu_item_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_media TO authenticated;
GRANT ALL ON public.menu_item_media TO service_role;
ALTER TABLE public.menu_item_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_media_public_read" ON public.menu_item_media
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.menu_items i
    JOIN public.restaurant_menus m ON m.id = i.menu_id
    WHERE i.id = menu_item_media.item_id AND i.active = true AND m.status = 'published'
  ));

CREATE POLICY "menu_item_media_members_read" ON public.menu_item_media
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "menu_item_media_members_write" ON public.menu_item_media
  FOR ALL TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- ---------- menu_item_favorites (autenticado) ----------
CREATE TABLE public.menu_item_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);
CREATE INDEX idx_menu_item_favorites_user ON public.menu_item_favorites(user_id);
GRANT SELECT, INSERT, DELETE ON public.menu_item_favorites TO authenticated;
GRANT ALL ON public.menu_item_favorites TO service_role;
ALTER TABLE public.menu_item_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_item_favorites_own" ON public.menu_item_favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------- menu_qr_designs ----------
CREATE TABLE public.menu_qr_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.restaurant_menus(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  format TEXT NOT NULL DEFAULT 'table',
  color TEXT NOT NULL DEFAULT '#000000',
  logo_url TEXT,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_qr_designs_menu ON public.menu_qr_designs(menu_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_qr_designs TO authenticated;
GRANT ALL ON public.menu_qr_designs TO service_role;
ALTER TABLE public.menu_qr_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_qr_designs_members" ON public.menu_qr_designs
  FOR ALL TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE TRIGGER trg_menu_qr_designs_updated
  BEFORE UPDATE ON public.menu_qr_designs
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ---------- menu_publish_events ----------
CREATE TABLE public.menu_publish_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id UUID NOT NULL REFERENCES public.restaurant_menus(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  from_status public.menu_status,
  to_status public.menu_status NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_publish_events_menu ON public.menu_publish_events(menu_id, created_at DESC);
GRANT SELECT, INSERT ON public.menu_publish_events TO authenticated;
GRANT ALL ON public.menu_publish_events TO service_role;
ALTER TABLE public.menu_publish_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_publish_events_members_read" ON public.menu_publish_events
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "menu_publish_events_members_insert" ON public.menu_publish_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

-- ---------- Publish trigger (histórico automático) ----------
CREATE OR REPLACE FUNCTION public.tg_menu_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.menu_publish_events (menu_id, establishment_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.establishment_id, NULL, NEW.status, auth.uid());
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.menu_publish_events (menu_id, establishment_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NEW.establishment_id, OLD.status, NEW.status, auth.uid());
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_restaurant_menus_status
  BEFORE INSERT OR UPDATE ON public.restaurant_menus
  FOR EACH ROW EXECUTE FUNCTION public.tg_menu_status_history();
