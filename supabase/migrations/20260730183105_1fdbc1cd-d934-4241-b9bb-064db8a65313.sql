CREATE TABLE public.auth_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text,
  identifier text,
  action text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_attempts_ip_idx ON public.auth_attempts (ip, created_at DESC);
CREATE INDEX auth_attempts_identifier_idx ON public.auth_attempts (identifier, created_at DESC);
CREATE INDEX auth_attempts_created_idx ON public.auth_attempts (created_at DESC);

GRANT ALL ON public.auth_attempts TO service_role;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read auth attempts"
ON public.auth_attempts FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

INSERT INTO public.log_retention_policies (table_name, timestamp_column, retention_days)
VALUES ('auth_attempts', 'created_at', 30)
ON CONFLICT DO NOTHING;