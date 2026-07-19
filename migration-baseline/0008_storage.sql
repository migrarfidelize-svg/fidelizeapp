-- 0008_storage.sql
INSERT INTO storage.buckets (id, name, public) VALUES
  ('logos', 'logos', false),
  ('ticket-attachments', 'ticket-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies em storage.objects — extrair da ORIGEM:
--   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname='storage';
