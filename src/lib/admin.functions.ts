import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.rpc("is_super_admin", { _user: userId });
    // Bootstrap: allow claiming super_admin if none exists yet
    const { count } = await supabase
      .from("app_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    return { isAdmin: !!data, canBootstrap: (count ?? 0) === 0 };
  });

export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("app_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");
    if ((count ?? 0) > 0) throw new Error("Já existe um administrador da plataforma.");
    const { error } = await supabaseAdmin.from("app_roles").insert({ user_id: userId, role: "super_admin" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const [
      { count: estTotal },
      { count: estActive },
      { count: estBlocked },
      { count: customersTotal },
      { count: stampsTotal },
      { count: rewardsTotal },
      { count: rewardsRedeemed },
      { data: byPlan },
      { data: recentStamps },
      { data: recentEsts },
    ] = await Promise.all([
      supabase.from("establishments").select("*", { count: "exact", head: true }),
      supabase.from("establishments").select("*", { count: "exact", head: true }).eq("active", true),
      supabase.from("establishments").select("*", { count: "exact", head: true }).eq("active", false),
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("stamps").select("*", { count: "exact", head: true }).is("reverted_at", null),
      supabase.from("rewards").select("*", { count: "exact", head: true }),
      supabase.from("rewards").select("*", { count: "exact", head: true }).not("redeemed_at", "is", null),
      supabase.from("establishments").select("plan"),
      supabase.from("stamps").select("created_at").is("reverted_at", null).gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      supabase.from("establishments").select("id, name, slug, plan, active, created_at").order("created_at", { ascending: false }).limit(6),
    ]);

    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, business: 0 };
    (byPlan ?? []).forEach((r: { plan: string }) => { planCounts[r.plan] = (planCounts[r.plan] ?? 0) + 1; });

    const map = new Map<string, number>();
    (recentStamps ?? []).forEach((s: { created_at: string }) => {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    const series: { day: string; carimbos: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      series.push({ day: d.slice(5), carimbos: map.get(d) ?? 0 });
    }

    // Plans catalog for MRR estimate
    const { data: plans } = await supabase.from("plans").select("tier, price_monthly");
    const priceMap = new Map<string, number>((plans ?? []).map((p: any) => [p.tier, Number(p.price_monthly)]));
    const mrr = Object.entries(planCounts).reduce((sum, [tier, count]) => sum + (priceMap.get(tier) ?? 0) * count, 0);

    return {
      estTotal: estTotal ?? 0,
      estActive: estActive ?? 0,
      estBlocked: estBlocked ?? 0,
      customersTotal: customersTotal ?? 0,
      stampsTotal: stampsTotal ?? 0,
      rewardsTotal: rewardsTotal ?? 0,
      rewardsRedeemed: rewardsRedeemed ?? 0,
      planCounts,
      series,
      recentEsts: recentEsts ?? [],
      mrr,
    };
  });

export const adminListEstablishments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    query: z.string().trim().max(80).optional(),
    status: z.enum(["all", "active", "blocked"]).default("all"),
    plan: z.enum(["all", "free", "starter", "pro", "business"]).default("all"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    let q = supabase.from("establishments").select("id, name, slug, plan, active, phone, email, created_at, created_by").order("created_at", { ascending: false }).limit(200);
    if (data.status === "active") q = q.eq("active", true);
    if (data.status === "blocked") q = q.eq("active", false);
    if (data.plan !== "all") q = q.eq("plan", data.plan);
    if (data.query) q = q.or(`name.ilike.%${data.query}%,slug.ilike.%${data.query}%,email.ilike.%${data.query}%`);

    const { data: ests, error } = await q;
    if (error) throw new Error(error.message);
    if (!ests?.length) return [];

    const ids = ests.map(e => e.id);
    const ownerIds = ests.map(e => e.created_by).filter(Boolean) as string[];
    const [{ data: customerCounts }, { data: stampCounts }, { data: owners }] = await Promise.all([
      supabase.from("customers").select("establishment_id").in("establishment_id", ids),
      supabase.from("stamps").select("establishment_id").in("establishment_id", ids).is("reverted_at", null),
      ownerIds.length ? supabase.from("profiles").select("id, full_name").in("id", ownerIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const cc = new Map<string, number>();
    (customerCounts ?? []).forEach((r: any) => cc.set(r.establishment_id, (cc.get(r.establishment_id) ?? 0) + 1));
    const sc = new Map<string, number>();
    (stampCounts ?? []).forEach((r: any) => sc.set(r.establishment_id, (sc.get(r.establishment_id) ?? 0) + 1));
    const om = new Map<string, string>();
    (owners ?? []).forEach((p: any) => om.set(p.id, p.full_name));

    return ests.map(e => ({
      ...e,
      customers: cc.get(e.id) ?? 0,
      stamps: sc.get(e.id) ?? 0,
      owner_name: e.created_by ? om.get(e.created_by) ?? null : null,
    }));
  });

export const adminSetEstablishmentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("establishments").update({ active: data.active }).eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: data.active ? "admin_unblock" : "admin_block", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: {} as never,
    });
    return { ok: true };
  });

export const adminSetEstablishmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan: z.enum(["free", "starter", "pro", "business"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("establishments").update({ plan: data.plan }).eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: "admin_change_plan", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: { plan: data.plan } as never,
    });
    return { ok: true };
  });

export const adminDeleteEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("establishments").delete().eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
