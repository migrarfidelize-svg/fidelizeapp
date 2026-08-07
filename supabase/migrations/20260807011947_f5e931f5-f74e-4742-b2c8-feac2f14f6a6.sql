-- 1. Tabela global
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT system_settings_namespace_key_unique UNIQUE(namespace, key)
);

-- 2. RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. BLOQUEAR acesso direto do navegador
REVOKE ALL ON TABLE public.system_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.system_settings FROM anon;
REVOKE ALL ON TABLE public.system_settings FROM authenticated;

-- Backend server-only
GRANT ALL ON TABLE public.system_settings TO service_role;

-- 4. Remover políticas públicas/permissivas caso tenham sido criadas
DROP POLICY IF EXISTS "system_settings_read_all" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_read_anon" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_all" ON public.system_settings;

-- 5. Trigger próprio para updated_at
CREATE OR REPLACE FUNCTION public.set_system_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'system_settings_updated' AND tgrelid = 'public.system_settings'::regclass) THEN
        DROP TRIGGER system_settings_updated ON public.system_settings;
    END IF;
END $$;

CREATE TRIGGER system_settings_updated
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_system_settings_updated_at();

-- 6. Atualizar PostgREST
NOTIFY pgrst, 'reload schema';