REVOKE ALL ON public.email_queue FROM anon, authenticated;
REVOKE ALL ON public.email_templates FROM anon, authenticated;
REVOKE ALL ON public.system_email_settings FROM anon, authenticated;
REVOKE ALL ON public.wallet_pass_devices FROM anon, authenticated;

GRANT ALL ON public.email_queue TO service_role;
GRANT ALL ON public.email_templates TO service_role;
GRANT ALL ON public.system_email_settings TO service_role;
GRANT ALL ON public.wallet_pass_devices TO service_role;

CREATE POLICY "deny_all_client_access" ON public.email_queue FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_client_access" ON public.email_templates FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_client_access" ON public.system_email_settings FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_client_access" ON public.wallet_pass_devices FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);