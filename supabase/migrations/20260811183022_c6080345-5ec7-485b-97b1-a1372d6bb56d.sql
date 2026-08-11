
BEGIN;

-- 1. VALIDAÇÃO DE STATUS (PROTEÇÃO OBRIGATÓRIA 1 - INICIAL)
DO $$
DECLARE
    unknown_status text;
BEGIN
    SELECT status::text INTO unknown_status 
    FROM public.crm_conversations 
    WHERE status::text NOT IN ('waiting', 'bot', 'assigned', 'closed') 
    LIMIT 1;

    IF unknown_status IS NOT NULL THEN
        RAISE EXCEPTION 'Migration interrompida: Status desconhecido encontrado: %. A migration exige que todos os estados sejam conhecidos antes da conversão.', unknown_status;
    END IF;
END $$;

-- 2. TIPOS E ENUMS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'crm_conversation_status_v2') THEN
        CREATE TYPE public.crm_conversation_status_v2 AS ENUM ('bot', 'waiting', 'assigned', 'closed');
    END IF;
END $$;

-- 3. ESTRUTURA MULTI-TENANT (ADICIONAR COLUNAS)
ALTER TABLE public.whatsapp_providers ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id);
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id);
ALTER TABLE public.crm_flows ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id);
ALTER TABLE public.crm_flow_steps ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id);
ALTER TABLE public.crm_conversations ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id);
ALTER TABLE public.crm_messages ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id);
ALTER TABLE public.crm_messages ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;

-- 4. BACKFILL LEGADO (Admin ID: f406351f-487b-47db-b0d3-bd5cb918b6c3)
UPDATE public.whatsapp_providers SET establishment_id = 'f406351f-487b-47db-b0d3-bd5cb918b6c3' WHERE establishment_id IS NULL;
UPDATE public.integrations SET establishment_id = 'f406351f-487b-47db-b0d3-bd5cb918b6c3' WHERE establishment_id IS NULL AND category IN ('ai', 'otp');
UPDATE public.crm_flows SET establishment_id = 'f406351f-487b-47db-b0d3-bd5cb918b6c3' WHERE establishment_id IS NULL;
UPDATE public.crm_conversations SET establishment_id = 'f406351f-487b-47db-b0d3-bd5cb918b6c3' WHERE establishment_id IS NULL;

UPDATE public.crm_flow_steps fs SET establishment_id = f.establishment_id 
FROM public.crm_flows f WHERE fs.flow_id = f.id AND fs.establishment_id IS NULL;

UPDATE public.crm_messages m SET establishment_id = c.establishment_id 
FROM public.crm_conversations c WHERE m.conversation_id = c.id AND m.establishment_id IS NULL;

-- 5. VALIDAÇÃO DE DUPLICIDADES (PROTEÇÃO OBRIGATÓRIA 2 - APÓS BACKFILL)
DO $$
DECLARE
    duplicate_info text;
BEGIN
    SELECT 'Estabelecimento: ' || establishment_id::text || ', Telefone: ' || customer_phone || ' (Contagem: ' || count(*)::text || ')'
    INTO duplicate_info
    FROM public.crm_conversations
    WHERE status::text <> 'closed'
    GROUP BY establishment_id, customer_phone 
    HAVING count(*) > 1
    LIMIT 1;

    IF duplicate_info IS NOT NULL THEN
        RAISE EXCEPTION 'Migration interrompida: Existem duplicidades de conversas ativas para o mesmo cliente. Detalhe: %. Resolva as duplicidades manualmente antes de aplicar a restrição multi-tenant.', duplicate_info;
    END IF;
END $$;

-- 6. CONSTRAINTS IDEMPOTENTES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_flows_tenant_unique') THEN
        ALTER TABLE public.crm_flows ADD CONSTRAINT crm_flows_tenant_unique UNIQUE (id, establishment_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_conversations_tenant_unique') THEN
        ALTER TABLE public.crm_conversations ADD CONSTRAINT crm_conversations_tenant_unique UNIQUE (id, establishment_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_flow_steps_tenant_integrity') THEN
        ALTER TABLE public.crm_flow_steps ADD CONSTRAINT crm_flow_steps_tenant_integrity FOREIGN KEY (flow_id, establishment_id) REFERENCES public.crm_flows(id, establishment_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_messages_tenant_integrity') THEN
        ALTER TABLE public.crm_messages ADD CONSTRAINT crm_messages_tenant_integrity FOREIGN KEY (conversation_id, establishment_id) REFERENCES public.crm_conversations(id, establishment_id);
    END IF;
END $$;

-- 7. MIGRAÇÃO DE STATUS CONTROLADA
ALTER TABLE public.crm_conversations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.crm_conversations ALTER COLUMN status TYPE text;

UPDATE public.crm_conversations 
SET status = 'bot' 
WHERE status = 'waiting' 
  AND (metadata->'flow_state') IS NOT NULL 
  AND assigned_to IS NULL;

ALTER TABLE public.crm_conversations ALTER COLUMN status TYPE public.crm_conversation_status_v2 USING status::public.crm_conversation_status_v2;
ALTER TABLE public.crm_conversations ALTER COLUMN status SET DEFAULT 'bot'::public.crm_conversation_status_v2;

-- 8. UNICIDADE MULTI-TENANT
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'crm_conv_unique_active_idx') THEN
        CREATE UNIQUE INDEX crm_conv_unique_active_idx ON public.crm_conversations (establishment_id, customer_phone) WHERE status <> 'closed';
    END IF;
END $$;

-- 9. LOCK PERSISTENTE ATÔMICO
CREATE TABLE IF NOT EXISTS public.crm_conversation_locks (
    conversation_id uuid PRIMARY KEY REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
    owner_token text NOT NULL,
    locked_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL
);
ALTER TABLE public.crm_conversation_locks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.crm_conversation_locks TO service_role;

-- 10. FUNÇÕES E SEGURANÇA
CREATE OR REPLACE FUNCTION public.check_establishment_access(target_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN false; END IF;
    RETURN (public.is_super_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.establishment_members WHERE user_id = auth.uid() AND establishment_id = target_id AND active = true));
END; $$;
REVOKE ALL ON FUNCTION public.check_establishment_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_establishment_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.acquire_crm_lock(_conv_id uuid, _token text, _ttl_sec int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected_id uuid;
BEGIN
    INSERT INTO public.crm_conversation_locks (conversation_id, owner_token, locked_at, expires_at)
    VALUES (_conv_id, _token, now(), now() + (_ttl_sec || ' seconds')::interval)
    ON CONFLICT (conversation_id) DO UPDATE SET owner_token = EXCLUDED.owner_token, locked_at = EXCLUDED.locked_at, expires_at = EXCLUDED.expires_at
    WHERE public.crm_conversation_locks.expires_at <= now() RETURNING conversation_id INTO affected_id;
    RETURN affected_id IS NOT NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.release_crm_lock(_conv_id uuid, _token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM public.crm_conversation_locks WHERE conversation_id = _conv_id AND owner_token = _token; RETURN FOUND; END; $$;

REVOKE ALL ON FUNCTION public.acquire_crm_lock(uuid,text,int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_crm_lock(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquire_crm_lock(uuid,text,int) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_crm_lock(uuid,text) TO service_role;

-- 11. RLS
DO $$
DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY['whatsapp_providers', 'crm_flows', 'crm_flow_steps', 'crm_conversations', 'crm_messages']) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Access" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Tenant Access" ON public.%I FOR ALL USING (public.check_establishment_access(establishment_id)) WITH CHECK (public.check_establishment_access(establishment_id))', t);
    END LOOP;
END $$;

-- 12. FINALIZAÇÃO
ALTER TABLE public.whatsapp_providers ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE public.crm_flows ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE public.crm_flow_steps ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE public.crm_conversations ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE public.crm_messages ALTER COLUMN establishment_id SET NOT NULL;

COMMIT;
