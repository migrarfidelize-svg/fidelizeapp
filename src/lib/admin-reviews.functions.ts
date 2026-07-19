import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

// ---------- Overview: consolidated across all establishments ----------
export const adminReviewsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => ({ days: d?.days ?? 30 }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("customer_reviews")
      .select("id, rating, status, created_at, establishment_id, public_hidden")
      .gte("created_at", since);
    if (error) throw new Error(error.message);

    const total = rows?.length ?? 0;
    const avg = total ? (rows!.reduce((s, r) => s + r.rating, 0) / total) : 0;
    const dist = [1, 2, 3, 4, 5].map((n) => ({ n, count: rows?.filter((r) => r.rating === n).length ?? 0 }));
    const lowPending = rows?.filter((r) => r.rating <= 2 && (r.status === "new" || r.status === "analyzing" || r.status === "contacting")).length ?? 0;
    const hidden = rows?.filter((r) => r.public_hidden).length ?? 0;

    // Series by day
    const byDay = new Map<string, { count: number; sum: number }>();
    for (const r of rows ?? []) {
      const k = r.created_at.slice(0, 10);
      const cur = byDay.get(k) ?? { count: 0, sum: 0 };
      cur.count++; cur.sum += r.rating;
      byDay.set(k, cur);
    }
    const series = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, count: v.count, avg: v.count ? v.sum / v.count : 0 }));

    return { total, avg, dist, lowPending, hidden, series };
  });

// ---------- Ranking of establishments ----------
export const adminReviewsRanking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number; order?: "best" | "worst" | "volume"; limit?: number }) => ({
    days: d?.days ?? 30,
    order: d?.order ?? "worst",
    limit: d?.limit ?? 50,
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("customer_reviews")
      .select("establishment_id, rating, status")
      .gte("created_at", since);
    if (error) throw new Error(error.message);

    const map = new Map<string, { count: number; sum: number; low: number; lowPending: number }>();
    for (const r of rows ?? []) {
      const cur = map.get(r.establishment_id) ?? { count: 0, sum: 0, low: 0, lowPending: 0 };
      cur.count++; cur.sum += r.rating;
      if (r.rating <= 2) { cur.low++; if (r.status === "new" || r.status === "analyzing" || r.status === "contacting") cur.lowPending++; }
      map.set(r.establishment_id, cur);
    }

    const ids = Array.from(map.keys());
    if (!ids.length) return [];
    const { data: ests } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug, plan, active, logo_url")
      .in("id", ids);

    const arr = (ests ?? []).map((e) => {
      const m = map.get(e.id)!;
      const avg = m.count ? m.sum / m.count : 0;
      return { est: e, count: m.count, avg, low: m.low, lowPending: m.lowPending };
    });

    if (data.order === "best") arr.sort((a, b) => b.avg - a.avg || b.count - a.count);
    else if (data.order === "worst") arr.sort((a, b) => a.avg - b.avg || b.low - a.low);
    else arr.sort((a, b) => b.count - a.count);

    return arr.slice(0, data.limit);
  });

// ---------- Global moderation feed ----------
export const adminReviewsList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    q?: string;
    ratingMax?: number;
    ratingMin?: number;
    status?: "any" | "new" | "analyzing" | "contacting" | "resolved" | "archived" | "hidden";
    establishmentId?: string | null;
    page?: number;
    pageSize?: number;
  }) => ({
    q: d?.q ?? "",
    ratingMax: d?.ratingMax,
    ratingMin: d?.ratingMin,
    status: d?.status ?? "any",
    establishmentId: d?.establishmentId ?? null,
    page: Math.max(1, d?.page ?? 1),
    pageSize: Math.min(100, d?.pageSize ?? 25),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabaseAdmin
      .from("customer_reviews")
      .select("id, establishment_id, rating, status, comment, customer_name, customer_email, customer_phone, anonymous, public_hidden, merchant_reply, merchant_reply_at, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.establishmentId) q = q.eq("establishment_id", data.establishmentId);
    if (data.ratingMax != null) q = q.lte("rating", data.ratingMax);
    if (data.ratingMin != null) q = q.gte("rating", data.ratingMin);
    if (data.status === "hidden") q = q.eq("public_hidden", true);
    else if (data.status !== "any") q = q.eq("status", data.status);
    if (data.q) q = q.or(`comment.ilike.%${data.q}%,customer_name.ilike.%${data.q}%,customer_email.ilike.%${data.q}%`);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.establishment_id)));
    const { data: ests } = ids.length
      ? await supabaseAdmin.from("establishments").select("id, name, slug, logo_url").in("id", ids)
      : { data: [] as any[] };
    const emap = new Map((ests ?? []).map((e: any) => [e.id, e]));

    return {
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      items: (rows ?? []).map((r) => ({ ...r, establishment: emap.get(r.establishment_id) ?? null })),
    };
  });

// ---------- Moderation actions ----------
export const adminSetReviewHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; hidden: boolean; reason?: string }) =>
    z.object({ reviewId: z.string().uuid(), hidden: z.boolean(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: r, error: e0 } = await supabaseAdmin
      .from("customer_reviews").select("id, establishment_id, review_form_id").eq("id", data.reviewId).maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!r) throw new Error("Avaliação não encontrada.");

    const { error } = await supabaseAdmin
      .from("customer_reviews")
      .update({ public_hidden: data.hidden, updated_at: new Date().toISOString() })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("review_events").insert({
      review_form_id: r.review_form_id,
      review_id: data.reviewId,
      event_type: data.hidden ? "admin_hidden" : "admin_unhidden",
      meta: { reason: data.reason ?? null, actor: userId, establishment_id: r.establishment_id },
    });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      establishment_id: r.establishment_id,
      action: data.hidden ? "review.hide" : "review.unhide",
      entity_type: "customer_review",
      entity_id: data.reviewId,
      metadata: { reason: data.reason ?? null },
    });

    return { ok: true };
  });


export const adminDeleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; reason?: string }) =>
    z.object({ reviewId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: r } = await supabaseAdmin
      .from("customer_reviews").select("id, establishment_id").eq("id", data.reviewId).maybeSingle();
    if (!r) throw new Error("Avaliação não encontrada.");

    const { error } = await supabaseAdmin.from("customer_reviews").delete().eq("id", data.reviewId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "review.delete",
      target_type: "customer_review",
      target_id: data.reviewId,
      metadata: { establishment_id: r.establishment_id, reason: data.reason ?? null },
    });

    return { ok: true };
  });

// ---------- Fraud detection ----------
export const adminReviewsFraudSignals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => ({ days: d?.days ?? 7 }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("customer_reviews")
      .select("id, establishment_id, rating, device_hash, ip_hash, created_at")
      .gte("created_at", since);
    if (error) throw new Error(error.message);

    // Group by device+establishment and ip+establishment
    const deviceMap = new Map<string, { est: string; count: number; ratings: number[]; sample: string }>();
    const ipMap = new Map<string, { est: string; count: number; ratings: number[]; sample: string }>();
    const bursts = new Map<string, { est: string; count: number; ratings: number[] }>();

    for (const r of rows ?? []) {
      if (r.device_hash) {
        const k = `${r.establishment_id}::${r.device_hash}`;
        const cur = deviceMap.get(k) ?? { est: r.establishment_id, count: 0, ratings: [], sample: r.device_hash };
        cur.count++; cur.ratings.push(r.rating);
        deviceMap.set(k, cur);
      }
      if (r.ip_hash) {
        const k = `${r.establishment_id}::${r.ip_hash}`;
        const cur = ipMap.get(k) ?? { est: r.establishment_id, count: 0, ratings: [], sample: r.ip_hash };
        cur.count++; cur.ratings.push(r.rating);
        ipMap.set(k, cur);
      }
      // 10-min burst window
      const bucket = `${r.establishment_id}::${r.created_at.slice(0, 15)}`; // YYYY-MM-DDTHH:M
      const cur = bursts.get(bucket) ?? { est: r.establishment_id, count: 0, ratings: [] };
      cur.count++; cur.ratings.push(r.rating);
      bursts.set(bucket, cur);
    }

    const suspiciousDevice = Array.from(deviceMap.values()).filter((v) => v.count >= 3);
    const suspiciousIp = Array.from(ipMap.values()).filter((v) => v.count >= 5);
    const suspiciousBursts = Array.from(bursts.values()).filter((v) => v.count >= 10);

    const estIds = Array.from(new Set([
      ...suspiciousDevice.map((v) => v.est),
      ...suspiciousIp.map((v) => v.est),
      ...suspiciousBursts.map((v) => v.est),
    ]));

    const { data: ests } = estIds.length
      ? await supabaseAdmin.from("establishments").select("id, name, slug").in("id", estIds)
      : { data: [] as any[] };
    const emap = new Map((ests ?? []).map((e: any) => [e.id, e]));

    const enrich = <T extends { est: string }>(arr: T[]) =>
      arr.map((v) => ({ ...v, establishment: emap.get(v.est) ?? null }));

    return {
      device: enrich(suspiciousDevice).sort((a, b) => b.count - a.count).slice(0, 30),
      ip: enrich(suspiciousIp).sort((a, b) => b.count - a.count).slice(0, 30),
      bursts: enrich(suspiciousBursts).sort((a, b) => b.count - a.count).slice(0, 30),
    };
  });

// ---------- Establishment picker (for filters) ----------
export const adminListEstablishmentsMini = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("establishments").select("id, name, slug").order("name").limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
