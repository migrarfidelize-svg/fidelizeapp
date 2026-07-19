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
    const s = publicClient();
    const { data: customer, error } = await s
      .from("customers")
      .select("id, establishment_id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (error || !customer) throw new Error("Cartão não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Upsert by unique endpoint.
    const { error: upErr } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(
        {
          customer_id: customer.id,
          establishment_id: customer.establishment_id,
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
        { onConflict: "endpoint" },
      );
    if (upErr) throw upErr;
    return { ok: true };
  });

export const unsubscribeCustomerPush = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(20).max(80), endpoint: z.string().url() }).parse(d),
  )
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: customer } = await s
      .from("customers")
      .select("id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const s = publicClient();
    const { data: customer } = await s
      .from("customers")
      .select("id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) throw new Error("Cartão não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const s = publicClient();
    const { data: customer } = await s
      .from("customers")
      .select("id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) return { subscribed: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

/** Merchant broadcast: send to all active push subs of the establishment. */
export const broadcastPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        title: z.string().min(2).max(80),
        body: z.string().max(200).optional(),
        url: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify manager+ role on this establishment
    const { data: isManager } = await context.supabase.rpc("has_establishment_role", {
      _user: context.userId,
      _est: data.establishment_id,
      _min_role: "manager",
    });
    if (!isManager) throw new Error("Sem permissão.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, preferences")
      .eq("establishment_id", data.establishment_id)
      .eq("active", true);

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
