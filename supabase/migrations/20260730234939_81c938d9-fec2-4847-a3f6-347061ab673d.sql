-- 1) Núcleo: assinatura ativa por estabelecimento
CREATE OR REPLACE FUNCTION public.has_active_subscription(_est uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT e.active
       AND e.archived_at IS NULL
       AND (
         e.plan <> 'free'::plan_tier
         OR EXISTS (
           SELECT 1 FROM public.subscriptions s
           WHERE s.establishment_id = e.id
             AND s.status IN ('active','trialing')
             AND (s.current_period_end IS NULL OR s.current_period_end > now() - interval '3 days')
         )
       )
    FROM public.establishments e
    WHERE e.id = _est
  ), false);
$$;

REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;

-- 2) Gate do painel: o usuário logado tem negócio? está liberado?
CREATE OR REPLACE FUNCTION public.my_subscription_gate()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'has_establishment', EXISTS (
      SELECT 1 FROM public.establishment_members m
      WHERE m.user_id = auth.uid() AND m.active = true
    ),
    'active', EXISTS (
      SELECT 1 FROM public.establishment_members m
      WHERE m.user_id = auth.uid() AND m.active = true
        AND public.has_active_subscription(m.establishment_id)
    ),
    'super_admin', public.is_super_admin(auth.uid())
  );
$$;

REVOKE EXECUTE ON FUNCTION public.my_subscription_gate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_subscription_gate() TO authenticated, service_role;

-- 3) Políticas de escrita exigem assinatura ativa
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'customers','stamps','campaigns','scheduled_pushes','restaurant_menus',
    'menu_categories','link_tree_pages','promotions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_requires_active_subscription', t);
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      AS RESTRICTIVE
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_super_admin(auth.uid())
        OR public.has_active_subscription(establishment_id)
      )
    $f$, t || '_requires_active_subscription', t);
  END LOOP;
END $$;