-- Migration: CRM Broadcasts (Disparos) Professional Engine
-- Date: 2026-08-08

-- 1. Extend crm_contacts with opt-out and name source
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS opt_out BOOLEAN DEFAULT FALSE;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS accept_communications BOOLEAN DEFAULT TRUE;
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS name_source TEXT; -- 'manual', 'flow', 'push_name'
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Broadcasts Table
CREATE TABLE public.crm_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message_template TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, scheduled, queued, running, paused, completed, cancelled, failed
    provider TEXT,
    total_contacts INTEGER DEFAULT 0,
    queued_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Broadcast Recipients Table (Queue)
CREATE TABLE public.crm_broadcast_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES public.crm_broadcasts(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.crm_contacts(id),
    phone TEXT NOT NULL,
    rendered_message TEXT,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, sending, accepted, sent, delivered, read, failed, skipped
    provider_message_id TEXT,
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    queued_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(broadcast_id, contact_id)
);

-- 4. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_broadcasts TO authenticated;
GRANT ALL ON public.crm_broadcasts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_broadcast_recipients TO authenticated;
GRANT ALL ON public.crm_broadcast_recipients TO service_role;
GRANT UPDATE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;

-- 5. RLS
ALTER TABLE public.crm_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_broadcast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcasts" ON public.crm_broadcasts
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage recipients" ON public.crm_broadcast_recipients
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
