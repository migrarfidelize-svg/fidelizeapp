CREATE TYPE public.order_status AS ENUM ('new','confirmed','preparing','ready','completed','cancelled');
CREATE TYPE public.order_fulfillment AS ENUM ('pickup','delivery');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.restaurant_menus(id) ON DELETE SET NULL,
  kind public.showcase_kind NOT NULL DEFAULT 'catalog',
  order_number integer NOT NULL DEFAULT 0,
  customer_name text NOT NULL,
  customer_phone text,
  fulfillment public.order_fulfillment NOT NULL DEFAULT 'pickup',
  address text,
  note text,
  payment_method text,
  items_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  status public.order_status NOT NULL DEFAULT 'new',
  source text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  variant_label text,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_est_created_idx ON public.orders (establishment_id, created_at DESC);
CREATE INDEX orders_est_status_idx ON public.orders (establishment_id, status);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);

GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own establishment orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Members update own establishment orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

CREATE POLICY "Managers delete own establishment orders"
  ON public.orders FOR DELETE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));

CREATE POLICY "Members view own establishment order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (public.has_establishment_access(auth.uid(), o.establishment_id) OR public.is_super_admin(auth.uid()))
  ));

CREATE OR REPLACE FUNCTION public.tg_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = 0 THEN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO NEW.order_number
      FROM public.orders WHERE establishment_id = NEW.establishment_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_number();

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();