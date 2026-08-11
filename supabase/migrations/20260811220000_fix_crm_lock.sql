-- Create acquire_crm_lock function if not exists
CREATE OR REPLACE FUNCTION public.acquire_crm_lock(_conv_id uuid, _token text, _ttl_sec int DEFAULT 30)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now timestamp := now();
  v_locked boolean;
BEGIN
  -- Simple lock using system_settings or a dedicated locks table
  -- Here we use a dedicated table for better performance
  CREATE TABLE IF NOT EXISTS public.crm_conversation_locks (
    conversation_id uuid PRIMARY KEY,
    token text NOT NULL,
    expires_at timestamp NOT NULL
  );

  -- Cleanup expired locks
  DELETE FROM public.crm_conversation_locks WHERE expires_at < v_now;

  -- Try to insert lock
  BEGIN
    INSERT INTO public.crm_conversation_locks (conversation_id, token, expires_at)
    VALUES (_conv_id, _token, v_now + (_ttl_sec || ' seconds')::interval);
    v_locked := true;
  EXCEPTION WHEN unique_violation THEN
    -- Already locked by someone else
    v_locked := false;
  END;

  RETURN v_locked;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_crm_lock(_conv_id uuid, _token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.crm_conversation_locks 
  WHERE conversation_id = _conv_id AND token = _token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acquire_crm_lock TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_crm_lock TO authenticated, service_role;
