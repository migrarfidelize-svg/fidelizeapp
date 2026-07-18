
CREATE TABLE public.system_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_api_key text NOT NULL,
  sender_email text NOT NULL,
  sender_name text NOT NULL,
  reply_to text,
  singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_email_settings_singleton_unique UNIQUE (singleton)
);
GRANT ALL ON public.system_email_settings TO service_role;
ALTER TABLE public.system_email_settings ENABLE ROW LEVEL SECURITY;
-- No authenticated/anon policies: table is only read/written by the backend via service_role
-- after verifying is_super_admin() in the server function.

CREATE TRIGGER trg_system_email_settings_updated_at
  BEFORE UPDATE ON public.system_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  template text,
  status text NOT NULL CHECK (status IN ('sent','failed','test')),
  resend_id text,
  error text,
  duration_ms integer,
  actor_id uuid,
  establishment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read email logs" ON public.email_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE INDEX idx_email_logs_created_at ON public.email_logs (created_at DESC);
