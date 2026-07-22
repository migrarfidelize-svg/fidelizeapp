-- 1. Designs de cartaz compartilhados entre membros do estabelecimento
CREATE TABLE public.poster_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at timestamptz
);
CREATE INDEX poster_designs_est_idx ON public.poster_designs(establishment_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poster_designs TO authenticated;
GRANT ALL ON public.poster_designs TO service_role;
ALTER TABLE public.poster_designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read designs" ON public.poster_designs FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "members insert designs" ON public.poster_designs FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id) AND created_by = auth.uid());
CREATE POLICY "members update designs" ON public.poster_designs FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "members delete designs" ON public.poster_designs FOR DELETE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE TRIGGER poster_designs_updated_at BEFORE UPDATE ON public.poster_designs
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2. Contador de scans do QR
CREATE TABLE public.qr_scans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  dest text NOT NULL CHECK (dest IN ('main','second')),
  ua text,
  ip_hash text,
  scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX qr_scans_est_time_idx ON public.qr_scans(establishment_id, scanned_at DESC);
GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_scans TO service_role;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read scans" ON public.qr_scans FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

-- 3. Pedidos de impressão (gráfica parceira)
CREATE TABLE public.print_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT ('FID-' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS')),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quantity int NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
  paper text NOT NULL,
  finish text,
  format text,
  shipping_address jsonb NOT NULL,
  contact_email text,
  contact_phone text,
  notes text,
  pdf_path text,
  svg_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX print_orders_est_idx ON public.print_orders(establishment_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.print_orders TO authenticated;
GRANT ALL ON public.print_orders TO service_role;
ALTER TABLE public.print_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read orders" ON public.print_orders FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "managers insert orders" ON public.print_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager') AND requested_by = auth.uid());
CREATE POLICY "managers update orders" ON public.print_orders FOR UPDATE TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'));
CREATE TRIGGER print_orders_updated_at BEFORE UPDATE ON public.print_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();