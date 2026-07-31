CREATE OR REPLACE FUNCTION public.has_active_subscription(_est uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT e.active
       AND e.archived_at IS NULL
       AND EXISTS (
         SELECT 1 FROM public.subscriptions s
         WHERE s.establishment_id = e.id
           AND s.status IN ('active','trial','trialing')
           AND (s.current_period_end IS NULL OR s.current_period_end > now() - interval '3 days')
       )
    FROM public.establishments e
    WHERE e.id = _est
  ), false);
$function$;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY['trial','trialing','active','pending','awaiting_payment','past_due','cancelled','suspended','incomplete']));