
-- Tabela de overrides por membro
CREATE TABLE public.member_permissions (
  member_id UUID PRIMARY KEY REFERENCES public.establishment_members(id) ON DELETE CASCADE,
  establishment_id UUID NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE INDEX member_permissions_est_idx ON public.member_permissions(establishment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_permissions TO authenticated;
GRANT ALL ON public.member_permissions TO service_role;

ALTER TABLE public.member_permissions ENABLE ROW LEVEL SECURITY;

-- Donos e gerentes veem/gerem permissões da equipe; membros veem as próprias
CREATE POLICY "member_permissions_admin_all"
  ON public.member_permissions
  FOR ALL
  TO authenticated
  USING (public.has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role))
  WITH CHECK (public.has_establishment_role(auth.uid(), establishment_id, 'manager'::member_role));

CREATE POLICY "member_permissions_self_read"
  ON public.member_permissions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.establishment_members em
    WHERE em.id = member_permissions.member_id AND em.user_id = auth.uid()
  ));

-- Trigger updated_at
CREATE TRIGGER member_permissions_touch
BEFORE UPDATE ON public.member_permissions
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Função central de autorização
CREATE OR REPLACE FUNCTION public.member_can(_user uuid, _est uuid, _action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Super admin sempre pode
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

  -- Owner sempre pode tudo
  IF v_role = 'owner' THEN
    RETURN true;
  END IF;

  -- Override individual (true/false) tem prioridade
  SELECT overrides INTO v_override
    FROM public.member_permissions
   WHERE member_id = v_member_id;

  IF v_override ? _action THEN
    RETURN COALESCE((v_override ->> _action)::boolean, false);
  END IF;

  -- Padrão do papel
  IF v_role = 'manager' THEN
    v_default := _action NOT IN (
      'billing.manage',      -- só owner mexe em cobrança/plano
      'team.roles.manage'    -- só owner promove/rebaixa papéis
    );
  ELSE -- staff
    v_default := _action IN (
      'stamping.use',
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
$$;

GRANT EXECUTE ON FUNCTION public.member_can(uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.member_can(uuid, uuid, text) FROM PUBLIC, anon;
