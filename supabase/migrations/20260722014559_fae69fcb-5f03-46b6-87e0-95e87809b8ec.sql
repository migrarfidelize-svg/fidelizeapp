
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_unq;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_customer_endpoint_unq
  ON public.push_subscriptions (customer_id, endpoint)
  WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_unq
  ON public.push_subscriptions (user_id, endpoint)
  WHERE user_id IS NOT NULL AND customer_id IS NULL;
