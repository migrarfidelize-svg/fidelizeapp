-- Uploads: apenas gerentes/donos do estabelecimento (primeira parte do path é o establishment_id)
CREATE POLICY "print orders members read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'poster-print-orders'
  AND public.has_establishment_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "print orders managers write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'poster-print-orders'
  AND public.has_establishment_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager')
);

CREATE POLICY "print orders managers update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'poster-print-orders'
  AND public.has_establishment_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager')
)
WITH CHECK (
  bucket_id = 'poster-print-orders'
  AND public.has_establishment_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'manager')
);