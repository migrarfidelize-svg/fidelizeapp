-- 1. Remover acessos públicos e de usuários autenticados via PostgREST/Browser
REVOKE ALL ON public.system_settings FROM PUBLIC;
REVOKE ALL ON public.system_settings FROM anon;
REVOKE ALL ON public.system_settings FROM authenticated;

-- 2. Garantir acesso total apenas para service_role (usado pelo supabaseAdmin no servidor)
GRANT ALL ON public.system_settings TO service_role;

-- 3. Habilitar extensões necessárias se não existirem
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 4. Limpar policies existentes (pois agora o acesso é via service_role que ignora RLS, ou por falta de policies)
DROP POLICY IF EXISTS "system_settings_read_all" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_read_anon" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_admin_all" ON public.system_settings;

-- 5. Adicionar uma flag de criptografia ao schema se não existir (opcional, vamos usar JSONB direto)
-- A criptografia será feita no nível do servidor (Node/Edge) ou via SQL pgcrypto.
-- Para cumprir o requisito de "criptografado em repouso no banco", usaremos pgcrypto no SQL.
