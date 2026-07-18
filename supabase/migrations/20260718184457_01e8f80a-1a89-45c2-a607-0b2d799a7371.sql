
-- Staff of the establishment can insert stamps
CREATE POLICY stamps_member_insert ON public.stamps
  FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- Staff can update stamps (used for undo / reverted_at)
CREATE POLICY stamps_member_update ON public.stamps
  FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- Staff can update loyalty_cards (stamp balance, cycle)
CREATE POLICY card_member_update ON public.loyalty_cards
  FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- Staff can insert loyalty_cards (edge case: creating card on the fly)
CREATE POLICY card_member_insert ON public.loyalty_cards
  FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- Staff can insert rewards when a card completes
CREATE POLICY rewards_member_insert ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));

-- Staff can update rewards (redeemed_at etc.)
CREATE POLICY rewards_member_update ON public.rewards
  FOR UPDATE TO authenticated
  USING (public.has_establishment_access(auth.uid(), establishment_id))
  WITH CHECK (public.has_establishment_access(auth.uid(), establishment_id));
