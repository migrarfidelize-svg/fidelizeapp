-- Complete tenant ownership for CRM entities that were originally global.
-- Legacy rows without a provable owner remain quarantined with NULL and are
-- never returned by tenant-scoped application queries.
ALTER TABLE public.crm_internal_notes ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_tags ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_conversation_tags ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_templates ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_contact_tags ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_quick_replies ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_broadcasts ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;
ALTER TABLE public.crm_broadcast_recipients ADD COLUMN IF NOT EXISTS establishment_id uuid REFERENCES public.establishments(id) ON DELETE CASCADE;

UPDATE public.crm_internal_notes note SET establishment_id = conversation.establishment_id
FROM public.crm_conversations conversation WHERE note.conversation_id = conversation.id AND note.establishment_id IS NULL;
UPDATE public.crm_conversation_tags link SET establishment_id = conversation.establishment_id
FROM public.crm_conversations conversation WHERE link.conversation_id = conversation.id AND link.establishment_id IS NULL;
UPDATE public.crm_contact_tags link SET establishment_id = contact.establishment_id
FROM public.crm_contacts contact WHERE link.contact_id = contact.id AND link.establishment_id IS NULL;
UPDATE public.crm_broadcast_recipients recipient SET establishment_id = broadcast.establishment_id
FROM public.crm_broadcasts broadcast WHERE recipient.broadcast_id = broadcast.id AND recipient.establishment_id IS NULL;

ALTER TABLE public.crm_internal_notes ALTER COLUMN establishment_id SET NOT NULL;
ALTER TABLE public.crm_conversation_tags ALTER COLUMN establishment_id SET NOT NULL;

ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_phone_key;
ALTER TABLE public.crm_tags DROP CONSTRAINT IF EXISTS crm_tags_name_key;
ALTER TABLE public.crm_quick_replies DROP CONSTRAINT IF EXISTS crm_quick_replies_shortcut_key;

CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_tenant_name_uidx ON public.crm_tags(establishment_id, lower(name)) WHERE establishment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_quick_replies_tenant_shortcut_uidx ON public.crm_quick_replies(establishment_id, lower(shortcut)) WHERE establishment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_templates_tenant_idx ON public.crm_templates(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_notes_tenant_conversation_idx ON public.crm_internal_notes(establishment_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS crm_broadcasts_tenant_idx ON public.crm_broadcasts(establishment_id, created_at DESC);

DO $$ BEGIN
  ALTER TABLE public.crm_internal_notes ADD CONSTRAINT crm_internal_notes_tenant_fk
    FOREIGN KEY (conversation_id, establishment_id) REFERENCES public.crm_conversations(id, establishment_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_tenant_unique UNIQUE (id, establishment_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.crm_tags ADD CONSTRAINT crm_tags_tenant_unique UNIQUE (id, establishment_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.crm_contact_tags ADD CONSTRAINT crm_contact_tags_contact_tenant_fk
    FOREIGN KEY (contact_id, establishment_id) REFERENCES public.crm_contacts(id, establishment_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.crm_conversation_tags ADD CONSTRAINT crm_conversation_tags_conversation_tenant_fk
    FOREIGN KEY (conversation_id, establishment_id) REFERENCES public.crm_conversations(id, establishment_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.crm_broadcasts ADD CONSTRAINT crm_broadcasts_tenant_unique UNIQUE (id, establishment_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.crm_broadcast_recipients ADD CONSTRAINT crm_broadcast_recipients_tenant_fk
    FOREIGN KEY (broadcast_id, establishment_id) REFERENCES public.crm_broadcasts(id, establishment_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
