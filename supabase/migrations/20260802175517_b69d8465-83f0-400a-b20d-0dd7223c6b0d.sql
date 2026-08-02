
CREATE OR REPLACE FUNCTION public.courier_storage_owner(_path text)
RETURNS uuid LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT NULLIF(substring(_path FROM '^([0-9a-fA-F-]{36})/'), '')::uuid
$$;

CREATE POLICY "courier_docs_own_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'courier-documents'
  AND (
    public.courier_storage_owner(name) = public.my_courier_id()
    OR public.is_super_admin(auth.uid())
  )
);

CREATE POLICY "courier_docs_own_upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'courier-documents'
  AND public.courier_storage_owner(name) = public.my_courier_id()
);

CREATE POLICY "courier_docs_admin_manage" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'courier-documents' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'courier-documents' AND public.is_super_admin(auth.uid()));
