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

    const planCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, enterprise: 0 };
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

    // Real MRR: sum of price_monthly for establishments with an active paid subscription
    const { data: plans } = await supabase.from("plans").select("tier, price_monthly");
    const priceMap = new Map<string, number>((plans ?? []).map((p: any) => [p.tier, Number(p.price_monthly)]));
    const { data: activeSubs } = await supabase
      .from("subscriptions")
      .select("establishment_id, tier")
      .eq("status", "active");
    const seen = new Set<string>();
    let mrr = 0;
    (activeSubs ?? []).forEach((s: any) => {
      if (seen.has(s.establishment_id)) return;
      seen.add(s.establishment_id);
      mrr += priceMap.get(s.tier) ?? 0;
    });

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
    plan: z.enum(["all", "free", "starter", "pro", "enterprise"]).default("all"),
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
    plan: z.enum(["free", "starter", "pro", "enterprise"]),
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
    const { data: est } = await supabase.from("establishments").select("name, plan, slug").eq("id", data.establishment_id).maybeSingle();
    // Log BEFORE delete because cascade wipes audit rows tied to establishment
    await supabase.from("audit_logs").insert({
      establishment_id: null, user_id: userId,
      action: "admin_delete_establishment", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: { name: est?.name, slug: est?.slug, plan: est?.plan } as never,
    });
    const { error } = await supabase.from("establishments").delete().eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─────────────── Detail view ───────────────
export const adminGetEstablishmentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();

    const [
      { data: est },
      { count: customersTotal },
      { count: customersNew },
      { count: stampsTotal },
      { count: stamps30 },
      { count: rewards30 },
      { data: recentStamps },
      { data: campaigns },
      { data: members },
    ] = await Promise.all([
      supabase.from("establishments").select("id, name, slug, plan, active, phone, email, created_at, created_by").eq("id", data.establishment_id).maybeSingle(),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id),
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).gte("created_at", since),
      supabase.from("stamps").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).is("reverted_at", null),
      supabase.from("stamps").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).is("reverted_at", null).gte("created_at", since),
      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).not("redeemed_at", "is", null).gte("redeemed_at", since),
      supabase.from("stamps").select("created_at").eq("establishment_id", data.establishment_id).is("reverted_at", null).gte("created_at", since),
      supabase.from("campaigns").select("id, name, stamps_required, active").eq("establishment_id", data.establishment_id),
      supabase.from("establishment_members").select("user_id, role, active, display_name, invited_email, created_at").eq("establishment_id", data.establishment_id),
    ]);

    if (!est) throw new Error("Estabelecimento não encontrado");

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

    const memberIds = Array.from(new Set((members ?? []).map((m: any) => m.user_id)));
    const [{ data: events }, { data: audits }, { data: memberProfiles }] = await Promise.all([
      supabase.from("subscription_events").select("id, event_type, from_plan, to_plan, message, created_at, acknowledged_at").eq("establishment_id", data.establishment_id).order("created_at", { ascending: false }).limit(30),
      supabase.from("audit_logs").select("id, action, entity_type, entity_id, metadata, created_at, user_id").or(`establishment_id.eq.${data.establishment_id},entity_id.eq.${data.establishment_id}`).order("created_at", { ascending: false }).limit(30),
      memberIds.length > 0
        ? supabase.from("profiles").select("id, full_name, account_type").in("id", memberIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map<string, { full_name: string | null; account_type: string }>();
    (memberProfiles ?? []).forEach((p: any) => pmap.set(p.id, { full_name: p.full_name, account_type: p.account_type }));
    const membersEnriched = (members ?? []).map((m: any) => ({
      ...m,
      full_name: pmap.get(m.user_id)?.full_name ?? null,
      account_type: pmap.get(m.user_id)?.account_type ?? "customer",
    }));

    return {
      establishment: est,
      metrics: {
        customersTotal: customersTotal ?? 0,
        customersNew30: customersNew ?? 0,
        stampsTotal: stampsTotal ?? 0,
        stamps30: stamps30 ?? 0,
        rewards30: rewards30 ?? 0,
      },
      series,
      campaigns: campaigns ?? [],
      members: members ?? [],
      events: events ?? [],
      audits: audits ?? [],
    };
  });

// ─────────────── Alerts / events ───────────────
export const adminListSubscriptionEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ onlyUnack: z.boolean().default(false), limit: z.number().int().min(1).max(200).default(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    let q = supabase.from("subscription_events")
      .select("id, establishment_id, event_type, from_plan, to_plan, message, created_at, acknowledged_at, actor_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.onlyUnack) q = q.is("acknowledged_at", null);
    const { data: evs, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((evs ?? []).map(e => e.establishment_id)));
    const { data: ests } = ids.length
      ? await supabase.from("establishments").select("id, name, slug").in("id", ids)
      : { data: [] as any[] };
    const nameMap = new Map<string, { name: string; slug: string }>();
    (ests ?? []).forEach((e: any) => nameMap.set(e.id, { name: e.name, slug: e.slug }));
    return (evs ?? []).map(e => ({ ...e, establishment: nameMap.get(e.establishment_id) ?? null }));
  });

export const adminAckSubscriptionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { error } = await supabase.from("subscription_events")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: userId })
      .eq("id", data.event_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminReportPaymentFailure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    message: z.string().trim().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: est } = await supabase.from("establishments").select("plan").eq("id", data.establishment_id).maybeSingle();
    const { error } = await supabase.from("subscription_events").insert({
      establishment_id: data.establishment_id,
      event_type: "payment_failed",
      from_plan: est?.plan ?? null,
      to_plan: est?.plan ?? null,
      actor_id: userId,
      message: data.message ?? "Falha de pagamento reportada",
    });
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id, user_id: userId,
      action: "admin_report_payment_failure", entity_type: "establishment", entity_id: data.establishment_id,
      metadata: { message: data.message ?? null } as never,
    });
    return { ok: true };
  });

export const adminListAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(200).default(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { data: logs, error } = await supabase.from("audit_logs")
      .select("id, action, entity_type, entity_id, establishment_id, user_id, metadata, created_at")
      .like("action", "admin_%")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((logs ?? []).map(l => l.user_id).filter(Boolean))) as string[];
    const estIds = Array.from(new Set((logs ?? []).flatMap(l => [l.establishment_id, l.entity_id]).filter(Boolean))) as string[];
    const [{ data: profs }, { data: ests }] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as any[] }),
      estIds.length ? supabase.from("establishments").select("id, name, slug").in("id", estIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const pm = new Map<string, string>();
    (profs ?? []).forEach((p: any) => pm.set(p.id, p.full_name));
    const em = new Map<string, { name: string; slug: string }>();
    (ests ?? []).forEach((e: any) => em.set(e.id, { name: e.name, slug: e.slug }));
    return (logs ?? []).map(l => ({
      ...l,
      actor_name: l.user_id ? pm.get(l.user_id) ?? null : null,
      establishment: em.get(l.establishment_id ?? l.entity_id ?? "") ?? null,
    }));
  });


// ─────────────── Financial ───────────────
export const adminGetFinancial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400_000).toISOString();
    const last12start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const last12startIso = last12start.toISOString();

    const [
      { data: plans },
      { data: ests },
      { data: subs },
      { data: events12 },
      { data: paidPayments },
    ] = await Promise.all([
      supabase.from("plans").select("tier, name, price_monthly, price_yearly, currency"),
      supabase.from("establishments").select("id, name, slug, plan, active, created_at").is("archived_at", null),
      supabase.from("subscriptions").select("id, establishment_id, tier, status, provider, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, created_at"),
      supabase.from("subscription_events").select("id, establishment_id, event_type, from_plan, to_plan, created_at").gte("created_at", last12startIso).order("created_at", { ascending: false }),
      supabase.from("payments").select("amount, approved_at, plan_slug, establishment_id, status").in("status", ["approved", "paid"]).gte("approved_at", last12startIso),
    ]);

    const priceMap = new Map<string, number>((plans ?? []).map((p: any) => [p.tier, Number(p.price_monthly ?? 0)]));
    const planNames = new Map<string, string>((plans ?? []).map((p: any) => [p.tier, p.name]));
    const estMap = new Map<string, any>((ests ?? []).map((e: any) => [e.id, e]));

    // REAL MRR: only establishments with an active paid subscription
    const revenueByPlan: Record<string, { count: number; mrr: number; name: string }> = {};
    let mrr = 0;
    let activePaying = 0;
    const countedEst = new Set<string>();
    (subs ?? []).forEach((s: any) => {
      if (s.status !== "active") return;
      if (countedEst.has(s.establishment_id)) return;
      countedEst.add(s.establishment_id);
      const price = priceMap.get(s.tier) ?? 0;
      const key = s.tier;
      if (!revenueByPlan[key]) revenueByPlan[key] = { count: 0, mrr: 0, name: planNames.get(key) ?? key };
      revenueByPlan[key].count += 1;
      revenueByPlan[key].mrr += price;
      mrr += price;
      if (price > 0) activePaying += 1;
    });

    // Realized revenue series: last 12 months of approved payments
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const months: { month: string; mrrNew: number; churn: number; net: number; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: monthKey(d), mrrNew: 0, churn: 0, net: 0, revenue: 0 });
    }
    (paidPayments ?? []).forEach((p: any) => {
      if (!p.approved_at) return;
      const k = monthKey(new Date(p.approved_at));
      const row = months.find(m => m.month === k);
      if (row) row.revenue += Number(p.amount ?? 0);
    });
    (events12 ?? []).forEach((ev: any) => {
      const k = monthKey(new Date(ev.created_at));
      const row = months.find(m => m.month === k);
      if (!row) return;
      const toPrice = priceMap.get(ev.to_plan) ?? 0;
      const fromPrice = priceMap.get(ev.from_plan) ?? 0;
      if (ev.event_type === "upgrade" || ev.event_type === "reactivate") row.mrrNew += Math.max(0, toPrice - fromPrice);
      else if (ev.event_type === "downgrade") row.churn += Math.max(0, fromPrice - toPrice);
      else if (ev.event_type === "cancel") row.churn += fromPrice;
    });
    months.forEach(m => { m.net = m.mrrNew - m.churn; });

    // Upcoming renewals (next 30 days) from subscriptions
    const upcoming = (subs ?? [])
      .filter((s: any) => s.status === "active" && s.current_period_end && s.current_period_end <= in30 && s.current_period_end >= now.toISOString())
      .map((s: any) => {
        const est = estMap.get(s.establishment_id);
        return {
          id: s.id,
          establishment_id: s.establishment_id,
          establishment_name: est?.name ?? "—",
          establishment_slug: est?.slug ?? "",
          tier: s.tier,
          amount: priceMap.get(s.tier) ?? 0,
          current_period_end: s.current_period_end,
          cancel_at_period_end: !!s.cancel_at_period_end,
          provider: s.provider,
        };
      })
      .sort((a, b) => a.current_period_end.localeCompare(b.current_period_end));

    // Top revenue establishments: real, from active subscriptions
    const topRevenue = Array.from(countedEst).map(id => {
      const est = estMap.get(id);
      const sub = (subs ?? []).find((s: any) => s.establishment_id === id && s.status === "active");
      const tier = sub?.tier ?? est?.plan ?? "free";
      return { id, name: est?.name ?? "—", slug: est?.slug ?? "", plan: tier, mrr: priceMap.get(tier) ?? 0 };
    }).sort((a, b) => b.mrr - a.mrr).slice(0, 10);

    // Trial subscriptions ending soon
    const trials = (subs ?? [])
      .filter((s: any) => s.trial_ends_at && s.status !== "canceled")
      .map((s: any) => {
        const est = estMap.get(s.establishment_id);
        return {
          id: s.id,
          establishment_name: est?.name ?? "—",
          establishment_slug: est?.slug ?? "",
          tier: s.tier,
          trial_ends_at: s.trial_ends_at,
        };
      })
      .sort((a, b) => a.trial_ends_at.localeCompare(b.trial_ends_at))
      .slice(0, 10);

    const totalEst = ests?.length ?? 0;
    const activeEst = (ests ?? []).filter((e: any) => e.active).length;
    const arpu = activePaying > 0 ? mrr / activePaying : 0;

    // Churn rate 30d: real cancels / active subs at start of window
    const cutoff30 = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const cancels30 = (events12 ?? []).filter((e: any) => e.event_type === "cancel" && e.created_at >= cutoff30).length;
    const churnRate = activePaying > 0 ? (cancels30 / activePaying) * 100 : 0;

    // Realized revenue totals
    const revenue30 = (paidPayments ?? []).filter((p: any) => p.approved_at && p.approved_at >= cutoff30).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const revenue12m = (paidPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

    return {
      mrr, arr: mrr * 12, arpu, activePaying, totalEst, activeEst,
      revenueByPlan, months, upcoming, topRevenue, trials, churnRate, cancels30,
      revenue30, revenue12m,
    };
  });

// ============ Admin: Payments listing (pagination, search, sort) ============
export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    q: z.string().trim().max(120).optional(),
    status: z.string().max(40).optional(),
    provider: z.string().max(40).optional(),
    method: z.string().max(40).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    sort: z.enum(["created_at", "amount", "status", "approved_at"]).default("created_at"),
    dir: z.enum(["asc", "desc"]).default("desc"),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(25),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payments")
      .select("id, establishment_id, plan_slug, amount, currency, method, status, status_detail, provider, mp_payment_id, provider_payment_id, payer_email, payer_doc, card_last4, card_brand, installments, created_at, approved_at", { count: "exact" });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.provider && data.provider !== "all") q = q.eq("provider", data.provider);
    if (data.method && data.method !== "all") q = q.eq("method", data.method);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.q) {
      const term = data.q.replace(/[%,()]/g, " ").trim();
      q = q.or([
        `payer_email.ilike.%${term}%`,
        `payer_doc.ilike.%${term}%`,
        `mp_payment_id.ilike.%${term}%`,
        `provider_payment_id.ilike.%${term}%`,
        `plan_slug.ilike.%${term}%`,
      ].join(","));
    }
    q = q.order(data.sort, { ascending: data.dir === "asc", nullsFirst: false });
    const fromIdx = (data.page - 1) * data.page_size;
    const toIdx = fromIdx + data.page_size - 1;
    const { data: rows, count, error } = await q.range(fromIdx, toIdx);
    if (error) throw new Error(error.message);
    const estIds = Array.from(new Set((rows ?? []).map((r: any) => r.establishment_id).filter(Boolean)));
    let ests: Record<string, { id: string; name: string; slug: string }> = {};
    if (estIds.length) {
      const { data: er } = await supabaseAdmin.from("establishments").select("id, name, slug").in("id", estIds);
      (er ?? []).forEach((e: any) => { ests[e.id] = e; });
    }
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size, establishments: ests };
  });

export const adminGetPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin.from("payments").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Pagamento não encontrado");
    const { data: est } = pay.establishment_id
      ? await supabaseAdmin.from("establishments").select("id, name, slug, plan").eq("id", pay.establishment_id).maybeSingle()
      : { data: null };
    const { data: sub } = pay.subscription_id
      ? await supabaseAdmin.from("subscriptions").select("id, status, plan_slug, current_period_start, current_period_end").eq("id", pay.subscription_id).maybeSingle()
      : { data: null };
    const mpKey = pay.mp_payment_id ?? pay.provider_payment_id ?? null;
    const { data: logs } = mpKey
      ? await supabaseAdmin.from("payment_logs")
          .select("id, created_at, event_type, action, mp_id, response_status, signature_valid, processed, reason, error, mode, live_mode, provider")
          .eq("mp_id", String(mpKey)).order("created_at", { ascending: false }).limit(50)
      : { data: [] as any[] };
    return { payment: pay, establishment: est, subscription: sub, logs: logs ?? [] };
  });
