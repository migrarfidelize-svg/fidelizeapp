select cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--6fbe0482-baab-4f96-abc8-c1c72bc2e46e.lovable.app/api/public/hooks/process-email-queue',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_2sUhikcI4e0c5g0n0GgZjQ_n3SS75gF"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);