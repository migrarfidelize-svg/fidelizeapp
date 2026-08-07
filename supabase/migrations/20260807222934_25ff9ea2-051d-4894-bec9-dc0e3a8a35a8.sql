BEGIN;

-- 1. CONTATOS DO CRM
CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    name text NOT NULL,
    phone text NOT NULL UNIQUE,
    email text,

    type text NOT NULL DEFAULT 'unidentified'
        CHECK (type IN (
            'customer',
            'establishment',
            'external',
            'unidentified'
        )),

    notes text,

    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT crm_contacts_phone_format
        CHECK (phone ~ '^\+?[1-9][0-9]{1,14}$')
);

-- 2. TEMPLATES
CREATE TABLE IF NOT EXISTS public.crm_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    name text NOT NULL,

    category text NOT NULL
        CHECK (category IN (
            'welcome',
            'support',
            'transfer',
            'off_hours',
            'closing',
            'followup',
            'finance',
            'otp',
            'custom'
        )),

    body text NOT NULL,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. TAGS DOS CONTATOS
CREATE TABLE IF NOT EXISTS public.crm_contact_tags (
    contact_id uuid NOT NULL
        REFERENCES public.crm_contacts(id) ON DELETE CASCADE,

    tag_id uuid NOT NULL
        REFERENCES public.crm_tags(id) ON DELETE CASCADE,

    PRIMARY KEY (contact_id, tag_id)
);

-- 4. PERMISSÕES
REVOKE ALL ON public.crm_contacts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.crm_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.crm_contact_tags FROM PUBLIC, anon, authenticated;

-- Frontend: somente leitura.
-- RLS decidirá se é Super Admin.
GRANT SELECT ON public.crm_contacts TO authenticated;
GRANT SELECT ON public.crm_templates TO authenticated;
GRANT SELECT ON public.crm_contact_tags TO authenticated;

-- Backend
GRANT ALL ON public.crm_contacts TO service_role;
GRANT ALL ON public.crm_templates TO service_role;
GRANT ALL ON public.crm_contact_tags TO service_role;

-- 5. RLS
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admin Select Access"
ON public.crm_contacts;

CREATE POLICY "Super Admin Select Access"
ON public.crm_contacts
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super Admin Select Access"
ON public.crm_templates;

CREATE POLICY "Super Admin Select Access"
ON public.crm_templates
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super Admin Select Access"
ON public.crm_contact_tags;

CREATE POLICY "Super Admin Select Access"
ON public.crm_contact_tags
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 6. UPDATED_AT (Assuming handle_crm_updated_at exists from previous CRM migration)
DROP TRIGGER IF EXISTS tr_crm_contacts_updated
ON public.crm_contacts;

CREATE TRIGGER tr_crm_contacts_updated
BEFORE UPDATE ON public.crm_contacts
FOR EACH ROW
EXECUTE FUNCTION public.handle_crm_updated_at();

DROP TRIGGER IF EXISTS tr_crm_templates_updated
ON public.crm_templates;

CREATE TRIGGER tr_crm_templates_updated
BEFORE UPDATE ON public.crm_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_crm_updated_at();

-- 7. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone
ON public.crm_contacts(phone);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_user
ON public.crm_contacts(user_id);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_type
ON public.crm_contacts(type);

CREATE INDEX IF NOT EXISTS idx_crm_templates_category
ON public.crm_templates(category);

CREATE INDEX IF NOT EXISTS idx_crm_templates_active
ON public.crm_templates(is_active);

COMMIT;
