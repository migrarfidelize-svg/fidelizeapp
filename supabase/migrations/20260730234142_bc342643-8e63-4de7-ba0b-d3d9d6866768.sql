CREATE POLICY "landing media admin all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'landing-media' AND public.is_super_admin(auth.uid()))
  WITH CHECK (bucket_id = 'landing-media' AND public.is_super_admin(auth.uid()));