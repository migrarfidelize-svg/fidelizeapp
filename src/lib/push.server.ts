// Server-only web-push helpers. NEVER import from client code.
// Imports web-push dynamically to keep it out of client bundles.
import type { Database } from "@/integrations/supabase/types";

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  type?: string;
  slug?: string;
  requireInteraction?: boolean;
};

type SubRow = Pick<
  Database["public"]["Tables"]["push_subscriptions"]["Row"],
  "id" | "endpoint" | "p256dh" | "auth_key" | "establishment_id" | "customer_id"
>;

/**
 * Send a push to a single subscription row. Marks the row inactive on 410/404.
 * Returns { ok, status } — never throws.
 */
export async function sendPushToSub(
  sub: SubRow,
  payload: PushPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@fidelize.app";
  if (!publicKey || !privateKey) {
    return { ok: false, error: "vapid_not_configured" };
  }

  try {
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const notificationId = `${Date.now()}-${sub.id.slice(0, 8)}`;
    const normalizedPayload = {
      title: payload.title,
      body: payload.body ?? "",
      url: payload.url,
      icon: payload.icon ?? "/icon-192.png",
      badge: payload.badge ?? "/icon-192.png",
      type: payload.type,
      slug: payload.slug,
      tag: payload.tag ? `${payload.tag}-${notificationId}` : `fidelize-${notificationId}`,
      notificationId,
      timestamp: Date.now(),
      requireInteraction: payload.requireInteraction ?? true,
      silent: false,
    };
    const res = await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth_key },
      },
      JSON.stringify(normalizedPayload),
      { TTL: 60 * 60 * 24 },
    );
    return { ok: true, status: res.statusCode };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const status = err.statusCode ?? 0;
    const expired = status === 404 || status === 410;
    // Mark subscription inactive if endpoint is gone.
    if (expired) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("push_subscriptions")
        .update({ active: false, last_error: `expired:${status}` })
        .eq("id", sub.id);
    }
    return { ok: false, status, error: err.body || err.message };
  }
}

/**
 * Send a push to all active subscriptions of a customer, then log every attempt.
 */
export async function sendPushToCustomer(
  customerId: string,
  payload: PushPayload,
  preferenceKey?: "stamp" | "reward" | "campaign" | "birthday",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, preferences")
    .eq("customer_id", customerId)
    .eq("active", true);
  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  for (const s of subs) {
    if (preferenceKey) {
      const prefs = (s.preferences ?? {}) as Record<string, boolean>;
      if (prefs[preferenceKey] === false) continue;
    }
    const r = await sendPushToSub(s as SubRow, payload);
    await supabaseAdmin.from("push_logs").insert({
      establishment_id: s.establishment_id,
      subscription_id: s.id,
      customer_id: s.customer_id,
      title: payload.title,
      body: payload.body ?? null,
      url: payload.url ?? null,
      status: r.ok ? "sent" : r.status === 410 || r.status === 404 ? "expired" : "failed",
      status_code: r.status ?? null,
      error: r.error ?? null,
    });
    if (r.ok) sent++;
  }
  return { sent };
}
