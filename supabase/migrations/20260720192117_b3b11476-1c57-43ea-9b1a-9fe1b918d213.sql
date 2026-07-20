ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS credentials jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS last_test_details jsonb;
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
REVOKE SELECT ON public.integrations FROM authenticated;
GRANT SELECT (id, category, provider, enabled, mode, config, credentials_ref, last_test_status, last_test_message, last_tested_at, last_test_details, created_at, updated_at, updated_by) ON public.integrations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;