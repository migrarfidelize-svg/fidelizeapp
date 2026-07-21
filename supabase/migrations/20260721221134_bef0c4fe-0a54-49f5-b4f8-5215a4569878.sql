-- Backup + normalização de account_type para usuários ambíguos
CREATE TABLE IF NOT EXISTS public.profiles_account_type_backup (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL,
  account_type  public.account_type,
  backup_batch  text NOT NULL,
  backed_up_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles_account_type_backup TO authenticated;
GRANT ALL ON public.profiles_account_type_backup TO service_role;
ALTER TABLE public.profiles_account_type_backup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backup_super_admin_read" ON public.profiles_account_type_backup;
CREATE POLICY "backup_super_admin_read"
  ON public.profiles_account_type_backup FOR SELECT
  TO authenticated USING (public.is_super_admin(auth.uid()));

-- 1) Snapshot dos ambíguos
INSERT INTO public.profiles_account_type_backup (profile_id, account_type, backup_batch)
SELECT p.id, p.account_type, '2026-07-21_ambiguous_users'
FROM public.profiles p
WHERE p.account_type IS NULL
   OR (p.account_type = 'establishment'
       AND NOT EXISTS (SELECT 1 FROM public.establishment_members m
                        WHERE m.user_id = p.id AND m.active = true)
       AND NOT public.is_super_admin(p.id));

-- 2) Promove para 'establishment' quem tem vínculo ativo
UPDATE public.profiles p
   SET account_type = 'establishment', updated_at = now()
 WHERE (p.account_type IS NULL OR p.account_type <> 'establishment')
   AND EXISTS (SELECT 1 FROM public.establishment_members m
                WHERE m.user_id = p.id AND m.active = true)
   AND NOT public.is_super_admin(p.id);

-- 3) Promove super_admins
UPDATE public.profiles p
   SET account_type = 'super_admin', updated_at = now()
 WHERE public.is_super_admin(p.id)
   AND (p.account_type IS DISTINCT FROM 'super_admin');

-- 4) Restante ambíguo vira 'customer' (default seguro, força /carteira)
UPDATE public.profiles p
   SET account_type = 'customer', updated_at = now()
 WHERE p.account_type IS NULL
    OR (p.account_type = 'establishment'
        AND NOT EXISTS (SELECT 1 FROM public.establishment_members m
                         WHERE m.user_id = p.id AND m.active = true)
        AND NOT public.is_super_admin(p.id));

-- Auditoria
INSERT INTO public.audit_logs (user_id, action, entity_type, metadata)
SELECT NULL, 'migration.normalize_account_type', 'profiles',
       jsonb_build_object(
         'batch', '2026-07-21_ambiguous_users',
         'snapshot_count', (SELECT count(*) FROM public.profiles_account_type_backup
                              WHERE backup_batch = '2026-07-21_ambiguous_users')
       );

-- ROLLBACK (executar manualmente se necessário):
--   UPDATE public.profiles p
--      SET account_type = b.account_type, updated_at = now()
--     FROM public.profiles_account_type_backup b
--    WHERE b.profile_id = p.id
--      AND b.backup_batch = '2026-07-21_ambiguous_users';