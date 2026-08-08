-- Migration: Safe + Idempotent Broadcast Recipient Status Functions
-- Date: 2026-08-08

-- ============================================================
-- MARK RECIPIENT AS SENT
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_broadcast_recipient_sent(
  p_recipient_id UUID,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_broadcast_id UUID;
  v_previous_status TEXT;
BEGIN
  SELECT broadcast_id, status
  INTO v_broadcast_id, v_previous_status
  FROM public.crm_broadcast_recipients
  WHERE id = p_recipient_id
  FOR UPDATE;

  IF v_broadcast_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Terminal states: do not process again
  IF v_previous_status IN ('sent', 'delivered', 'read', 'skipped') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.crm_broadcast_recipients
  SET
    status = 'sent',
    provider_message_id = COALESCE(
      p_provider_message_id,
      provider_message_id
    ),
    sent_at = COALESCE(sent_at, now()),
    last_error = NULL,
    failed_at = NULL
  WHERE id = p_recipient_id;

  UPDATE public.crm_broadcasts
  SET
    sent_count = sent_count + 1,
    failed_count = CASE
      WHEN v_previous_status = 'failed'
        THEN GREATEST(failed_count - 1, 0)
      ELSE failed_count
    END,
    updated_at = now()
  WHERE id = v_broadcast_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- MARK RECIPIENT AS FAILED
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_broadcast_recipient_failed(
  p_recipient_id UUID,
  p_error TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_broadcast_id UUID;
  v_previous_status TEXT;
BEGIN
  SELECT broadcast_id, status
  INTO v_broadcast_id, v_previous_status
  FROM public.crm_broadcast_recipients
  WHERE id = p_recipient_id
  FOR UPDATE;

  IF v_broadcast_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Do not count the same failure twice
  IF v_previous_status = 'failed' THEN
    RETURN FALSE;
  END IF;

  -- Terminal states cannot become failed
  IF v_previous_status IN ('sent', 'delivered', 'read', 'skipped') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.crm_broadcast_recipients
  SET
    status = 'failed',
    attempts = attempts + 1,
    last_error = p_error,
    failed_at = now()
  WHERE id = p_recipient_id;

  UPDATE public.crm_broadcasts
  SET
    failed_count = failed_count + 1,
    updated_at = now()
  WHERE id = v_broadcast_id;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- REMOVE CLIENT/PUBLIC EXECUTION
-- ============================================================
REVOKE ALL ON FUNCTION public.mark_broadcast_recipient_sent(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_broadcast_recipient_sent(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.mark_broadcast_recipient_sent(UUID, TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.mark_broadcast_recipient_failed(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_broadcast_recipient_failed(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.mark_broadcast_recipient_failed(UUID, TEXT) FROM authenticated;

-- ============================================================
-- SERVICE ROLE ONLY
-- ============================================================
GRANT EXECUTE ON FUNCTION public.mark_broadcast_recipient_sent(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_broadcast_recipient_failed(UUID, TEXT) TO service_role;
