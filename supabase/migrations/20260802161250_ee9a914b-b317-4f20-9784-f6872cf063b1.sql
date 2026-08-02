-- ============ CONVERSAS ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  contact_phone text NOT NULL,
  contact_name text,
  contact_avatar_url text,
  external_chat_id text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','in_progress','waiting_customer','waiting_payment','waiting_department','finished','reopened')),
  priority smallint NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department text,
  tags text[] NOT NULL DEFAULT '{}',
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  finished_at timestamptz,
  reopened_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_est_phone_uidx
  ON public.conversations (establishment_id, channel, contact_phone);
CREATE INDEX IF NOT EXISTS conversations_est_status_idx
  ON public.conversations (establishment_id, status, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS conversations_assigned_idx
  ON public.conversations (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS conversations_customer_idx ON public.conversations (customer_id);

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_select_members" ON public.conversations FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "conv_insert_members" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "conv_update_members" ON public.conversations FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ MENSAGENS ============
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type text NOT NULL DEFAULT 'customer'
    CHECK (sender_type IN ('customer','agent','automation','system')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text','image','video','audio','document','sticker','location','contact','unknown')),
  body text,
  media_url text,
  media_mime text,
  media_name text,
  external_message_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','read','failed','received')),
  error_message text,
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_msg_conversation_idx
  ON public.conversation_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conv_msg_est_idx ON public.conversation_messages (establishment_id);
CREATE UNIQUE INDEX IF NOT EXISTS conv_msg_external_uidx
  ON public.conversation_messages (establishment_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.conversation_messages TO authenticated;
GRANT ALL ON public.conversation_messages TO service_role;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_msg_select_members" ON public.conversation_messages FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "conv_msg_insert_members" ON public.conversation_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

CREATE TRIGGER trg_conv_msg_updated_at BEFORE UPDATE ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ EVENTOS INTERNOS DA TIMELINE ============
CREATE TABLE IF NOT EXISTS public.conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text,
  description text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_event_conversation_idx
  ON public.conversation_events (conversation_id, created_at DESC);

GRANT SELECT, INSERT ON public.conversation_events TO authenticated;
GRANT ALL ON public.conversation_events TO service_role;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_event_select_members" ON public.conversation_events FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "conv_event_insert_members" ON public.conversation_events FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- ============ ATRIBUIÇÕES ============
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_assign_conversation_idx
  ON public.conversation_assignments (conversation_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.conversation_assignments TO authenticated;
GRANT ALL ON public.conversation_assignments TO service_role;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_assign_select_members" ON public.conversation_assignments FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
CREATE POLICY "conv_assign_insert_members" ON public.conversation_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- ============ MODELOS DE MENSAGEM ============
CREATE TABLE IF NOT EXISTS public.conversation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  shortcut text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conv_tpl_est_idx ON public.conversation_templates (establishment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_templates TO authenticated;
GRANT ALL ON public.conversation_templates TO service_role;
ALTER TABLE public.conversation_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_tpl_all_members" ON public.conversation_templates FOR ALL TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

CREATE TRIGGER trg_conv_tpl_updated_at BEFORE UPDATE ON public.conversation_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- ============ EVENTOS DE WEBHOOK (somente servidor) ============
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'uazapi',
  external_instance_id text,
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE SET NULL,
  event_type text,
  dedupe_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wa_webhook_dedupe_uidx
  ON public.whatsapp_webhook_events (provider, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_webhook_created_idx ON public.whatsapp_webhook_events (created_at DESC);

GRANT ALL ON public.whatsapp_webhook_events TO service_role;
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

-- ============ FILA INTERNA ============
CREATE TABLE IF NOT EXISTS public.automation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  priority smallint NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  idempotency_key text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_jobs_idem_uidx
  ON public.automation_jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS automation_jobs_claim_idx
  ON public.automation_jobs (status, run_after, priority DESC);
CREATE INDEX IF NOT EXISTS automation_jobs_est_idx ON public.automation_jobs (establishment_id);

GRANT SELECT ON public.automation_jobs TO authenticated;
GRANT ALL ON public.automation_jobs TO service_role;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_members" ON public.automation_jobs FOR SELECT TO authenticated
  USING (establishment_id IS NOT NULL AND public.has_establishment_access(auth.uid(), establishment_id));

CREATE TRIGGER trg_automation_jobs_updated_at BEFORE UPDATE ON public.automation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- Reivindicação atômica de tarefas (evita processamento duplicado)
CREATE OR REPLACE FUNCTION public.claim_automation_jobs(_worker text, _limit integer DEFAULT 10)
RETURNS SETOF public.automation_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH picked AS (
    SELECT id FROM public.automation_jobs
    WHERE status = 'pending' AND run_after <= now()
    ORDER BY priority DESC, run_after ASC
    LIMIT GREATEST(_limit, 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.automation_jobs j
  SET status = 'processing', locked_at = now(), locked_by = _worker,
      attempts = j.attempts + 1, updated_at = now()
  FROM picked p WHERE j.id = p.id
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION public.claim_automation_jobs(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_automation_jobs(text, integer) TO service_role;

-- Realtime para a Central de Atendimento
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_events;