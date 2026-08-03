CREATE OR REPLACE FUNCTION public.has_establishment_access(_user uuid, _est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin(_user)
      OR EXISTS (SELECT 1 FROM public.establishment_members
                 WHERE user_id = _user AND establishment_id = _est AND active = true);
$function$;

CREATE OR REPLACE FUNCTION public.has_establishment_role(_user uuid, _est uuid, _min_role member_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin(_user)
      OR EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE user_id = _user AND establishment_id = _est AND active = true
    AND (
      _min_role = 'staff'
      OR (_min_role = 'manager' AND role IN ('manager','owner'))
      OR (_min_role = 'owner'   AND role = 'owner')
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(_est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin(auth.uid()) OR COALESCE((
    SELECT e.active
       AND e.archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM public.subscriptions s
         WHERE s.establishment_id = e.id
           AND s.status IN ('active','trial','trialing')
           AND (s.current_period_end IS NULL OR s.current_period_end > now() - interval '3 days')
       )
    FROM public.establishments e
    WHERE e.id = _est
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.has_plan_feature(_est uuid, _feature text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_super_admin(auth.uid())
      OR public.has_plan_feature_strict(_est, _feature)
      OR EXISTS (
        SELECT 1 FROM public.establishment_feature_overrides o
        WHERE o.establishment_id = _est
          AND o.feature_key = _feature
          AND o.enabled = true
          AND (o.expires_at IS NULL OR o.expires_at > now())
      )
$function$;