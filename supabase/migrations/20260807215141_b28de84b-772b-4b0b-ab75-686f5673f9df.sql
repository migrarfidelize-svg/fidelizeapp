BEGIN;

-- Confirma a função de Super Admin antes de alterar o banco
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public' AND p.proname = 'is_super_admin'
  ) THEN
    RAISE EXCEPTION 'Função public.is_super_admin não existe';
  END IF;
END $$;

-- 1. ENUMS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'crm_conversation_status') THEN
    CREATE TYPE public.crm_conversation_status AS ENUM ('bot', 'waiting', 'assigned', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'crm_priority') THEN
    CREATE TYPE public.crm_priority AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typname = 'crm_message_type') THEN
    CREATE TYPE public.crm_message_type AS ENUM ('text', 'image', 'audio', 'video', 'document', 'location', 'vcard');
  END IF;
END $$;

-- 2. CONVERSAS
CREATE TABLE IF NOT EXISTS public.crm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  status public.crm_conversation_status NOT NULL DEFAULT 'bot',
  priority public.crm_priority NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT crm_conversations_phone_format CHECK (customer_phone ~ '^\+?[1-9][0-9]{1,14}$')
);

-- 3. MENSAGENS
CREATE TABLE IF NOT EXISTS public.crm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  message_type public.crm_message_type NOT NULL DEFAULT 'text',
  body text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  provider text NOT NULL,
  provider_message_id text NOT NULL,
  media_url text,
  media_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_messages_provider_msg_unique UNIQUE (provider, provider_message_id)
);

-- 4. NOTAS INTERNAS
CREATE TABLE IF NOT EXISTS public.crm_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. TAGS
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_conversation_tags (
  conversation_id uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, tag_id)
);

-- 6. FLUXOS
CREATE TABLE IF NOT EXISTS public.crm_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.crm_flows(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT crm_flow_steps_flow_key_unique UNIQUE (flow_id, step_key)
);

-- 7. RESPOSTAS RÁPIDAS
CREATE TABLE IF NOT EXISTS public.crm_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL UNIQUE,
  message text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 8. PRIVILÉGIOS
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['crm_conversations', 'crm_messages', 'crm_internal_notes', 'crm_tags', 'crm_conversation_tags', 'crm_flows', 'crm_flow_steps', 'crm_quick_replies'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- 9. UPDATED_AT & TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_crm_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.on_crm_message_inserted() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN UPDATE public.crm_conversations SET last_message_at = NEW.created_at, updated_at = now() WHERE id = NEW.conversation_id; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS tr_crm_conv_updated ON public.crm_conversations;
CREATE TRIGGER tr_crm_conv_updated BEFORE UPDATE ON public.crm_conversations FOR EACH ROW EXECUTE FUNCTION public.handle_crm_updated_at();

DROP TRIGGER IF EXISTS tr_crm_flows_updated ON public.crm_flows;
CREATE TRIGGER tr_crm_flows_updated BEFORE UPDATE ON public.crm_flows FOR EACH ROW EXECUTE FUNCTION public.handle_crm_updated_at();

DROP TRIGGER IF EXISTS tr_crm_msg_inserted ON public.crm_messages;
CREATE TRIGGER tr_crm_msg_inserted AFTER INSERT ON public.crm_messages FOR EACH ROW EXECUTE FUNCTION public.on_crm_message_inserted();

-- 10. RLS
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['crm_conversations', 'crm_messages', 'crm_internal_notes', 'crm_tags', 'crm_conversation_tags', 'crm_flows', 'crm_flow_steps', 'crm_quick_replies'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super Admin Select Access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Super Admin Select Access" ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))', t);
  END LOOP;
END $$;

-- 11. REALTIME
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_conversations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_conversations;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_messages;
  END IF;
END $$;

-- 12. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_crm_conv_phone ON public.crm_conversations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_crm_conv_status ON public.crm_conversations(status);
CREATE INDEX IF NOT EXISTS idx_crm_conv_assigned ON public.crm_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_conv_last_msg ON public.crm_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_msg_conv_created ON public.crm_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_crm_msg_provider_lookup ON public.crm_messages(provider, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_crm_notes_conversation ON public.crm_internal_notes(conversation_id, created_at);

COMMIT;

-- VERIFICAÇÃO FINAL
SELECT t.tablename, t.rowsecurity, (SELECT count(*) FROM pg_policies p WHERE p.tablename = t.tablename) as policies, has_table_privilege('authenticated', format('public.%I', t.tablename), 'SELECT') as auth_select
FROM pg_tables t WHERE t.schemaname = 'public' AND t.tablename LIKE 'crm_%';