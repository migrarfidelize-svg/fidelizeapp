-- 1) Trigger functions: never called directly, only by the database engine.
REVOKE ALL ON FUNCTION public.tg_block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_menu_status_defaults() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_menu_status_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_order_number() FROM PUBLIC, anon, authenticated;

-- 2) Internal plan-feature helper: not for anonymous callers.
REVOKE ALL ON FUNCTION public.has_plan_feature_strict(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_plan_feature_strict(uuid, text) TO authenticated, service_role;

-- 3) Pin search_path on the storage-path helper used by storage policies.
CREATE OR REPLACE FUNCTION public.menu_storage_est_id(_path text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT NULLIF(substring(_path FROM '^est_([0-9a-fA-F-]{36})/'), '')::uuid
$function$;