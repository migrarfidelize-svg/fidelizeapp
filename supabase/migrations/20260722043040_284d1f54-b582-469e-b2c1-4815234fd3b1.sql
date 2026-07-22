
-- 1) reviews: forgery-proof insert
DROP POLICY IF EXISTS "reviews insert public" ON public.reviews;
CREATE POLICY "reviews insert authenticated"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = reviews.customer_id
        AND c.user_id = auth.uid()
        AND c.establishment_id = reviews.establishment_id
    )
    AND (
      stamp_id IS NULL OR EXISTS (
        SELECT 1 FROM public.stamps s
        JOIN public.loyalty_cards lc ON lc.id = s.card_id
        WHERE s.id = reviews.stamp_id
          AND lc.customer_id = reviews.customer_id
      )
    )
    AND (
      card_id IS NULL OR EXISTS (
        SELECT 1 FROM public.loyalty_cards lc
        WHERE lc.id = reviews.card_id
          AND lc.customer_id = reviews.customer_id
      )
    )
  );

-- 2) kb_feedback: require existing article
DROP POLICY IF EXISTS "kbf_insert" ON public.kb_feedback;
CREATE POLICY "kbf_insert_valid_article"
  ON public.kb_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.kb_articles a WHERE a.id = kb_feedback.article_id)
  );

-- 3) help_feedback: require existing article
DROP POLICY IF EXISTS "help_feedback_insert_authed" ON public.help_feedback;
CREATE POLICY "help_feedback_insert_valid_article"
  ON public.help_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.help_articles a WHERE a.id = help_feedback.article_id)
  );

-- 4) help_article_views: require existing article
DROP POLICY IF EXISTS "help_article_views_insert_authed" ON public.help_article_views;
CREATE POLICY "help_article_views_insert_valid_article"
  ON public.help_article_views FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.help_articles a WHERE a.id = help_article_views.article_id)
  );

-- 5) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- Trigger functions never need to be called directly by clients — Postgres runs them as table owner.
REVOKE EXECUTE ON FUNCTION public.tg_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recompute_tier_after_stamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_rewards_check_achievements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_stamps_check_achievements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_support_message_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_support_status_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_establishment_subscription_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_ticket_first_response() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_ticket_defaults() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_merchant_messages_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_past_due_subscriptions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_unlock_achievements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_tier(integer, jsonb) FROM PUBLIC, anon, authenticated;
