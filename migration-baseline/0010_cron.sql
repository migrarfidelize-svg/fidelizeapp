-- 0010_cron.sql — substituir <APP_URL> e <ANON_KEY> antes de aplicar
SELECT cron.schedule('process-email-queue', '* * * * *', $$
  SELECT net.http_post(
    url := '<APP_URL>/api/public/hooks/process-email-queue',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_KEY>'),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('fidelize-birthday-daily', '0 9 * * *', $$
  SELECT net.http_post(
    url := '<APP_URL>/api/public/cron/birthday',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_KEY>'),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('fidelize-reengagement-daily', '0 11 * * *', $$
  SELECT net.http_post(
    url := '<APP_URL>/api/public/cron/reengagement',
    headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_KEY>'),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('fidelize-mark-past-due', '0 3 * * *', $$
  SELECT public.mark_past_due_subscriptions();
$$);
