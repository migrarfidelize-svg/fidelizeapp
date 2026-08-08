-- Migration: CRM Broadcasts Professional Engine (Final Version)
-- Date: 2026-08-08

-- ============================================================
-- 1. EXTEND CRM CONTACTS
-- ============================================================
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS accept_communications BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS name_source TEXT;
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Name source control
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'crm_contacts_name_source_check'
  ) THEN
    ALTER TABLE public.crm_contacts
      ADD CONSTRAINT crm_contacts_name_source_check
      CHECK (
        name_source IS NULL
        OR name_source IN ('manual', 'flow', 'push_name')
      );
  END IF;
END $$;

-- ============================================================
-- 2. BROADCASTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'scheduled',
        'queued',
        'running',
        'paused',
        'completed',
        'cancelled',
        'failed'
      )
    ),
  provider TEXT,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  queued_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================================
-- 3. BROADCAST RECIPIENTS / QUEUE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.crm_broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL
    REFERENCES public.crm_broadcasts(id)
    ON DELETE CASCADE,
  contact_id UUID NOT NULL
    REFERENCES public.crm_contacts(id),
  phone TEXT NOT NULL,
  rendered_message TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (
      status IN (
        'queued',
        'sending',
        'accepted',
        'sent',
        'delivered',
        'read',
        'failed',
        'skipped'
      )
    ),
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (broadcast_id, contact_id)
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_crm_broadcasts_status
  ON public.crm_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_crm_broadcasts_scheduled_at
  ON public.crm_broadcasts(scheduled_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_recipients_queue
  ON public.crm_broadcast_recipients(broadcast_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_recipients_contact
  ON public.crm_broadcast_recipients(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_broadcast_recipients_provider_message
  ON public.crm_broadcast_recipients(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- ============================================================
-- 5. RLS & PERMISSIONS
-- ============================================================
ALTER TABLE public.crm_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT ON public.crm_broadcasts TO authenticated;
GRANT SELECT ON public.crm_broadcast_recipients TO authenticated;
GRANT ALL ON public.crm_broadcasts TO service_role;
GRANT ALL ON public.crm_broadcast_recipients TO service_role;

-- Policies (Restricted to is_super_admin)
DROP POLICY IF EXISTS "Admins can manage broadcasts" ON public.crm_broadcasts;
DROP POLICY IF EXISTS "Admins can manage recipients" ON public.crm_broadcast_recipients;
DROP POLICY IF EXISTS "Super admins can read broadcasts" ON public.crm_broadcasts;
DROP POLICY IF EXISTS "Super admins can read broadcast recipients" ON public.crm_broadcast_recipients;

CREATE POLICY "Super admins can read broadcasts"
ON public.crm_broadcasts
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can read broadcast recipients"
ON public.crm_broadcast_recipients
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
