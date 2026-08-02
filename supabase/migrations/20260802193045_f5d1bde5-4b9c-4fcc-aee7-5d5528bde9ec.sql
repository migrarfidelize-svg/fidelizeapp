DROP POLICY IF EXISTS "plans admin write" ON public.plans;
CREATE POLICY "plans admin write" ON public.plans
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "plan_features admin write" ON public.plan_features;
CREATE POLICY "plan_features admin write" ON public.plan_features
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));