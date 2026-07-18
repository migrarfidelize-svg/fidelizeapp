
-- 1) Fix privilege escalation on establishment_members insert
DROP POLICY IF EXISTS members_insert ON public.establishment_members;

CREATE POLICY members_insert ON public.establishment_members
FOR INSERT TO authenticated
WITH CHECK (
  has_establishment_role(auth.uid(), establishment_id, 'owner'::member_role)
  OR (
    user_id = auth.uid()
    AND role = 'owner'::member_role
    AND EXISTS (
      SELECT 1 FROM public.establishments e
      WHERE e.id = establishment_id AND e.created_by = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.establishment_members m
      WHERE m.establishment_id = establishment_members.establishment_id
    )
  )
);

-- 2) Lock down SECURITY DEFINER functions from anon and public
REVOKE ALL ON FUNCTION public.tg_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_establishment_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_establishment_role(uuid, uuid, public.member_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;

-- Keep execute for authenticated only where the function is referenced by RLS policies
GRANT EXECUTE ON FUNCTION public.has_establishment_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_establishment_role(uuid, uuid, public.member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
