CREATE OR REPLACE FUNCTION public.member_can(_user uuid, _est uuid, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role member_role;
  v_active boolean;
  v_member_id uuid;
  v_override jsonb;
  v_default boolean;
BEGIN
  IF _user IS NULL OR _est IS NULL OR _action IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(_user) THEN
    RETURN true;
  END IF;

  SELECT id, role, active INTO v_member_id, v_role, v_active
    FROM public.establishment_members
   WHERE user_id = _user AND establishment_id = _est
   LIMIT 1;

  IF v_member_id IS NULL OR v_active IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT overrides INTO v_override
    FROM public.member_permissions
   WHERE member_id = v_member_id;

  IF v_override ? _action THEN
    RETURN COALESCE((v_override ->> _action)::boolean, false);
  END IF;

  IF v_role = 'manager' THEN
    v_default := _action NOT IN ('billing.manage', 'team.roles.manage');
  ELSE
    v_default := _action IN (
      'stamping.use',
      'inbox.use',
      'customers.view',
      'customers.edit',
      'reviews.view',
      'reviews.reply',
      'push.send',
      'support.open',
      'support.reply',
      'analytics.view'
    );
  END IF;

  RETURN COALESCE(v_default, false);
END;
$function$;