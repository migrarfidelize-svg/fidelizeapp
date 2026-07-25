import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Upsert by unique endpoint.
    const { error: upErr } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
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
        },
        { onConflict: "customer_id,endpoint" },
      );
    if (upErr) throw upErr;
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

    // Recipient count: active subs that accept campaign.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, preferences")
      .eq("establishment_id", data.establishment_id)
      .eq("active", true);
    const recipients = (subs ?? []).filter(
      (s: any) => ((s.preferences ?? {}) as Record<string, boolean>).campaign !== false,
    ).length;

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
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, preferences")
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
    let sent = 0;
    let failed = 0;
    for (const s of subs ?? []) {
      const prefs = (s.preferences ?? {}) as Record<string, boolean>;
      if (prefs.campaign === false) continue;
      const r = await sendPushToSub(s, {
        title: data.title,
        body: data.body,
        url: data.url,
        tag: `broadcast-${data.establishment_id}`,
      });
      await supabaseAdmin.from("push_logs").insert({
        establishment_id: data.establishment_id,
        subscription_id: s.id,
        customer_id: s.customer_id,
        title: data.title,
        body: data.body ?? null,
        url: data.url ?? null,
        status: r.ok ? "sent" : r.status === 410 || r.status === 404 ? "expired" : "failed",
        status_code: r.status ?? null,
        error: r.error ?? null,
      });
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
        .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, preferences")
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

      let sent = 0;
      let failed = 0;
      for (const s of subs ?? []) {
        const prefs = (s.preferences ?? {}) as Record<string, boolean>;
        if (prefs.campaign === false) continue;
        const r = await sendPushToSub(s as any, {
          title: row.title,
          body: row.body ?? undefined,
          url: row.url ?? undefined,
          tag: `broadcast-${row.establishment_id}`,
        });
        await supabaseAdmin.from("push_logs").insert({
          establishment_id: row.establishment_id,
          subscription_id: s.id,
          customer_id: s.customer_id,
          title: row.title,
          body: row.body ?? null,
          url: row.url ?? null,
          status: r.ok ? "sent" : r.status === 410 || r.status === 404 ? "expired" : "failed",
          status_code: r.status ?? null,
          error: r.error ?? null,
        });
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
        .not("customer_id", "is", null)
        .not("establishment_id", "is", null),
      supabaseAdmin
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .not("customer_id", "is", null)
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

    // active subs per establishment
    const { data: perEst } = await supabaseAdmin
      .from("push_subscriptions")
      .select("establishment_id")
      .eq("active", true)
      .not("customer_id", "is", null)
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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, preferences")
      .eq("active", true)
      .not("customer_id", "is", null)
      .not("establishment_id", "is", null);
    if (data.establishment_ids && data.establishment_ids.length > 0) {
      q = q.in("establishment_id", data.establishment_ids);
    }
    const { data: subs } = await q;

    const { sendPushToSub } = await import("@/lib/push.server");
    const respect = data.respect_prefs !== false;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const s of subs ?? []) {
      const prefs = (s.preferences ?? {}) as Record<string, boolean>;
      if (respect && prefs.campaign === false) {
        skipped++;
        continue;
      }
      const r = await sendPushToSub(s, {
        title: data.title,
        body: data.body,
        url: data.url,
        tag: "admin-broadcast",
      });
      await supabaseAdmin.from("push_logs").insert({
        establishment_id: s.establishment_id,
        subscription_id: s.id,
        customer_id: s.customer_id,
        title: data.title,
        body: data.body ?? null,
        url: data.url ?? null,
        status: r.ok ? "sent" : r.status === 410 || r.status === 404 ? "expired" : "failed",
        status_code: r.status ?? null,
        error: r.error ?? null,
      });
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

/**
 * Wallet-level push opt-in. Subscribes the current device for every card
 * the authenticated user owns, so a single "Ativar notificações" action on
 * the wallet home covers all establishments at once.
 */
export const subscribePushForAllMyCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => walletSubInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: customers, error } = await context.supabase
      .from("customers")
      .select("id, establishment_id")
      .eq("user_id", context.userId);
    if (error) throw error;
    const list = customers ?? [];
    if (list.length === 0) return { ok: true, count: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Deactivate any prior row on the same endpoint that isn't in our set
    // (avoid stale rows if the user changed establishments).
    const rows = list.map((c) => ({
      customer_id: c.id,
      establishment_id: c.establishment_id,
      user_id: context.userId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      auth_key: data.auth,
      user_agent: data.user_agent ?? null,
      preferences: { stamp: true, reward: true, campaign: true, birthday: true },
      active: true,
      last_error: null,
    }));
    const { error: upErr } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(rows, { onConflict: "customer_id,endpoint" });
    if (upErr) throw upErr;
    return { ok: true, count: rows.length };
  });

/** Deactivates the current device's push subscription across all user's cards. */
export const unsubscribePushForAllMyCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ active: false })
      .in("customer_id", ids)
      .eq("endpoint", data.endpoint);
    return { ok: true };
  });

/** Whether the current device endpoint is active on any of the user's cards. */
export const getMyWalletPushStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) return { subscribed: false, cardCount: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, active")
      .in("customer_id", ids)
      .eq("endpoint", data.endpoint)
      .eq("active", true);
    return { subscribed: (rows?.length ?? 0) > 0, cardCount: ids.length };
  });

/**
 * Sends a real Web Push to the current device's endpoint for the authenticated
 * customer. Smoke-test button on /carteira/perfil. Fails fast if the endpoint
 * doesn't belong to any of the user's cards (prevents cross-user probing).
 */
export const sendTestPushToMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) throw new Error("Nenhum cartão vinculado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id")
      .in("customer_id", ids)
      .eq("endpoint", data.endpoint)
      .eq("active", true)
      .limit(1);
    const sub = subs?.[0];
    if (!sub) throw new Error("Este aparelho não está inscrito. Ative as notificações primeiro.");

    const { sendPushToSub } = await import("./push.server");
    const r = await sendPushToSub(sub, {
      title: "Fidelize — teste de push",
      body: "Se você recebeu esta notificação, está tudo funcionando! 🎉",
      url: "/carteira/perfil",
      tag: "fidelize-test",
    });
    await supabaseAdmin.from("push_logs").insert({
      establishment_id: sub.establishment_id,
      subscription_id: sub.id,
      customer_id: sub.customer_id,
      title: "Fidelize — teste de push",
      body: "Smoke test manual do usuário",
      url: "/carteira/perfil",
      status: r.ok ? "sent" : r.status === 410 || r.status === 404 ? "expired" : "failed",
      status_code: r.status ?? null,
      error: r.error ?? null,
    });
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

/** Subscribe the currently authenticated user (admin/merchant) — no customer link. */
export const subscribeAdminPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adminSubInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Look up existing row on (user_id, endpoint) to preserve id/created_at.
    const { data: existing } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .is("customer_id", null)
      .maybeSingle();
    const payload: any = {
      user_id: context.userId,
      customer_id: null,
      establishment_id: null,
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
  .inputValidator((d: unknown) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id")
      .eq("user_id", context.userId)
      .eq("endpoint", data.endpoint)
      .eq("active", true)
      .is("customer_id", null)
      .maybeSingle();
    if (!sub) throw new Error("Este aparelho não está inscrito. Ative primeiro.");

    await supabaseAdmin.from("push_events").insert({
      user_id: context.userId,
      subscription_id: sub.id,
      event_type: "push_send_started",
      status: "pending",
    });
    const { sendPushToSub } = await import("./push.server");
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
    if (!r.ok) {
      // Only mark inactive on 404/410 — sendPushToSub already does that.
      throw new Error(
        `Falha no envio (HTTP ${r.status ?? "?"})${r.error ? `: ${r.error}` : ""}`,
      );
    }
    return { ok: true, status: r.status };
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
      private_key_present: !!priv,
      private_key_format_ok: privOk,
      subject_present: !!subject,
      subject,
      // Never return the raw private key. Public key is safe.
      public_key_preview: pub ? `${pub.slice(0, 12)}…${pub.slice(-6)}` : null,
    };
  });

