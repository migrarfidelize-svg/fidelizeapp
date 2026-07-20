UPDATE public.payment_logs
SET
  processed = false,
  error = 'invalid_signature',
  reason = 'Assinatura HMAC inválida em evento live. Evento bloqueado e removido da fila de retry.',
  response_status = 401,
  next_retry_at = NULL
WHERE mode = 'live'
  AND signature_valid = false
  AND COALESCE(headers->>'detection_rule', 'live_mode_true') = 'live_mode_true'
  AND (
    processed = true
    OR response_status BETWEEN 200 AND 299
    OR reason ILIKE 'Recuperado no retry%'
  );

UPDATE public.payment_logs
SET next_retry_at = NULL
WHERE error IN ('invalid_signature', 'missing_webhook_secret')
   OR response_status IN (401, 403);