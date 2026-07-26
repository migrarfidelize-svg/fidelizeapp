CREATE TYPE public.showcase_kind AS ENUM ('menu','catalog');

ALTER TABLE public.restaurant_menus
  ADD COLUMN kind public.showcase_kind NOT NULL DEFAULT 'menu';

ALTER TABLE public.restaurant_menus
  DROP CONSTRAINT IF EXISTS restaurant_menus_establishment_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_menus_est_kind_uidx
  ON public.restaurant_menus (establishment_id, kind);

ALTER TABLE public.menu_items
  ADD COLUMN sku TEXT,
  ADD COLUMN brand TEXT,
  ADD COLUMN stock_status TEXT NOT NULL DEFAULT 'in_stock',
  ADD COLUMN external_url TEXT;

ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_stock_status_chk
  CHECK (stock_status IN ('in_stock','made_to_order','out_of_stock'));

INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled)
SELECT pf.plan_id, 'digital_catalog', 'Catálogo digital', pf.enabled
FROM public.plan_features pf
WHERE pf.feature_key = 'digital_menu'
ON CONFLICT DO NOTHING;