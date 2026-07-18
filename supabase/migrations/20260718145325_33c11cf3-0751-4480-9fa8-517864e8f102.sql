
ALTER FUNCTION public.tg_updated_at() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_establishment_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_establishment_role(uuid, uuid, public.member_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_establishment_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_establishment_role(uuid, uuid, public.member_role) TO authenticated, service_role;
