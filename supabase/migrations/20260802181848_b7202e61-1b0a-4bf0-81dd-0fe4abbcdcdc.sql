CREATE POLICY "deliveries_courier_offers" ON public.deliveries
FOR SELECT TO authenticated
USING (
  status = 'pending'::public.delivery_status
  AND courier_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.couriers c
    WHERE c.id = public.my_courier_id() AND c.status = 'approved'::public.courier_status
  )
);

CREATE POLICY "deliveries_courier_claim" ON public.deliveries
FOR UPDATE TO authenticated
USING (
  status = 'pending'::public.delivery_status
  AND courier_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.couriers c
    WHERE c.id = public.my_courier_id() AND c.status = 'approved'::public.courier_status
  )
)
WITH CHECK (courier_id = public.my_courier_id());

CREATE INDEX IF NOT EXISTS deliveries_open_idx ON public.deliveries (status, created_at DESC) WHERE courier_id IS NULL;