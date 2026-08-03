
CREATE POLICY "wp_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'withdrawal-proofs' AND public.is_super_admin(auth.uid()));

CREATE POLICY "wp_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'withdrawal-proofs' AND public.is_super_admin(auth.uid()))
  WITH CHECK (bucket_id = 'withdrawal-proofs' AND public.is_super_admin(auth.uid()));

CREATE POLICY "wp_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'withdrawal-proofs'
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.establishment_withdrawals w
        WHERE w.proof_file_path = storage.objects.name
          AND public.has_establishment_access(auth.uid(), w.establishment_id)
      )
    )
  );
