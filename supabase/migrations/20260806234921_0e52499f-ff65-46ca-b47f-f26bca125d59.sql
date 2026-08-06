GRANT EXECUTE ON FUNCTION public.get_public_catalogo_v2(text, text) TO authenticated, service_role, anon;

-- Verificação detalhada de owner e privilégios
SELECT 
    p.proname,
    pg_catalog.pg_get_userbyid(p.proowner) as owner,
    pg_catalog.has_function_privilege('anon', 'public.get_public_catalogo_v2(text,text)', 'EXECUTE') as can_anon,
    pg_catalog.has_function_privilege('authenticated', 'public.get_public_catalogo_v2(text,text)', 'EXECUTE') as can_auth
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_public_catalogo_v2';

-- Teste da RPC (agora com permissão service_role/authenticated garantida para a ferramenta)
SELECT public.get_public_catalogo_v2('fidelize-testes', 'menu') as result;