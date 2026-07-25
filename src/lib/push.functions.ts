import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { VAPID_PUBLIC_KEY as FRONTEND_VAPID_PUBLIC_KEY } from "@/lib/vapid";

const subInput = z.object({
  token: z.string().min(20).max(80), // customer access_token from voucher URL
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  user_agent: z.string().max(400).optional(),
  preferences: z
    .object({
      stamp: z.boolean().optional(),
      reward: z.boolean().optional(),
      campaign: z.boolean().optional(),
      birthday: z.boolean().optional(),
    })
    .optional(),
});

/** Customer opts-in from the voucher page. Uses their access_token as auth. */
export const subscribeCustomerPush = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .select("id, establishment_id, user_id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (error || !customer) throw new Error("Cartão não encontrado.");

    // Update-then-insert: the unique index on (customer_id, endpoint) is
    // partial (WHERE customer_id IS NOT NULL), so PostgREST's ON CONFLICT
    // arbiter cannot infer it and .upsert() would raise
    // "no unique or exclusion constraint matching the ON CONFLICT specification".
    const patch = {
      customer_id: customer.id,
      establishment_id: customer.establishment_id,
      user_id: customer.user_id ?? null,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth_key: data.auth,
      user_agent: data.user_agent ?? null,
      preferences: data.preferences ?? {
        stamp: true,
        reward: true,
        campaign: true,
        birthday: true,
      },
      active: true,
      last_error: null,
    };
    const { data: existing } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    if (existing) {
      const { error: upErr } = await supabaseAdmin
        .from("push_subscriptions")
        .update(patch)
        .eq("id", existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabaseAdmin
        .from("push_subscriptions")
        .insert(patch);
      if (insErr) throw insErr;
    }
    return { ok: true };
  });


export const unsubscribeCustomerPush = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(20).max(80), endpoint: z.string().url() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) return { ok: true };
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false })
      .eq("customer_id", customer.id)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const updateCustomerPushPrefs = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(20).max(80),
        endpoint: z.string().url(),
        preferences: z.object({
          stamp: z.boolean().optional(),
          reward: z.boolean().optional(),
          campaign: z.boolean().optional(),
          birthday: z.boolean().optional(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) throw new Error("Cartão não encontrado.");
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ preferences: data.preferences })
      .eq("customer_id", customer.id)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

/** Whether a given endpoint is already active for this customer. */
export const getCustomerPushStatus = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(20).max(80), endpoint: z.string().url() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) return { subscribed: false as const };
    const { data: row } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, active, preferences")
      .eq("customer_id", customer.id)
      .eq("endpoint", data.endpoint)
      .maybeSingle();
    return {
      subscribed: !!(row && row.active),
      preferences: (row?.preferences ?? null) as Record<string, boolean> | null,
    };
  });

/** Merchant history of pushes sent for its establishment. */
export const listPushLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("push_logs")
      .select("id, title, body, url, status, status_code, error, created_at, customer_id")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw error;
    return rows;
  });

/** Push quota + recipient preview for the merchant broadcast UI. */
export const getPushQuotaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: est } = await context.supabase
      .from("establishments")
      .select("plan")
      .eq("id", data.establishment_id)
      .maybeSingle();
    const tier = est?.plan ?? "free";

    // Feature flag + daily limit_value from plan_features (editable per plan).
    const { data: planRow } = await context.supabase
      .from("plans")
      .select("id")
      .eq("tier", tier)
      .maybeSingle();
    let allowed = false;
    let dailyLimit: number | null = 0;
    if (planRow) {
      const { data: pf } = await context.supabase
        .from("plan_features")
        .select("enabled, limit_value")
        .eq("plan_id", planRow.id)
        .eq("feature_key", "push_notifications")
        .maybeSingle();
      allowed = !!pf?.enabled;
      dailyLimit = pf?.limit_value ?? null; // null = unlimited
    }

    // Broadcasts sent today (each row in push_logs is one recipient; count unique broadcasts by tag/title/created_at bucket).
    // Simpler and safer: count distinct (title, minute-bucket) pairs in last 24h — but we treat each Enviar broadcast click as one.
    // We track broadcasts via a distinct group: minute bucket + title.
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: todayLogs } = await context.supabase
      .from("push_logs")
      .select("title, created_at")
      .eq("establishment_id", data.establishment_id)
      .gte("created_at", since.toISOString());
    const broadcastKeys = new Set<string>();
    for (const l of todayLogs ?? []) {
      const bucket = new Date(l.created_at).toISOString().slice(0, 16); // yyyy-mm-ddTHH:MM
      broadcastKeys.add(`${bucket}|${l.title}`);
    }
    const sentToday = broadcastKeys.size;

    // Recipient count: active subs that accept campaign (clientes + operadores).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveEstablishmentSubs, splitAudience } = await import("@/lib/push.audience.server");
    const allSubs = await resolveEstablishmentSubs(supabaseAdmin, data.establishment_id);
    const split = splitAudience(allSubs, null);
    const recipients = split.customers.length + split.operators.length;


    const remaining = dailyLimit == null ? null : Math.max(0, dailyLimit - sentToday);
    return {
      tier,
      allowed,
      daily_limit: dailyLimit,
      sent_today: sentToday,
      remaining,
      recipients,
    };
  });

const segmentSchema = z
  .object({
    tiers: z.array(z.enum(["bronze", "prata", "ouro", "diamante"])).optional(),
    activity: z.enum(["all", "active_30d", "inactive_30d", "inactive_60d"]).optional(),
    campaign_id: z.string().uuid().nullable().optional(),
    min_stamps: z.number().int().min(0).max(999).nullable().optional(),
    customer_ids: z.array(z.string().uuid()).max(5000).nullable().optional(),
  })
  .default({});


/** Preview: how many customers/subscribers match a given segment. */
export const previewPushSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        segment: segmentSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isManager } = await context.supabase.rpc("has_establishment_role", {
      _user: context.userId,
      _est: data.establishment_id,
      _min_role: "manager",
    });
    if (!isManager) throw new Error("Sem permissão.");
    const { resolveSegmentCustomerIds } = await import("@/lib/push.segment.server");
    const ids = await resolveSegmentCustomerIds(data.establishment_id, data.segment ?? {});
    if (ids.length === 0) return { customers: 0, subscribers: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, preferences")
      .eq("establishment_id", data.establishment_id)
      .eq("active", true)
      .in("customer_id", ids);
    const subscribers = (subs ?? []).filter(
      (s: any) => ((s.preferences ?? {}) as Record<string, boolean>).campaign !== false,
    ).length;
    return { customers: ids.length, subscribers };
  });

async function checkAndConsumeQuota(
  supabase: any,
  establishmentId: string,
  title: string,
): Promise<{ dailyLimit: number | null }> {
  const { data: est } = await supabase
    .from("establishments")
    .select("plan")
    .eq("id", establishmentId)
    .maybeSingle();
  const tier = est?.plan ?? "free";
  const { data: planRow } = await supabase
    .from("plans")
    .select("id")
    .eq("tier", tier)
    .maybeSingle();
  const { data: pf } = planRow
    ? await supabase
        .from("plan_features")
        .select("enabled, limit_value")
        .eq("plan_id", planRow.id)
        .eq("feature_key", "push_notifications")
        .maybeSingle()
    : { data: null as any };
  if (!pf?.enabled) {
    throw new Error(
      "Notificações push não estão disponíveis no seu plano atual. Faça upgrade em /app/planos.",
    );
  }
  const dailyLimit: number | null = pf.limit_value ?? null;
  if (dailyLimit != null) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { data: todayLogs } = await supabase
      .from("push_logs")
      .select("title, created_at")
      .eq("establishment_id", establishmentId)
      .gte("created_at", since.toISOString());
    const keys = new Set<string>();
    for (const l of todayLogs ?? []) {
      const bucket = new Date(l.created_at).toISOString().slice(0, 16);
      keys.add(`${bucket}|${l.title}`);
    }
    if (keys.size >= dailyLimit) {
      throw new Error(
        `Limite diário do plano atingido (${dailyLimit}/dia). Tente novamente amanhã ou faça upgrade em /app/planos.`,
      );
    }
  }
  return { dailyLimit };
}

/** Merchant broadcast: send to all matching subs (optionally filtered by segment). */
export const broadcastPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        title: z.string().min(2).max(80),
        body: z.string().max(200).optional(),
        url: z.string().url().optional(),
        segment: segmentSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isManager } = await context.supabase.rpc("has_establishment_role", {
      _user: context.userId,
      _est: data.establishment_id,
      _min_role: "manager",
    });
    if (!isManager) throw new Error("Sem permissão.");

    await checkAndConsumeQuota(context.supabase, data.establishment_id, data.title);

    const { resolveSegmentCustomerIds } = await import("@/lib/push.segment.server");
    const targetIds = await resolveSegmentCustomerIds(data.establishment_id, data.segment ?? {});

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let subsQuery = supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id, preferences")
      .eq("establishment_id", data.establishment_id)
      .eq("active", true);
    // If no segment filter was applied, targetIds is the full base; we still filter to avoid
    // sending to blocked customers. When empty base, skip.
    if (targetIds.length > 0) subsQuery = subsQuery.in("customer_id", targetIds);
    else if (data.segment && Object.keys(data.segment).length > 0) {
      return { sent: 0, failed: 0, total: 0 };
    }
    const { data: subs } = await subsQuery;

    const { sendPushToSub } = await import("@/lib/push.server");
    const { notificationTargetKey, recordPushDelivery } = await import("@/lib/push-inbox.server");
    let sent = 0;
    let failed = 0;
    const notifiedTargets = new Set<string>();
    for (const s of subs ?? []) {
      const prefs = (s.preferences ?? {}) as Record<string, boolean>;
      if (prefs.campaign === false) continue;
      const inAppTarget = notificationTargetKey(s);
      const r = await sendPushToSub(s, {
        title: data.title,
        body: data.body,
        url: data.url,
        tag: `broadcast-${data.establishment_id}`,
        type: "message",
      });
      await recordPushDelivery(supabaseAdmin, s, { title: data.title, body: data.body, url: data.url, kind: "push" }, r, {
        persistInApp: !notifiedTargets.has(inAppTarget),
        audience: s.customer_id ? "customer" : "operator",
      });
      notifiedTargets.add(inAppTarget);
      if (r.ok) sent++;
      else failed++;
    }
    return { sent, failed, total: subs?.length ?? 0 };
  });

// ============================================================
// SCHEDULED BROADCASTS
// ============================================================

/** Create a scheduled broadcast (dispatched by cron when due). */
export const scheduleBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        title: z.string().min(2).max(80),
        body: z.string().max(200).optional(),
        url: z.string().url().optional(),
        segment: segmentSchema.optional(),
        scheduled_at: z.string().datetime(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isManager } = await context.supabase.rpc("has_establishment_role", {
      _user: context.userId,
      _est: data.establishment_id,
      _min_role: "manager",
    });
    if (!isManager) throw new Error("Sem permissão.");
    // Feature gate (limit is checked at dispatch time as well).
    const { data: est } = await context.supabase
      .from("establishments")
      .select("plan")
      .eq("id", data.establishment_id)
      .maybeSingle();
    const tier = est?.plan ?? "free";
    const { data: planRow } = await context.supabase
      .from("plans")
      .select("id")
      .eq("tier", tier)
      .maybeSingle();
    const { data: pf } = planRow
      ? await context.supabase
          .from("plan_features")
          .select("enabled")
          .eq("plan_id", planRow.id)
          .eq("feature_key", "push_notifications")
          .maybeSingle()
      : { data: null as any };
    if (!pf?.enabled) {
      throw new Error("Notificações push não estão disponíveis no seu plano atual.");
    }
    if (new Date(data.scheduled_at).getTime() < Date.now() - 60_000) {
      throw new Error("Agende para um horário no futuro.");
    }
    const { data: row, error } = await context.supabase
      .from("scheduled_pushes")
      .insert({
        establishment_id: data.establishment_id,
        title: data.title,
        body: data.body ?? null,
        url: data.url ?? null,
        segment: data.segment ?? {},
        scheduled_at: data.scheduled_at,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });

export const listScheduledBroadcasts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("scheduled_pushes")
      .select("id, title, body, url, segment, scheduled_at, status, sent_at, result, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("scheduled_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return rows ?? [];
  });

export const cancelScheduledBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_pushes")
      .update({ status: "canceled" })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw error;
    return { ok: true };
  });

/**
 * Dispatch all pending scheduled broadcasts whose scheduled_at is <= now.
 * Called by pg_cron via a public route.
 */
export async function dispatchDueScheduledBroadcasts() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: due } = await supabaseAdmin
    .from("scheduled_pushes")
    .select("id, establishment_id, title, body, url, segment")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .limit(20);

  const { resolveSegmentCustomerIds } = await import("@/lib/push.segment.server");
  const { sendPushToSub } = await import("@/lib/push.server");

  let processed = 0;
  for (const row of due ?? []) {
    try {
      // Verify plan still allows push (skip limit for scheduled dispatches so users don't
      // get silently blocked — the scheduling UI enforces).
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("plan, active")
        .eq("id", row.establishment_id)
        .maybeSingle();
      if (!est?.active) {
        await supabaseAdmin
          .from("scheduled_pushes")
          .update({ status: "canceled", result: { reason: "establishment_inactive" } })
          .eq("id", row.id);
        continue;
      }
      const { data: planRow } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("tier", est.plan)
        .maybeSingle();
      const { data: pf } = planRow
        ? await supabaseAdmin
            .from("plan_features")
            .select("enabled")
            .eq("plan_id", planRow.id)
            .eq("feature_key", "push_notifications")
            .maybeSingle()
        : { data: null as any };
      if (!pf?.enabled) {
        await supabaseAdmin
          .from("scheduled_pushes")
          .update({ status: "failed", result: { reason: "feature_disabled" } })
          .eq("id", row.id);
        continue;
      }

      const ids = await resolveSegmentCustomerIds(
        row.establishment_id,
        (row.segment ?? {}) as any,
      );
      let sq = supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id, preferences")
        .eq("establishment_id", row.establishment_id)
        .eq("active", true);
      const seg = (row.segment ?? {}) as Record<string, unknown>;
      const hasFilter = Object.keys(seg).length > 0;
      if (ids.length > 0) sq = sq.in("customer_id", ids);
      else if (hasFilter) {
        await supabaseAdmin
          .from("scheduled_pushes")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            result: { sent: 0, failed: 0, total: 0 },
          })
          .eq("id", row.id);
        continue;
      }
      const { data: subs } = await sq;

      const { notificationTargetKey, recordPushDelivery } = await import("@/lib/push-inbox.server");
      let sent = 0;
      let failed = 0;
      const notifiedTargets = new Set<string>();
      for (const s of subs ?? []) {
        const prefs = (s.preferences ?? {}) as Record<string, boolean>;
        if (prefs.campaign === false) continue;
        const inAppTarget = notificationTargetKey(s);
        const r = await sendPushToSub(s as any, {
          title: row.title,
          body: row.body ?? undefined,
          url: row.url ?? undefined,
          tag: `broadcast-${row.establishment_id}`,
          type: "message",
        });
        await recordPushDelivery(
          supabaseAdmin,
          s,
          { title: row.title, body: row.body ?? null, url: row.url ?? null, kind: "push" },
          r,
          {
            persistInApp: !notifiedTargets.has(inAppTarget),
            audience: s.customer_id ? "customer" : "operator",
          },
        );
        notifiedTargets.add(inAppTarget);
        if (r.ok) sent++;
        else failed++;
      }
      await supabaseAdmin
        .from("scheduled_pushes")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          result: { sent, failed, total: subs?.length ?? 0 },
        })
        .eq("id", row.id);
      processed++;
    } catch (e) {
      await supabaseAdmin
        .from("scheduled_pushes")
        .update({
          status: "failed",
          result: { error: e instanceof Error ? e.message : String(e) },
        })
        .eq("id", row.id);
    }
  }
  return { processed, total: due?.length ?? 0 };
}



// ============================================================
// SUPER ADMIN
// ============================================================

async function assertSuperAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("is_super_admin", { _user: ctx.userId });
  if (!data) throw new Error("Acesso restrito ao super administrador.");
}

/** Global overview of push subscriptions and delivery stats. */
export const adminPushOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const [subsAll, subsActive, logs30, ests] = await Promise.all([
      supabaseAdmin
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .not("establishment_id", "is", null),
      supabaseAdmin
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .not("establishment_id", "is", null),
      supabaseAdmin
        .from("push_logs")
        .select("id, status, establishment_id, created_at")
        .gte("created_at", since),
      supabaseAdmin.from("establishments").select("id, name").eq("active", true).order("name"),
    ]);

    const byEst = new Map<string, { est_id: string; sent: number; failed: number; expired: number }>();
    for (const l of logs30.data ?? []) {
      const k = l.establishment_id ?? "unknown";
      const cur = byEst.get(k) ?? { est_id: k, sent: 0, failed: 0, expired: 0 };
      if (l.status === "sent") cur.sent++;
      else if (l.status === "expired") cur.expired++;
      else cur.failed++;
      byEst.set(k, cur);
    }

    // active subs per establishment (clientes + lojistas)
    const { data: perEst } = await supabaseAdmin
      .from("push_subscriptions")
      .select("establishment_id")
      .eq("active", true)
      .not("establishment_id", "is", null);
    const subsPerEst = new Map<string, number>();
    for (const r of perEst ?? []) {
      const k = r.establishment_id ?? "unknown";
      subsPerEst.set(k, (subsPerEst.get(k) ?? 0) + 1);
    }

    const estMap = new Map((ests.data ?? []).map((e) => [e.id, e.name] as const));
    const breakdown = Array.from(new Set([...byEst.keys(), ...subsPerEst.keys()]))
      .map((id) => ({
        establishment_id: id,
        establishment_name: estMap.get(id) ?? "—",
        active_subs: subsPerEst.get(id) ?? 0,
        sent: byEst.get(id)?.sent ?? 0,
        failed: byEst.get(id)?.failed ?? 0,
        expired: byEst.get(id)?.expired ?? 0,
      }))
      .sort((a, b) => b.active_subs - a.active_subs);

    const totals = {
      total_subs: subsAll.count ?? 0,
      active_subs: subsActive.count ?? 0,
      sent_30d: (logs30.data ?? []).filter((l) => l.status === "sent").length,
      failed_30d: (logs30.data ?? []).filter((l) => l.status !== "sent").length,
    };

    return { totals, breakdown, establishments: ests.data ?? [] };
  });

/** Recent push logs across the platform, optionally scoped. */
export const adminListPushLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("push_logs")
      .select(
        "id, title, body, url, status, status_code, error, created_at, establishment_id, customer_id",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 150);
    if (data.establishment_id) q = q.eq("establishment_id", data.establishment_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    // enrich with establishment names
    const ids = Array.from(new Set((rows ?? []).map((r) => r.establishment_id).filter(Boolean))) as string[];
    let names = new Map<string, string>();
    if (ids.length) {
      const { data: est } = await supabaseAdmin.from("establishments").select("id, name").in("id", ids);
      names = new Map((est ?? []).map((e) => [e.id, e.name] as const));
    }
    return (rows ?? []).map((r) => ({
      ...r,
      establishment_name: r.establishment_id ? names.get(r.establishment_id) ?? "—" : "—",
    }));
  });

/** Super admin broadcast: to all customers, or to a chosen set of establishments. */
export const adminBroadcastPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().min(2).max(80),
        body: z.string().max(200).optional(),
        url: z.string().url().optional(),
        establishment_ids: z.array(z.string().uuid()).optional(), // empty/undefined = all
        respect_prefs: z.boolean().optional(), // default true
        audience: z.enum(["customers", "operators", "both"]).optional(), // default "customers"
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const audience = data.audience ?? "customers";
    let q = supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id, preferences")
      .eq("active", true)
      .not("establishment_id", "is", null);
    if (data.establishment_ids && data.establishment_ids.length > 0) {
      q = q.in("establishment_id", data.establishment_ids);
    }
    if (audience === "customers") {
      q = q.not("customer_id", "is", null);
    } else if (audience === "operators") {
      q = q.is("customer_id", null);
    }
    const { data: subs } = await q;


    const { sendPushToSub } = await import("@/lib/push.server");
    const { notificationTargetKey, recordPushDelivery } = await import("@/lib/push-inbox.server");
    const respect = data.respect_prefs !== false;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const notifiedTargets = new Set<string>();
    for (const s of subs ?? []) {
      const prefs = (s.preferences ?? {}) as Record<string, boolean>;
      if (respect && prefs.campaign === false) {
        skipped++;
        continue;
      }
      const inAppTarget = notificationTargetKey(s);
      const r = await sendPushToSub(s, {
        title: data.title,
        body: data.body,
        url: data.url,
        tag: "admin-broadcast",
        type: "message",
      });
      await recordPushDelivery(supabaseAdmin, s, { title: data.title, body: data.body, url: data.url, kind: "push" }, r, {
        persistInApp: !notifiedTargets.has(inAppTarget),
        audience: s.customer_id ? "customer" : "admin",
      });
      notifiedTargets.add(inAppTarget);
      if (r.ok) sent++;
      else failed++;
    }
    return { sent, failed, skipped, total: subs?.length ?? 0 };
  });

// ============================================================
// WALLET-LEVEL OPT-IN (authenticated customer)
// ============================================================

const walletSubInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  user_agent: z.string().max(400).optional(),
});

const walletTestPushInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10).optional(),
  auth: z.string().min(4).optional(),
  user_agent: z.string().max(400).optional(),
});

/**
 * Wallet-level push opt-in. Subscribes the current device for every card
 * the authenticated user owns, so a single "Ativar notificações" action on
 * the wallet home covers all establishments at once.
 */
export const subscribePushForAllMyCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => walletSubInput.parse(d))
  .handler(async ({ data, context }) => {
    // Use admin client so a stale/lagged RLS view of `customers` doesn't
    // silently return 0 rows and make the button appear to succeed with
    // "ativa em 0 cartões". Filtering by user_id keeps it scoped to the caller.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customers, error } = await supabaseAdmin
      .from("customers")
      .select("id, establishment_id")
      .eq("user_id", context.userId);
    if (error) throw error;
    const list = customers ?? [];

    // One physical browser push endpoint can remain registered while the user
    // logs out/in or reinstalls the PWA. Before persisting the current owner,
    // retire stale rows for this same endpoint so status/test lookups cannot
    // point to an old account and say "not subscribed" after activation.
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false, last_error: "superseded_by_current_wallet_user" })
      .eq("endpoint", data.endpoint)
      .neq("user_id", context.userId);

    const basePatch = {
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth_key: data.auth,
      user_agent: data.user_agent ?? null,
      preferences: { stamp: true, reward: true, campaign: true, birthday: true },
      active: true,
      last_error: null,
    };

    type PushRow = {
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth_key: string;
      user_agent: string | null;
      preferences: Record<string, boolean>;
      active: boolean;
      last_error: string | null;
      customer_id: string | null;
      establishment_id: string | null;
    };

    async function upsertRow(row: PushRow, matcher: Record<string, string | null>) {
      let q = supabaseAdmin.from("push_subscriptions").select("id").eq("endpoint", data.endpoint);
      for (const [k, v] of Object.entries(matcher)) {
        q = v === null ? q.is(k, null) : q.eq(k, v);
      }
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        const { error: upErr } = await supabaseAdmin
          .from("push_subscriptions")
          .update(row)
          .eq("id", existing.id);
        if (upErr) throw upErr;
      } else {
        const { error: insErr } = await supabaseAdmin.from("push_subscriptions").insert(row);
        if (insErr) throw insErr;
      }
    }


    // Always register a device-level row (customer_id NULL) so the endpoint is
    // never lost even when the user has no customer cards yet, or when we hit
    // a RLS edge case on `customers`.
    await upsertRow({ ...basePatch, customer_id: null, establishment_id: null }, {
      user_id: context.userId,
      customer_id: null,
    });

    // Additionally register a per-card row for every loyalty card the user owns,
    // so establishment-scoped broadcasts hit this device.
    for (const c of list) {
      await upsertRow(
        { ...basePatch, customer_id: c.id, establishment_id: c.establishment_id },
        { customer_id: c.id },
      );
    }

    const { data: activeRows } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, customer_id")
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId)
      .eq("active", true);
    const persistedRows = activeRows ?? [];
    await supabaseAdmin.from("push_events").insert({
      user_id: context.userId,
      event_type: "wallet_subscription_persist_success",
      status: "active",
      metadata: {
        card_count: list.length,
        persisted_rows: persistedRows.length,
        device_row: persistedRows.some((r) => r.customer_id === null),
      },
    });
    return {
      ok: persistedRows.length > 0,
      count: list.length,
      persistedRows: persistedRows.length,
      deviceActive: persistedRows.some((r) => r.customer_id === null),
      cardRows: persistedRows.filter((r) => r.customer_id !== null).length,
    };
  });


/** Deactivates the current device's push subscription across all user's cards. */
export const unsubscribePushForAllMyCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false })
      .eq("endpoint", data.endpoint)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** Whether the current device endpoint is active for the signed-in user. */
export const getMyWalletPushStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (customers ?? []).map((c) => c.id);
    const { data: rows } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, customer_id, active, updated_at")
      .eq("endpoint", data.endpoint)
      .eq("active", true)
      .eq("user_id", context.userId);
    const list = rows ?? [];
    const cardRows = list.filter((r) => r.customer_id !== null);
    return {
      subscribed: list.length > 0,
      cardCount: cardRows.length,
      totalCards: ids.length,
      deviceActive: list.some((r) => r.customer_id === null),
      serverRows: list.length,
      lastSyncedAt: list
        .map((r) => r.updated_at)
        .filter((v): v is string => typeof v === "string")
        .sort()
        .at(-1) ?? null,
    };
  });


/**
 * Sends a real Web Push to the current device's endpoint for the authenticated
 * customer. Smoke-test button on /carteira/perfil. Fails fast if the endpoint
 * doesn't belong to any of the user's cards (prevents cross-user probing).
 */
export const sendTestPushToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => walletTestPushInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("id, establishment_id")
      .eq("user_id", context.userId);
    const ownedCustomers = customers ?? [];
    const ids = ownedCustomers.map((c) => c.id);

    // Look up this device's subscription. Match either a subscription owned
    // directly by the logged-in user (merchant/admin devices) OR one tied to
    // one of the user's customer cards.
    let query = supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id")
      .eq("endpoint", data.endpoint)
      .eq("active", true)
      .limit(10);
    if (ids.length > 0) {
      query = query.or(`user_id.eq.${context.userId},customer_id.in.(${ids.join(",")})`);
    } else {
      query = query.eq("user_id", context.userId);
    }
    let { data: subs } = await query;
    let sub = (subs ?? []).sort((a, b) => {
      if (a.customer_id && !b.customer_id) return -1;
      if (!a.customer_id && b.customer_id) return 1;
      return 0;
    })[0];

    // Self-healing path: if the browser has a native PushSubscription but the
    // database row is missing/stale, the test button repairs the subscription
    // before sending instead of dead-ending with "ative primeiro".
    if (!sub && data.p256dh && data.auth) {
      const basePatch = {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth_key: data.auth,
        user_agent: data.user_agent ?? null,
        preferences: { stamp: true, reward: true, campaign: true, birthday: true },
        active: true,
        last_error: null,
      };

      type RepairRow = typeof basePatch & {
        customer_id: string | null;
        establishment_id: string | null;
      };

      async function repairRow(row: RepairRow, matcher: Record<string, string | null>) {
        let existingQuery = supabaseAdmin
          .from("push_subscriptions")
          .select("id")
          .eq("endpoint", data.endpoint);
        for (const [key, value] of Object.entries(matcher)) {
          existingQuery = value === null ? existingQuery.is(key, null) : existingQuery.eq(key, value);
        }
        const { data: existing } = await existingQuery.maybeSingle();
        if (existing) {
          const { error: updateError } = await supabaseAdmin
            .from("push_subscriptions")
            .update(row)
            .eq("id", existing.id);
          if (updateError) throw updateError;
          return existing.id;
        }
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("push_subscriptions")
          .insert(row)
          .select("id")
          .single();
        if (insertError) throw insertError;
        return inserted.id;
      }

      await supabaseAdmin
        .from("push_subscriptions")
        .update({ active: false, last_error: "repaired_by_wallet_test" })
        .eq("endpoint", data.endpoint)
        .neq("user_id", context.userId);

      await repairRow(
        { ...basePatch, customer_id: null, establishment_id: null },
        { user_id: context.userId, customer_id: null },
      );
      for (const customer of ownedCustomers) {
        await repairRow(
          { ...basePatch, customer_id: customer.id, establishment_id: customer.establishment_id },
          { customer_id: customer.id },
        );
      }

      await supabaseAdmin.from("push_events").insert({
        user_id: context.userId,
        event_type: "wallet_subscription_repaired_before_test",
        status: "active",
        metadata: { card_count: ownedCustomers.length },
      });

      let repairedQuery = supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id")
        .eq("endpoint", data.endpoint)
        .eq("active", true)
        .limit(10);
      if (ids.length > 0) {
        repairedQuery = repairedQuery.or(`user_id.eq.${context.userId},customer_id.in.(${ids.join(",")})`);
      } else {
        repairedQuery = repairedQuery.eq("user_id", context.userId);
      }
      const repaired = await repairedQuery;
      subs = repaired.data ?? [];
      sub = subs.sort((a, b) => {
        if (a.customer_id && !b.customer_id) return -1;
        if (!a.customer_id && b.customer_id) return 1;
        return 0;
      })[0];
    }

    if (!sub) throw new Error("Este aparelho não está inscrito. Ative as notificações primeiro.");

    const { sendPushToSub } = await import("./push.server");
    const { recordPushDelivery } = await import("./push-inbox.server");
    const r = await sendPushToSub(sub, {
      title: "Fidelize — teste de push",
      body: "Se você recebeu esta notificação, está tudo funcionando! 🎉",
      url: "/carteira/perfil",
      tag: "fidelize-test",
    });
    await recordPushDelivery(
      supabaseAdmin,
      sub,
      {
        title: "Fidelize — teste de push",
        body: "Smoke test manual do usuário",
        url: "/carteira/perfil",
        kind: "aviso",
      },
      r,
      { persistInApp: true, audience: "customer" },
    );
    if (!r.ok) {
      throw new Error(
        r.error
          ? `Falha no envio (${r.status ?? "?"}): ${r.error}`
          : `Falha no envio (HTTP ${r.status ?? "?"}).`,
      );
    }
    return { ok: true, status: r.status };
  });

// ============================================================
// ADMIN / MERCHANT SELF-SUBSCRIBE (technical, no customer_id)
// Used to run push diagnostics from the admin panel on any device.
// ============================================================

const adminSubInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10),
  auth: z.string().min(4),
  user_agent: z.string().max(400).optional(),
  device_type: z.string().max(40).optional(),
  operating_system: z.string().max(60).optional(),
  browser: z.string().max(60).optional(),
  permission_status: z.string().max(20).optional(),
});

const adminTestPushInput = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(10).optional(),
  auth: z.string().min(4).optional(),
  user_agent: z.string().max(400).optional(),
  device_type: z.string().max(40).optional(),
  operating_system: z.string().max(60).optional(),
  browser: z.string().max(60).optional(),
  permission_status: z.string().max(20).optional(),
});

/** Subscribe the currently authenticated user (admin/merchant) — no customer link. */
export const subscribeAdminPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminSubInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Derive establishment_id from the user's active membership so merchant devices
    // show up under "Empresas com push ativo".
    const { data: membership } = await supabaseAdmin
      .from("establishment_members")
      .select("establishment_id")
      .eq("user_id", context.userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const establishmentId = membership?.establishment_id ?? null;

    // Look up existing row on (user_id, endpoint) to preserve id/created_at.
    const { data: existing } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .is("customer_id", null)
      .maybeSingle();

    await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false, last_error: "superseded_by_current_admin_user" })
      .eq("endpoint", data.endpoint)
      .neq("user_id", context.userId);

    const payload: any = {
      user_id: context.userId,
      customer_id: null,
      establishment_id: establishmentId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth_key: data.auth,
      user_agent: data.user_agent ?? null,
      device_type: data.device_type ?? null,
      operating_system: data.operating_system ?? null,
      browser: data.browser ?? null,
      permission_status: data.permission_status ?? "granted",
      preferences: { stamp: true, reward: true, campaign: true, birthday: true },
      active: true,
      last_error: null,
      last_seen_at: new Date().toISOString(),
    };
    if (existing) {
      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      await supabaseAdmin.from("push_events").insert({
        user_id: context.userId,
        subscription_id: existing.id,
        event_type: "subscription_persist_success",
        status: "updated",
        browser: data.browser ?? null,
        operating_system: data.operating_system ?? null,
      });
      return { ok: true, id: existing.id, created: false };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("push_subscriptions")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    await supabaseAdmin.from("push_events").insert({
      user_id: context.userId,
      subscription_id: inserted.id,
      event_type: "subscription_persist_success",
      status: "created",
      browser: data.browser ?? null,
      operating_system: data.operating_system ?? null,
    });
    return { ok: true, id: inserted.id, created: true };
  });

export const getAdminPushStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, active, browser, operating_system, device_type, permission_status, last_seen_at, created_at")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .is("customer_id", null)
      .maybeSingle();
    return {
      subscribed: !!(row && row.active),
      row: row ?? null,
    };
  });

export const sendAdminTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminTestPushInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: membership } = await supabaseAdmin
      .from("establishment_members")
      .select("establishment_id")
      .eq("user_id", context.userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    const establishmentId = membership?.establishment_id ?? null;

    let { data: sub } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .eq("active", true)
      .is("customer_id", null)
      .maybeSingle();

    // Same self-healing guarantee as the wallet test: if the browser still has
    // a PushSubscription but the DB row was never saved (or belonged to a stale
    // session), repair it and continue with the actual test send.
    if (!sub && data.p256dh && data.auth) {
      const payload = {
        user_id: context.userId,
        customer_id: null,
        establishment_id: establishmentId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth_key: data.auth,
        user_agent: data.user_agent ?? null,
        device_type: data.device_type ?? null,
        operating_system: data.operating_system ?? null,
        browser: data.browser ?? null,
        permission_status: data.permission_status ?? "granted",
        preferences: { stamp: true, reward: true, campaign: true, birthday: true },
        active: true,
        last_error: null,
        last_seen_at: new Date().toISOString(),
      };
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ active: false, last_error: "repaired_by_admin_test" })
        .eq("endpoint", data.endpoint)
        .neq("user_id", context.userId);

      const { data: existing } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", context.userId)
        .eq("endpoint", data.endpoint)
        .is("customer_id", null)
        .maybeSingle();
      if (existing) {
        const { error } = await supabaseAdmin
          .from("push_subscriptions")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("push_subscriptions").insert(payload);
        if (error) throw error;
      }
      await supabaseAdmin.from("push_events").insert({
        user_id: context.userId,
        event_type: "admin_subscription_repaired_before_test",
        status: "active",
      });
      const repaired = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id")
        .eq("user_id", context.userId)
        .eq("endpoint", data.endpoint)
        .eq("active", true)
        .is("customer_id", null)
        .maybeSingle();
      sub = repaired.data ?? null;
    }
    if (!sub) throw new Error("Este aparelho não está inscrito. Ative primeiro.");

    await supabaseAdmin.from("push_events").insert({
      user_id: context.userId,
      subscription_id: sub.id,
      event_type: "push_send_started",
      status: "pending",
    });
    const { sendPushToSub } = await import("./push.server");
    const { recordPushDelivery } = await import("./push-inbox.server");
    const r = await sendPushToSub(sub as any, {
      title: "Notificações ativadas",
      body: "Seu dispositivo está pronto para receber novidades.",
      url: "/admin/notificacoes",
      tag: "admin-test-push",
    });
    await supabaseAdmin.from("push_events").insert({
      user_id: context.userId,
      subscription_id: sub.id,
      event_type: r.ok ? "push_send_success" : "push_send_failed",
      status: r.ok ? "sent" : "failed",
      error_code: r.status != null ? String(r.status) : null,
      error_message: r.error ?? null,
    });
    await recordPushDelivery(
      supabaseAdmin,
      sub,
      {
        title: "Notificações ativadas",
        body: "Seu dispositivo está pronto para receber novidades.",
        url: "/admin/notificacoes",
        kind: "aviso",
      },
      r,
      { persistInApp: true, audience: "admin" },
    );
    if (!r.ok) {
      // Only mark inactive on 404/410 — sendPushToSub already does that.
      throw new Error(
        `Falha no envio (HTTP ${r.status ?? "?"})${r.error ? `: ${r.error}` : ""}`,
      );
    }
    return { ok: true, status: r.status };
  });

/**
 * Preview seguro para o teste isolado: valida a empresa (por ID ou nome exato,
 * case-insensitive), confere que o admin autenticado é membro dela e devolve a
 * subscription ativa mais recente do LOJISTA (customer_id IS NULL) sem qualquer
 * envio. Nunca inclui subscriptions de clientes finais.
 */
export const previewEstablishmentTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishmentId: z.string().uuid().optional(),
        establishmentName: z.string().min(1).max(120).optional(),
      })
      .refine((v) => v.establishmentId || v.establishmentName, {
        message: "Informe establishmentId ou establishmentName.",
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Localizar a empresa
    let est: { id: string; name: string } | null = null;
    if (data.establishmentId) {
      const { data: row } = await supabaseAdmin
        .from("establishments")
        .select("id, name")
        .eq("id", data.establishmentId)
        .maybeSingle();
      est = row ?? null;
    } else {
      const { data: rows } = await supabaseAdmin
        .from("establishments")
        .select("id, name")
        .ilike("name", data.establishmentName!);
      if (!rows || rows.length === 0) throw new Error("Empresa não encontrada.");
      if (rows.length > 1)
        throw new Error(
          `Existem ${rows.length} empresas com o nome "${data.establishmentName}". Use o ID.`,
        );
      est = rows[0];
    }
    if (!est) throw new Error("Empresa não encontrada.");

    // 2. Autorização: super_admin OU membro da empresa (owner/manager/staff)
    const { data: superAdmin } = await context.supabase.rpc("is_super_admin", {
      _user: context.userId,
    });
    if (!superAdmin) {
      const { data: hasAccess } = await context.supabase.rpc("has_establishment_access", {
        _user: context.userId,
        _est: est.id,
      });
      if (!hasAccess) throw new Error("Você não tem acesso a esta empresa.");
    }

    // 3. Selecionar subscription ativa do lojista
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select(
        "id, user_id, browser, operating_system, device_type, permission_status, created_at, endpoint",
      )
      .eq("establishment_id", est.id)
      .eq("active", true)
      .eq("permission_status", "granted")
      .not("user_id", "is", null)
      .is("customer_id", null)
      .not("endpoint", "is", null)
      .order("created_at", { ascending: false });

    const list = subs ?? [];
    return {
      establishment: est,
      totalMatching: list.length,
      selected: list[0]
        ? {
            id: list[0].id,
            user_id: list[0].user_id,
            browser: list[0].browser,
            operating_system: list[0].operating_system,
            device_type: list[0].device_type,
            created_at: list[0].created_at,
            endpoint_prefix: (list[0].endpoint ?? "").slice(0, 40) + "…",
          }
        : null,
      others: list.slice(1).map((s) => ({
        id: s.id,
        browser: s.browser,
        operating_system: s.operating_system,
        created_at: s.created_at,
      })),
    };
  });

/**
 * Teste isolado — envia UMA notificação para UMA subscription de lojista
 * pertencente à empresa informada. Validações redundantes garantem que o
 * frontend não possa direcionar para outra organização.
 */
export const sendEstablishmentTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishmentId: z.string().uuid(),
        subscriptionId: z.string().uuid(),
        title: z.string().min(1).max(120).optional(),
        body: z.string().min(1).max(500).optional(),
        url: z.string().min(1).max(300).optional(),
        clientNotificationId: z.string().min(1).max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Confirmar empresa
    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("id, name")
      .eq("id", data.establishmentId)
      .maybeSingle();
    if (!est) throw new Error("Empresa inválida.");

    // 2. Autorização
    const { data: superAdmin } = await context.supabase.rpc("is_super_admin", {
      _user: context.userId,
    });
    if (!superAdmin) {
      const { data: hasAccess } = await context.supabase.rpc("has_establishment_access", {
        _user: context.userId,
        _est: est.id,
      });
      if (!hasAccess) throw new Error("Você não tem acesso a esta empresa.");
    }

    // 3. Confirmar que a subscription pertence à MESMA empresa e é de lojista
    const { data: sub } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id, active, permission_status")
      .eq("id", data.subscriptionId)
      .maybeSingle();
    if (!sub) throw new Error("Subscription não encontrada.");
    if (sub.establishment_id !== est.id)
      throw new Error("A subscription não pertence a esta empresa.");
    if (sub.customer_id !== null) throw new Error("Recusado: subscription é de cliente final.");
    if (!sub.active) throw new Error("Subscription inativa.");
    if (sub.permission_status !== "granted")
      throw new Error("Permissão do dispositivo não é 'granted'.");

    // 4. Idempotência — evita duplo clique
    const notificationId = data.clientNotificationId
      ? data.clientNotificationId.slice(0, 80)
      : `nextstage-test-${Date.now()}`;
    const { data: existing } = await supabaseAdmin
      .from("push_logs")
      .select("id, status, status_code, created_at")
      .eq("subscription_id", sub.id)
      .eq("title", data.title ?? `Teste de notificação — ${est.name}`)
      .gte("created_at", new Date(Date.now() - 5000).toISOString())
      .maybeSingle();
    if (existing) {
      return {
        deduplicated: true,
        notification_id: notificationId,
        establishment: { id: est.id, name: est.name },
        subscription_id: sub.id,
        status: existing.status,
        status_code: existing.status_code,
      };
    }

    // 5. Enviar (usa retry/backoff + desativação em 404/410 já existentes)
    const title = data.title ?? `Teste de notificação — ${est.name}`;
    const body = data.body ?? `Esta é uma notificação de teste. O sistema de notificações da ${est.name} está funcionando.`;
    const url = data.url ?? "/admin/notificacoes";

    const { sendPushToSub } = await import("./push.server");
    const r = await sendPushToSub(sub as never, {
      title,
      body,
      url,
      tag: `est-test-${est.id.slice(0, 8)}`,
      type: "admin_test",
      requireInteraction: false,
    });

    // 6. Registrar em push_logs — status semântico correto
    const status = r.ok
      ? "provider_accepted"
      : r.status === 404 || r.status === 410
        ? "subscription_expired"
        : "failed";
    await supabaseAdmin.from("push_logs").insert({
      establishment_id: est.id,
      subscription_id: sub.id,
      customer_id: null,
      title,
      body,
      url,
      status,
      status_code: r.status ?? null,
      error: r.error ?? null,
    });

    return {
      deduplicated: false,
      notification_id: notificationId,
      establishment: { id: est.id, name: est.name },
      subscription_id: sub.id,
      user_id: sub.user_id,
      status,
      status_code: r.status ?? null,
      provider_response: r.ok ? "accepted" : r.error ?? null,
      recipients_selected: 1,
      recipients_sent: r.ok ? 1 : 0,
      customers_affected: 0,
      other_establishments_affected: 0,
      note: "Provider aceitou o envio. A exibição visual ainda depende do navegador e do sistema operacional.",
    };
  });




export const logAdminPushEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        event_type: z.string().min(3).max(60),
        status: z.string().max(30).optional(),
        hostname: z.string().max(120).optional(),
        browser: z.string().max(60).optional(),
        operating_system: z.string().max(60).optional(),
        error_code: z.string().max(30).optional(),
        error_message: z.string().max(500).optional(),
        metadata: z.record(z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_events").insert({
      user_id: context.userId,
      event_type: data.event_type,
      status: data.status ?? null,
      hostname: data.hostname ?? null,
      browser: data.browser ?? null,
      operating_system: data.operating_system ?? null,
      error_code: data.error_code ?? null,
      error_message: data.error_message ?? null,
      metadata: data.metadata ?? {},
    });
    return { ok: true };
  });

export const listMyPushEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("push_events")
      .select("id, event_type, status, browser, operating_system, error_code, error_message, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const vapidHealthCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    const pubOk = !!pub && /^[A-Za-z0-9_-]{80,120}$/.test(pub);
    const privOk = !!priv && /^[A-Za-z0-9_-]{40,60}$/.test(priv);
    return {
      public_key_present: !!pub,
      public_key_format_ok: pubOk,
      public_key_matches_frontend: !!pub && pub === FRONTEND_VAPID_PUBLIC_KEY,
      private_key_present: !!priv,
      private_key_format_ok: privOk,
      subject_present: !!subject,
      subject,
      // Never return the raw private key. Public key is safe.
      public_key_preview: pub ? `${pub.slice(0, 12)}…${pub.slice(-6)}` : null,
      frontend_public_key_preview: `${FRONTEND_VAPID_PUBLIC_KEY.slice(0, 12)}…${FRONTEND_VAPID_PUBLIC_KEY.slice(-6)}`,
    };
  });

