
-- Helper: parse establishment id from storage path prefix "est_{uuid}/..."
CREATE OR REPLACE FUNCTION public.menu_storage_est_id(_path TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(substring(_path FROM '^est_([0-9a-fA-F-]{36})/'), '')::uuid
$$;

-- Restrict function execution
REVOKE ALL ON FUNCTION public.menu_storage_est_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.menu_storage_est_id(TEXT) TO authenticated, service_role;

-- Members can read their own files (for admin previews)
CREATE POLICY "menu_media_members_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('menu-images','menu-videos')
    AND public.menu_storage_est_id(name) IS NOT NULL
    AND public.has_establishment_access(auth.uid(), public.menu_storage_est_id(name))
  );

CREATE POLICY "menu_media_members_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('menu-images','menu-videos')
    AND public.menu_storage_est_id(name) IS NOT NULL
    AND public.has_establishment_role(auth.uid(), public.menu_storage_est_id(name), 'manager')
  );

CREATE POLICY "menu_media_members_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('menu-images','menu-videos')
    AND public.menu_storage_est_id(name) IS NOT NULL
    AND public.has_establishment_role(auth.uid(), public.menu_storage_est_id(name), 'manager')
  );

CREATE POLICY "menu_media_members_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('menu-images','menu-videos')
    AND public.menu_storage_est_id(name) IS NOT NULL
    AND public.has_establishment_role(auth.uid(), public.menu_storage_est_id(name), 'manager')
  );
