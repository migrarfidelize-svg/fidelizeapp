
INSERT INTO public.plan_features (plan_id, feature_key, feature_name, enabled, limit_value)
SELECT p.id, 'push_notifications', 'Notificações push', (p.tier <> 'free'),
  CASE p.tier
    WHEN 'free' THEN 0
    WHEN 'starter' THEN 1
    WHEN 'pro' THEN 5
    WHEN 'enterprise' THEN NULL
    ELSE NULL
  END
FROM public.plans p
ON CONFLICT (plan_id, feature_key) DO UPDATE
SET feature_name = EXCLUDED.feature_name,
    enabled = EXCLUDED.enabled,
    limit_value = COALESCE(public.plan_features.limit_value, EXCLUDED.limit_value);
