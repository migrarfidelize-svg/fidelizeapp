CREATE TABLE IF NOT EXISTS public.whatsapp_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  is_enabled boolean NOT NULL DEFAULT false,
  base_url text,
  encrypted_api_token text,
  encrypted_webhook_secret text,
  mode text NOT NULL DEFAULT 'production',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_test_status text,
  last_test_message text,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.whatsapp_providers TO service_role;
ALTER TABLE public.whatsapp_providers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_whatsapp_providers_updated BEFORE UPDATE ON public.whatsapp_providers
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'uazapi',
  external_instance_id text,
  connected_phone text,
  connection_status text NOT NULL DEFAULT 'disconnected',
  qr_status text,
  qr_expires_at timestamptz,
  connected_at timestamptz,
  disconnected_at timestamptz,
  last_checked_at timestamptz,
  last_activity_at timestamptz,
  last_error text,
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_connections_status_chk CHECK (connection_status IN
    ('disconnected','initializing','qr_pending','scanned','connected','failed','suspended')),
  CONSTRAINT whatsapp_connections_est_provider_uk UNIQUE (establishment_id, provider)
);
GRANT SELECT ON public.whatsapp_connections TO authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_conn_member_read" ON public.whatsapp_connections
  FOR SELECT TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id) OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_whatsapp_connections_updated BEFORE UPDATE ON public.whatsapp_connections
FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_connection_secrets (
  connection_id uuid PRIMARY KEY REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  encrypted_instance_token text,
  webhook_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connection_secrets_token_uk
  ON public.whatsapp_connection_secrets (webhook_token);
GRANT ALL ON public.whatsapp_connection_secrets TO service_role;
ALTER TABLE public.whatsapp_connection_secrets ENABLE ROW LEVEL SECURITY;