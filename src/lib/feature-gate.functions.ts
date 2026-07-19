import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Merchant/staff logs an attempted use of a plan-gated feature (e.g. QR review target
// clicked while the plan doesn't include `public_reviews`).
export const logFeatureBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
    action: z.string().min(1).max(80),
    context: z.record(z.any()).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est } = await supabase.from("establishments")
      .select("plan").eq("id", data.establishment_id).maybeSingle();
    const { error } = await supabase.from("feature_gate_events").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      feature_key: data.feature_key,
      action: data.action,
      context: data.context ?? {},
      plan_tier: est?.plan ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles")
    .select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}

export const adminListFeatureGateEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    feature_key: z.string().min(1).max(60).optional(),
    days: z.number().int().min(1).max(365).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const since = new Date(Date.now() - (data.days ?? 30) * 86400000).toISOString();
    let q = context.supabase.from("feature_gate_events")
      .select("id, establishment_id, user_id, feature_key, action, context, plan_tier, created_at, establishments(id, name, slug)")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.feature_key) q = q.eq("feature_key", data.feature_key);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // enrich with user emails via admin client
    const userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
    let userMap: Record<string, { email?: string; name?: string }> = {};
    if (userIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin.from("profiles")
        .select("id, full_name").in("id", userIds);
      for (const p of profiles ?? []) userMap[p.id] = { name: p.full_name ?? undefined };
      for (const uid of userIds) {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid as string);
          if (u?.user?.email) userMap[uid as string] = { ...(userMap[uid as string] ?? {}), email: u.user.email };
        } catch { /* ignore */ }
      }
    }
    return (rows ?? []).map((r: any) => ({
      ...r,
      user_email: r.user_id ? userMap[r.user_id]?.email ?? null : null,
      user_name: r.user_id ? userMap[r.user_id]?.name ?? null : null,
    }));
  });

export const adminFeatureGateSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ days: z.number().int().min(1).max(365).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const since = new Date(Date.now() - (data.days ?? 30) * 86400000).toISOString();
    const { data: rows } = await context.supabase.from("feature_gate_events")
      .select("feature_key, establishment_id")
      .gte("created_at", since);
    const byFeature: Record<string, number> = {};
    const estsByFeature: Record<string, Set<string>> = {};
    for (const r of rows ?? []) {
      byFeature[r.feature_key] = (byFeature[r.feature_key] ?? 0) + 1;
      (estsByFeature[r.feature_key] ??= new Set()).add(r.establishment_id);
    }
    return {
      total: (rows ?? []).length,
      byFeature: Object.entries(byFeature).map(([k, count]) => ({
        feature_key: k, count, distinct_establishments: estsByFeature[k].size,
      })).sort((a, b) => b.count - a.count),
    };
  });
