// Server-only segmentation resolver for push broadcasts.
// Given an establishment + segment filter, returns customer_ids that match.

export type PushSegment = {
  tiers?: Array<"bronze" | "prata" | "ouro" | "diamante">;
  activity?: "all" | "active_30d" | "inactive_30d" | "inactive_60d";
  campaign_id?: string | null;
  min_stamps?: number | null;
};

export async function resolveSegmentCustomerIds(
  establishmentId: string,
  segment: PushSegment | null | undefined,
): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const seg = segment ?? {};

  let q = supabaseAdmin
    .from("customers")
    .select("id, tier, last_visit_at")
    .eq("establishment_id", establishmentId)
    .eq("blocked", false);

  if (seg.tiers && seg.tiers.length > 0) {
    q = q.in("tier", seg.tiers);
  }

  const now = Date.now();
  if (seg.activity === "active_30d") {
    q = q.gte("last_visit_at", new Date(now - 30 * 86400_000).toISOString());
  } else if (seg.activity === "inactive_30d") {
    q = q.or(
      `last_visit_at.is.null,last_visit_at.lt.${new Date(now - 30 * 86400_000).toISOString()}`,
    );
  } else if (seg.activity === "inactive_60d") {
    q = q.or(
      `last_visit_at.is.null,last_visit_at.lt.${new Date(now - 60 * 86400_000).toISOString()}`,
    );
  }

  const { data: baseCustomers, error } = await q;
  if (error) throw error;
  let ids = (baseCustomers ?? []).map((c) => c.id);
  if (ids.length === 0) return [];

  // Card-based filters
  if (seg.campaign_id || (seg.min_stamps ?? 0) > 0) {
    let cq = supabaseAdmin
      .from("loyalty_cards")
      .select("customer_id, stamps, campaign_id")
      .eq("establishment_id", establishmentId)
      .in("customer_id", ids);
    if (seg.campaign_id) cq = cq.eq("campaign_id", seg.campaign_id);
    if ((seg.min_stamps ?? 0) > 0) cq = cq.gte("stamps", seg.min_stamps as number);
    const { data: cards } = await cq;
    const keep = new Set((cards ?? []).map((c) => c.customer_id));
    ids = ids.filter((id) => keep.has(id));
  }

  return ids;
}
