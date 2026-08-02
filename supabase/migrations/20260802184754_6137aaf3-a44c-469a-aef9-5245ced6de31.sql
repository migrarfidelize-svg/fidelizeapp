-- 1) Modo de entrega
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_mode text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS own_courier_name text,
  ADD COLUMN IF NOT EXISTS own_courier_phone text;

ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_mode_check;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_delivery_mode_check CHECK (delivery_mode IN ('platform','own'));

DROP POLICY IF EXISTS deliveries_courier_offers ON public.deliveries;
CREATE POLICY deliveries_courier_offers ON public.deliveries
FOR SELECT TO authenticated
USING (
  status = 'pending'::delivery_status
  AND courier_id IS NULL
  AND delivery_mode = 'platform'
  AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = public.my_courier_id() AND c.status = 'approved'::courier_status)
);

DROP POLICY IF EXISTS deliveries_courier_claim ON public.deliveries;
CREATE POLICY deliveries_courier_claim ON public.deliveries
FOR UPDATE TO authenticated
USING (
  status = 'pending'::delivery_status
  AND courier_id IS NULL
  AND delivery_mode = 'platform'
  AND EXISTS (SELECT 1 FROM public.couriers c WHERE c.id = public.my_courier_id() AND c.status = 'approved'::courier_status)
)
WITH CHECK (courier_id = public.my_courier_id());

-- 2) Endereços salvos do cliente
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Casa',
  recipient_name text,
  phone text,
  zip_code text,
  street text NOT NULL,
  number text,
  complement text,
  district text,
  city text,
  state text,
  reference text,
  lat double precision,
  lng double precision,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_addresses_own ON public.customer_addresses;
CREATE POLICY customer_addresses_own ON public.customer_addresses
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS customer_addresses_user_idx ON public.customer_addresses (user_id, is_default DESC, created_at DESC);

DROP TRIGGER IF EXISTS trg_customer_addresses_updated ON public.customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();