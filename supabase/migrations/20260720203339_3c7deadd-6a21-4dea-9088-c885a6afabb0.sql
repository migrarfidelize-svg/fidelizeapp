UPDATE public.payment_settings ps
SET
  environment = COALESCE(i.mode, ps.environment),
  public_key = COALESCE(NULLIF(i.credentials->>'public_key', ''), ps.public_key),
  updated_at = now()
FROM public.integrations i
WHERE i.category = 'payments'
  AND i.provider = 'mercadopago'
  AND (
    ps.environment IS DISTINCT FROM COALESCE(i.mode, ps.environment)
    OR ps.public_key IS DISTINCT FROM COALESCE(NULLIF(i.credentials->>'public_key', ''), ps.public_key)
  );