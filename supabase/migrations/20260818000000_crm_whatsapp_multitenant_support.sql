-- Tenant-safe WhatsApp CRM state. Existing platform support tickets require an
-- authenticated requester, so WhatsApp handoffs use a CRM-native ticket linked
-- one-to-one to the conversation instead of fabricating an auth user.
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;

-- O schema original tinha UNIQUE(phone), o que impedia o mesmo consumidor de
-- conversar com dois tenants. Remova somente essa constraint legada antes de
-- criar a chave composta.
ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_phone_key;

UPDATE public.crm_contacts contact
SET establishment_id = tenant.establishment_id
FROM (
  SELECT contact_id, min(establishment_id::text)::uuid AS establishment_id
  FROM public.crm_conversations
  WHERE contact_id IS NOT NULL
  GROUP BY contact_id
  HAVING count(DISTINCT establishment_id) = 1
) tenant
WHERE tenant.contact_id = contact.id
  AND contact.establishment_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_tenant_phone_uidx
  ON public.crm_contacts(establishment_id, phone);
-- Conversas já possuem crm_conv_unique_active_idx, criado pela migration
-- multi-tenant anterior. Não imponha UNIQUE total: histórico fechado pode ter
-- mais de uma conversa para o mesmo telefone.

CREATE TABLE IF NOT EXISTS public.crm_agent_settings (
  establishment_id uuid PRIMARY KEY REFERENCES public.establishments(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_agent_settings_flow_tenant_fk
    FOREIGN KEY (flow_id, establishment_id)
    REFERENCES public.crm_flows(id, establishment_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.crm_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.crm_conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_support_ticket_tenant_fk
    FOREIGN KEY (conversation_id, establishment_id)
    REFERENCES public.crm_conversations(id, establishment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_support_one_open_per_conversation
  ON public.crm_support_tickets(conversation_id) WHERE status IN ('open', 'in_progress');

ALTER TABLE public.crm_agent_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_support_tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.crm_agent_settings, public.crm_support_tickets TO authenticated;
GRANT ALL ON public.crm_agent_settings, public.crm_support_tickets TO service_role;

DROP POLICY IF EXISTS "crm_agent_settings_tenant_read" ON public.crm_agent_settings;
CREATE POLICY "crm_agent_settings_tenant_read" ON public.crm_agent_settings
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));
DROP POLICY IF EXISTS "crm_support_tickets_tenant_read" ON public.crm_support_tickets;
CREATE POLICY "crm_support_tickets_tenant_read" ON public.crm_support_tickets
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_support_tickets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
