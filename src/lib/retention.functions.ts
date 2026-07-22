import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const DEFAULT_THRESHOLDS = { bronze: 0, prata: 10, ouro: 25, diamante: 50 } as const;

// -------------------- Settings --------------------

export const getRetentionSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("retention_settings")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    return (
      row ?? {
        establishment_id: data.establishment_id,
        birthday_enabled: true,
        birthday_message:
          "Feliz aniversário! Um mimo especial te espera na sua próxima visita.",
        birthday_coupon_percent: 0,
        reengagement_enabled: true,
        reengagement_days: 30,
        reengagement_message:
          "Sentimos sua falta! Que tal voltar e acumular mais carimbos?",
        tiers_enabled: true,
        tier_thresholds: DEFAULT_THRESHOLDS,
        referral_enabled: true,
        referral_bonus_stamps: 1,
      }
    );
  });

export const saveRetentionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        birthday_enabled: z.boolean(),
        birthday_message: z.string().min(2).max(500),
        birthday_coupon_percent: z.number().int().min(0).max(100),
        reengagement_enabled: z.boolean(),
        reengagement_days: z.number().int().min(7).max(365),
        reengagement_message: z.string().min(2).max(500),
        tiers_enabled: z.boolean(),
        tier_thresholds: z.object({
          bronze: z.number().int().min(0),
          prata: z.number().int().min(1),
          ouro: z.number().int().min(2),
          diamante: z.number().int().min(3),
        }),
        referral_enabled: z.boolean(),
        referral_bonus_stamps: z.number().int().min(0).max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("retention_settings").upsert(
      {
        ...data,
        tier_thresholds: data.tier_thresholds as unknown as Database["public"]["Tables"]["retention_settings"]["Row"]["tier_thresholds"],
      },
      { onConflict: "establishment_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

// -------------------- Referral --------------------

/** Public: look up a referral code — used by the /r/:code landing. */
export const lookupReferralCode = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: row } = await s
      .from("customers")
      .select(
        "id, name, referral_code, establishment_id, establishments!inner(id, slug, name, logo_url, primary_color)",
      )
      .eq("referral_code", data.code.toUpperCase())
      .maybeSingle();
    if (!row) return null;
    return {
      referrerName: row.name,
      establishment: row.establishments,
    };
  });

/** Apply a referral to an existing customer (from voucher). Awards bonus stamp both sides. */
export const applyReferralByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(20).max(80),
        code: z.string().min(4).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: customer } = await s
      .from("customers")
      .select("id, establishment_id, referred_by, referral_code")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) throw new Error("Cartão não encontrado.");
    if (customer.referred_by) throw new Error("Você já usou um código de indicação.");
    if (customer.referral_code?.toUpperCase() === data.code.toUpperCase()) {
      throw new Error("Você não pode indicar a si mesmo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: referrer } = await supabaseAdmin
      .from("customers")
      .select("id, establishment_id, name")
      .eq("referral_code", data.code.toUpperCase())
      .eq("establishment_id", customer.establishment_id)
      .maybeSingle();
    if (!referrer) throw new Error("Código inválido para este estabelecimento.");

    const { data: settings } = await supabaseAdmin
      .from("retention_settings")
      .select("referral_enabled, referral_bonus_stamps")
      .eq("establishment_id", customer.establishment_id)
      .maybeSingle();
    if (settings && settings.referral_enabled === false) {
      throw new Error("Programa de indicação está desativado.");
    }
    const bonus = Math.max(0, Math.min(5, settings?.referral_bonus_stamps ?? 1));

    // Link customer to referrer
    await supabaseAdmin
      .from("customers")
      .update({ referred_by: referrer.id })
      .eq("id", customer.id);

    // Award bonus stamps on the "default" active campaign for each side (best-effort).
    if (bonus > 0) {
      await grantBonusStamps(customer.id, customer.establishment_id, bonus, "referral_reward");
      await grantBonusStamps(referrer.id, customer.establishment_id, bonus, "referral_reward");
    }

    await supabaseAdmin.from("retention_events").insert([
      {
        establishment_id: customer.establishment_id,
        customer_id: customer.id,
        event_type: "referral_signup",
        meta: { referrer_id: referrer.id, referrer_name: referrer.name },
      },
      {
        establishment_id: customer.establishment_id,
        customer_id: referrer.id,
        event_type: "referral_reward",
        meta: { bonus },
      },
    ]);

    return { ok: true, referrer: referrer.name, bonus };
  });

async function grantBonusStamps(
  customerId: string,
  establishmentId: string,
  count: number,
  _note: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: campaign } = await supabaseAdmin
    .from("campaigns")
    .select("id, stamps_required")
    .eq("establishment_id", establishmentId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!campaign) return;

  const { data: existing } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id, stamps, cycle")
    .eq("customer_id", customerId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();
  let cardId = existing?.id;
  let cycle = existing?.cycle ?? 1;
  if (!cardId) {
    const { data: created } = await supabaseAdmin
      .from("loyalty_cards")
      .insert({
        customer_id: customerId,
        campaign_id: campaign.id,
        establishment_id: establishmentId,
        stamps: 0,
        cycle: 1,
      })
      .select("id, cycle")
      .single();
    cardId = created?.id;
    cycle = created?.cycle ?? 1;
  }
  if (!cardId) return;
  for (let i = 0; i < count; i++) {
    await supabaseAdmin.from("stamps").insert({
      card_id: cardId,
      cycle,
      establishment_id: establishmentId,
    });
  }
}

// -------------------- Public referral tracking (click / share) --------------------

/**
 * Public: log a referral link event (click on /r/:code landing, or native share).
 * Anonymous — attributes the event to the referrer's customer row. Safe by RLS:
 * `anon` can only insert rows whose event_type is 'referral_click' or 'referral_share'.
 */
export const trackReferralEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().min(4).max(20),
        kind: z.enum(["click", "share"]),
        utm: z
          .object({
            source: z.string().max(60).optional(),
            medium: z.string().max(60).optional(),
            campaign: z.string().max(60).optional(),
            content: z.string().max(60).optional(),
          })
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: row } = await s
      .from("customers")
      .select("id, establishment_id")
      .eq("referral_code", data.code.toUpperCase())
      .maybeSingle();
    if (!row) return { ok: false };
    await s.from("retention_events").insert({
      establishment_id: row.establishment_id,
      customer_id: row.id,
      event_type: data.kind === "click" ? "referral_click" : "referral_share",
      meta: {
        code: data.code.toUpperCase(),
        utm_source: data.utm?.source ?? null,
        utm_medium: data.utm?.medium ?? null,
        utm_campaign: data.utm?.campaign ?? null,
        utm_content: data.utm?.content ?? null,
      },
    });
    return { ok: true };
  });

// -------------------- Merchant referral dashboard --------------------

const REFERRAL_EVENT_TYPES = [
  "referral_click",
  "referral_share",
  "referral_signup",
  "referral_reward",
] as const;

export const listReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        days: z.number().int().min(1).max(365).optional(),
        event_types: z.array(z.string()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Top referrers = customers who appear most as referred_by
    const { data: rows } = await context.supabase
      .from("customers")
      .select("id, name, referred_by")
      .eq("establishment_id", data.establishment_id);
    const counts = new Map<string, number>();
    for (const r of rows ?? []) {
      if (r.referred_by) counts.set(r.referred_by, (counts.get(r.referred_by) ?? 0) + 1);
    }
    const top = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        id,
        name: rows?.find((x) => x.id === id)?.name ?? "—",
        count,
      }));

    // Funnel events (filtered by period + optional event_types)
    const days = Math.max(1, Math.min(365, data.days ?? 90));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const filterTypes =
      data.event_types && data.event_types.length > 0
        ? (data.event_types.filter((t) =>
            (REFERRAL_EVENT_TYPES as readonly string[]).includes(t),
          ) as string[])
        : (REFERRAL_EVENT_TYPES as readonly string[] as string[]);

    const { data: events } = await context.supabase
      .from("retention_events")
      .select("event_type, created_at, meta")
      .eq("establishment_id", data.establishment_id)
      .in("event_type", filterTypes)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    const funnel = { clicks: 0, shares: 0, signups: 0, rewards: 0 };
    const utmSourceMap = new Map<string, { clicks: number; signups: number }>();
    const timeline = new Map<string, { clicks: number; shares: number; signups: number; rewards: number }>();

    for (const e of events ?? []) {
      if (e.event_type === "referral_click") funnel.clicks++;
      else if (e.event_type === "referral_share") funnel.shares++;
      else if (e.event_type === "referral_signup") funnel.signups++;
      else if (e.event_type === "referral_reward") funnel.rewards++;

      // Daily bucket
      const day = (e.created_at as string).slice(0, 10);
      const t = timeline.get(day) ?? { clicks: 0, shares: 0, signups: 0, rewards: 0 };
      if (e.event_type === "referral_click") t.clicks++;
      else if (e.event_type === "referral_share") t.shares++;
      else if (e.event_type === "referral_signup") t.signups++;
      else if (e.event_type === "referral_reward") t.rewards++;
      timeline.set(day, t);

      // UTM source attribution (clicks + signups)
      const meta = (e.meta ?? {}) as Record<string, unknown>;
      const src = (typeof meta.utm_source === "string" && meta.utm_source) || "direct";
      if (e.event_type === "referral_click" || e.event_type === "referral_signup") {
        const bucket = utmSourceMap.get(src) ?? { clicks: 0, signups: 0 };
        if (e.event_type === "referral_click") bucket.clicks++;
        else bucket.signups++;
        utmSourceMap.set(src, bucket);
      }
    }

    const conversion =
      funnel.clicks > 0 ? Math.round((funnel.signups / funnel.clicks) * 100) : 0;

    const utmSources = Array.from(utmSourceMap.entries())
      .map(([source, v]) => ({
        source,
        clicks: v.clicks,
        signups: v.signups,
        conversion: v.clicks > 0 ? Math.round((v.signups / v.clicks) * 100) : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);

    const timelineArr = Array.from(timeline.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return {
      totalReferred: (rows ?? []).filter((r) => r.referred_by).length,
      totalCustomers: rows?.length ?? 0,
      top,
      funnel,
      conversion,
      utmSources,
      timeline: timelineArr,
      period_days: days,
    };
  });


// -------------------- Retention events (customer timeline) --------------------

export const listRetentionEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("retention_events")
      .select("id, event_type, from_value, to_value, meta, created_at, customer_id")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw error;
    return rows;
  });
