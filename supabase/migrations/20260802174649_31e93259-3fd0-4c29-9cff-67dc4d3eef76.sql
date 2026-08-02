
CREATE TYPE public.courier_status AS ENUM ('pending','approved','rejected','suspended');
CREATE TYPE public.courier_doc_type AS ENUM ('cnh','crlv','selfie','proof_address','criminal_record','other');
CREATE TYPE public.delivery_status AS ENUM ('pending','assigned','accepted','picked_up','in_transit','delivered','cancelled');
CREATE TYPE public.withdrawal_status AS ENUM ('requested','processing','paid','rejected');
CREATE TYPE public.fee_category AS ENUM ('delivery','product_sale','service','withdrawal','subscription','other');

CREATE TABLE public.courier_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  fee_percent numeric(6,3) NOT NULL DEFAULT 0,
  fee_min_cents integer NOT NULL DEFAULT 0,
  daily_limit_cents integer NOT NULL DEFAULT 15000,
  weekly_withdrawals integer NOT NULL DEFAULT 2,
  free_withdrawals_month integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courier_plans TO anon, authenticated;
GRANT ALL ON public.courier_plans TO service_role;
ALTER TABLE public.courier_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_plans_read" ON public.courier_plans FOR SELECT USING (true);
CREATE POLICY "courier_plans_admin" ON public.courier_plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.courier_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  min_deliveries integer NOT NULL DEFAULT 0,
  min_rating numeric(3,2) NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#8b5cf6',
  raffle_eligible boolean NOT NULL DEFAULT false,
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courier_levels TO anon, authenticated;
GRANT ALL ON public.courier_levels TO service_role;
ALTER TABLE public.courier_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_levels_read" ON public.courier_levels FOR SELECT USING (true);
CREATE POLICY "courier_levels_admin" ON public.courier_levels FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  category public.fee_category NOT NULL DEFAULT 'other',
  percent numeric(6,3) NOT NULL DEFAULT 0,
  fixed_cents integer NOT NULL DEFAULT 0,
  min_cents integer NOT NULL DEFAULT 0,
  max_cents integer,
  applies_to text NOT NULL DEFAULT 'platform',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_fees_read_auth" ON public.platform_fees FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_fees_admin" ON public.platform_fees FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.admin_area_locks (
  area text PRIMARY KEY,
  pin text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_area_locks TO service_role;
ALTER TABLE public.admin_area_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_area_locks_admin" ON public.admin_area_locks FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  cpf text,
  phone text,
  email text,
  birth_date date,
  vehicle_type text NOT NULL DEFAULT 'moto',
  vehicle_plate text,
  vehicle_model text,
  city text,
  state text,
  pix_key text,
  avatar_url text,
  bio text,
  status public.courier_status NOT NULL DEFAULT 'pending',
  plan_code text NOT NULL DEFAULT 'free',
  level_code text NOT NULL DEFAULT 'bronze',
  deliveries_count integer NOT NULL DEFAULT 0,
  rating_avg numeric(3,2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  balance_cents integer NOT NULL DEFAULT 0,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX couriers_status_idx ON public.couriers(status);
CREATE INDEX couriers_user_idx ON public.couriers(user_id);
GRANT SELECT, INSERT, UPDATE ON public.couriers TO authenticated;
GRANT ALL ON public.couriers TO service_role;
ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "couriers_own_select" ON public.couriers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()) OR status = 'approved');
CREATE POLICY "couriers_own_insert" ON public.couriers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "couriers_own_update" ON public.couriers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "couriers_admin_all" ON public.couriers FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.my_courier_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.couriers WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE TABLE public.courier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  doc_type public.courier_doc_type NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes integer,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courier_documents_courier_idx ON public.courier_documents(courier_id);
GRANT SELECT, INSERT ON public.courier_documents TO authenticated;
GRANT ALL ON public.courier_documents TO service_role;
ALTER TABLE public.courier_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_docs_own" ON public.courier_documents FOR SELECT TO authenticated
  USING (courier_id = public.my_courier_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "courier_docs_insert_own" ON public.courier_documents FOR INSERT TO authenticated
  WITH CHECK (courier_id = public.my_courier_id());
CREATE POLICY "courier_docs_admin" ON public.courier_documents FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  courier_id uuid REFERENCES public.couriers(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  pickup_address text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_address text,
  dropoff_lat double precision,
  dropoff_lng double precision,
  distance_m integer,
  fee_cents integer NOT NULL DEFAULT 0,
  platform_fee_cents integer NOT NULL DEFAULT 0,
  courier_net_cents integer NOT NULL DEFAULT 0,
  assigned_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deliveries_est_idx ON public.deliveries(establishment_id);
CREATE INDEX deliveries_courier_idx ON public.deliveries(courier_id);
CREATE INDEX deliveries_status_idx ON public.deliveries(status);
GRANT SELECT, INSERT, UPDATE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliveries_courier" ON public.deliveries FOR SELECT TO authenticated
  USING (courier_id = public.my_courier_id()
      OR public.has_establishment_access(auth.uid(), establishment_id)
      OR public.is_super_admin(auth.uid()));
CREATE POLICY "deliveries_est_insert" ON public.deliveries FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "deliveries_update" ON public.deliveries FOR UPDATE TO authenticated
  USING (courier_id = public.my_courier_id() OR public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (courier_id = public.my_courier_id() OR public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "deliveries_admin" ON public.deliveries FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.courier_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading numeric(6,2),
  speed_kmh numeric(6,2),
  accuracy_m numeric(8,2),
  battery integer,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courier_locations_delivery_idx ON public.courier_locations(delivery_id, recorded_at DESC);
CREATE INDEX courier_locations_courier_idx ON public.courier_locations(courier_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.courier_locations TO authenticated;
GRANT ALL ON public.courier_locations TO service_role;
ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_loc_insert_own" ON public.courier_locations FOR INSERT TO authenticated
  WITH CHECK (courier_id = public.my_courier_id());
CREATE POLICY "courier_loc_select" ON public.courier_locations FOR SELECT TO authenticated
  USING (
    courier_id = public.my_courier_id()
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = courier_locations.delivery_id
        AND public.has_establishment_access(auth.uid(), d.establishment_id)
    )
  );

CREATE TABLE public.courier_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE SET NULL,
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  author_user_id uuid,
  author_name text,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courier_reviews_courier_idx ON public.courier_reviews(courier_id, created_at DESC);
GRANT SELECT, INSERT ON public.courier_reviews TO authenticated;
GRANT SELECT ON public.courier_reviews TO anon;
GRANT ALL ON public.courier_reviews TO service_role;
ALTER TABLE public.courier_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_reviews_public_read" ON public.courier_reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "courier_reviews_insert" ON public.courier_reviews FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());
CREATE POLICY "courier_reviews_admin" ON public.courier_reviews FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TABLE public.courier_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  fee_cents integer NOT NULL DEFAULT 0,
  net_cents integer NOT NULL DEFAULT 0,
  pix_key text,
  status public.withdrawal_status NOT NULL DEFAULT 'requested',
  notes text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courier_withdrawals_courier_idx ON public.courier_withdrawals(courier_id, created_at DESC);
GRANT SELECT, INSERT ON public.courier_withdrawals TO authenticated;
GRANT ALL ON public.courier_withdrawals TO service_role;
ALTER TABLE public.courier_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "courier_wd_own" ON public.courier_withdrawals FOR SELECT TO authenticated
  USING (courier_id = public.my_courier_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "courier_wd_insert" ON public.courier_withdrawals FOR INSERT TO authenticated
  WITH CHECK (courier_id = public.my_courier_id());
CREATE POLICY "courier_wd_admin" ON public.courier_withdrawals FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_courier_plans_u BEFORE UPDATE ON public.courier_plans FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_courier_levels_u BEFORE UPDATE ON public.courier_levels FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_platform_fees_u BEFORE UPDATE ON public.platform_fees FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_couriers_u BEFORE UPDATE ON public.couriers FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_courier_documents_u BEFORE UPDATE ON public.courier_documents FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_deliveries_u BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_courier_reviews_u BEFORE UPDATE ON public.courier_reviews FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();
CREATE TRIGGER trg_courier_withdrawals_u BEFORE UPDATE ON public.courier_withdrawals FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE OR REPLACE FUNCTION public.tg_courier_rating_recalc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_courier uuid := COALESCE(NEW.courier_id, OLD.courier_id);
BEGIN
  UPDATE public.couriers c SET
    rating_avg = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.courier_reviews r WHERE r.courier_id = v_courier AND r.is_approved), 0),
    rating_count = (SELECT COUNT(*) FROM public.courier_reviews r WHERE r.courier_id = v_courier AND r.is_approved),
    updated_at = now()
  WHERE c.id = v_courier;
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_courier_rating AFTER INSERT OR UPDATE OR DELETE ON public.courier_reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_courier_rating_recalc();

CREATE OR REPLACE FUNCTION public.tg_delivery_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_level text;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') AND NEW.courier_id IS NOT NULL THEN
    UPDATE public.couriers SET
      deliveries_count = deliveries_count + 1,
      balance_cents = balance_cents + GREATEST(COALESCE(NEW.courier_net_cents,0), 0),
      updated_at = now()
    WHERE id = NEW.courier_id;

    SELECT l.code INTO v_level FROM public.courier_levels l
     JOIN public.couriers c ON c.id = NEW.courier_id
     WHERE l.is_active AND c.deliveries_count >= l.min_deliveries AND c.rating_avg >= l.min_rating
     ORDER BY l.min_deliveries DESC LIMIT 1;
    IF v_level IS NOT NULL THEN
      UPDATE public.couriers SET level_code = v_level WHERE id = NEW.courier_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_delivery_completed AFTER UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.tg_delivery_completed();

ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;

INSERT INTO public.courier_plans (code, name, description, price_cents, fee_percent, fee_min_cents, daily_limit_cents, weekly_withdrawals, free_withdrawals_month, sort_order) VALUES
  ('free','Free','Comece sem pagar nada', 0, 5.0, 100, 15000, 2, 0, 0),
  ('turbo','Turbo','Menos taxa, mais limite', 990, 2.0, 50, 40000, 2, 0, 1),
  ('promax','Pro Max','Taxa zero por entrega', 1990, 0, 0, 100000, 3, 1, 2);

INSERT INTO public.courier_levels (code, name, min_deliveries, min_rating, color, raffle_eligible, sort_order, perks) VALUES
  ('bronze','Bronze', 0, 0, '#b45309', false, 0, '["Acesso às entregas da região"]'::jsonb),
  ('prata','Prata', 100, 4.0, '#94a3b8', false, 1, '["Prioridade média nas rotas"]'::jsonb),
  ('ouro','Ouro', 400, 4.3, '#eab308', false, 2, '["Prioridade alta","Selo Ouro no perfil"]'::jsonb),
  ('diamante','Diamante', 1000, 4.5, '#22d3ee', true, 3, '["Prioridade máxima","Elegível a sorteios","Suporte dedicado"]'::jsonb);

INSERT INTO public.platform_fees (key, label, description, category, percent, fixed_cents, min_cents, applies_to, sort_order) VALUES
  ('delivery_platform','Taxa de entrega (plataforma)','Percentual retido sobre o valor da corrida do entregador','delivery', 5.0, 0, 100, 'courier', 0),
  ('product_sale','Taxa sobre venda de produtos','Percentual sobre pedidos de cardápio/catálogo','product_sale', 2.5, 0, 0, 'establishment', 1),
  ('service_fee','Taxa de serviço','Taxa fixa por pedido processado','service', 0, 49, 0, 'establishment', 2),
  ('withdrawal_fee','Taxa de saque','Custo repassado por transferência ao entregador','withdrawal', 0, 349, 0, 'courier', 3);

INSERT INTO public.admin_area_locks (area, pin) VALUES ('motoboys','9572');
