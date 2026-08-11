DO $$
DECLARE
  contact_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO contact_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'crm_contacts'
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF contact_id_type IS NULL THEN
    RAISE EXCEPTION 'crm_contacts.id não encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_conversations'
      AND column_name = 'contact_id'
  ) THEN
    EXECUTE format(
      'ALTER TABLE public.crm_conversations ADD COLUMN contact_id %s',
      contact_id_type
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'crm_conversations'
      AND con.conname = 'crm_conversations_contact_id_fkey'
  ) THEN
    ALTER TABLE public.crm_conversations
      ADD CONSTRAINT crm_conversations_contact_id_fkey
      FOREIGN KEY (contact_id)
      REFERENCES public.crm_contacts(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_crm_conversations_contact_id
ON public.crm_conversations(contact_id);

NOTIFY pgrst, 'reload schema';