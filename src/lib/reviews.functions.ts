import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input as RequestInfo, { ...init, headers: h });
      },
    },
  });
}

// ============ PUBLIC: get context by voucher token ============
export const getReviewContextByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: customer } = await sb
      .from("customers")
      .select("id, establishment_id, name, establishments(id, name, slug, logo_url, primary_color, accent_color)")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) return null;
    const { data: cards } = await sb
      .from("loyalty_cards")
      .select("id")
      .eq("customer_id", customer.id);
    const cardIds = (cards ?? []).map((c) => c.id);
    let lastStamp: { id: string; created_at: string; card_id: string } | null = null;
    if (cardIds.length) {
      const { data: st } = await sb
        .from("stamps")
        .select("id, created_at, card_id")
        .in("card_id", cardIds)
        .is("reverted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      lastStamp = st;
    }
    const { data: settings } = await sb
      .from("review_settings")
      .select("*")
      .eq("establishment_id", customer.establishment_id)
      .maybeSingle();
    let existing = null;
    if (lastStamp) {
      const { data: rv } = await sb.from("reviews").select("id").eq("stamp_id", lastStamp.id).maybeSingle();
      existing = rv;
    }
    return { customer, lastStamp, settings, existing };
  });

// ============ PUBLIC: submit review by voucher token ============
const submitSchema = z.object({
  token: z.string().min(10).max(120),
  rating: z.number().int().min(1).max(5),
  nps: z.number().int().min(0).max(10).optional().nullable(),
  categories: z.record(z.number().int().min(1).max(5)).optional(),
  comment: z.string().trim().max(1000).optional(),
  customerName: z.string().trim().max(120).optional(),
  isPublic: z.boolean().optional(),
});

export const submitReviewByToken = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof submitSchema>) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: customer } = await sb
      .from("customers")
      .select("id, establishment_id")
      .eq("access_token", data.token)
      .maybeSingle();
    if (!customer) throw new Error("Cartão não encontrado.");
    const { data: cards } = await sb.from("loyalty_cards").select("id").eq("customer_id", customer.id);
    const cardIds = (cards ?? []).map((c) => c.id);
    if (!cardIds.length) throw new Error("Sem cartão ativo.");
    const { data: lastStamp } = await sb
      .from("stamps")
      .select("id, created_at, card_id")
      .in("card_id", cardIds)
      .is("reverted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!lastStamp) throw new Error("Você precisa ter um carimbo recente para avaliar.");
    const ageMs = Date.now() - new Date(lastStamp.created_at).getTime();
    if (ageMs > 72 * 3600 * 1000) throw new Error("A janela de 72h para avaliar já expirou.");
    const { data: exists } = await sb.from("reviews").select("id").eq("stamp_id", lastStamp.id).maybeSingle();
    if (exists) throw new Error("Você já avaliou este atendimento.");

    const { data: inserted, error } = await sb.from("reviews").insert({
      establishment_id: customer.establishment_id,
      customer_id: customer.id,
      card_id: lastStamp.card_id,
      stamp_id: lastStamp.id,
      rating: data.rating,
      nps: data.nps ?? null,
      categories: data.categories ?? {},
      comment: data.comment ?? null,
      customer_name: data.customerName ?? null,
      is_public: data.isPublic ?? true,
      source: "voucher",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// ============ PUBLIC: list reviews for establishment public page ============
export const listPublicReviews = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; limit?: number }) => z.object({ slug: z.string().min(1).max(80), limit: z.number().int().min(1).max(50).optional() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: est } = await sb
      .from("establishments")
      .select("id, name, slug, logo_url, primary_color, accent_color")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!est) return null;
    const { data: settings } = await sb
      .from("review_settings")
      .select("public_page_enabled, google_place_url")
      .eq("establishment_id", est.id)
      .maybeSingle();
    if (settings && settings.public_page_enabled === false) return { est, settings, reviews: [], stats: { count: 0, avg: 0 } };
    const { data: reviews } = await sb
      .from("reviews")
      .select("id, rating, comment, customer_name, reply, replied_at, created_at")
      .eq("establishment_id", est.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    const list = reviews ?? [];
    const avg = list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0;
    return { est, settings, reviews: list, stats: { count: list.length, avg } };
  });

// ============ MERCHANT: list reviews ============
export const listReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; ratingFilter?: number; limit?: number }) =>
    z.object({ establishmentId: z.string().uuid(), ratingFilter: z.number().int().min(1).max(5).optional(), limit: z.number().int().min(1).max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("reviews")
      .select("id, rating, nps, categories, comment, customer_name, reply, replied_at, is_public, source, created_at, customer_id, customers(name)")
      .eq("establishment_id", data.establishmentId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.ratingFilter) q = q.eq("rating", data.ratingFilter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ============ MERCHANT: stats ============
export const getReviewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; days?: number }) =>
    z.object({ establishmentId: z.string().uuid(), days: z.number().int().min(1).max(365).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - (data.days ?? 30) * 86400000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("reviews")
      .select("rating, nps, created_at")
      .eq("establishment_id", data.establishmentId)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const count = list.length;
    const avg = count ? list.reduce((a, r) => a + r.rating, 0) / count : 0;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    list.forEach((r) => { dist[r.rating] = (dist[r.rating] ?? 0) + 1; });
    const npsList = list.map((r) => r.nps).filter((n): n is number => typeof n === "number");
    let nps: number | null = null;
    if (npsList.length) {
      const promoters = npsList.filter((n) => n >= 9).length;
      const detractors = npsList.filter((n) => n <= 6).length;
      nps = Math.round(((promoters - detractors) / npsList.length) * 100);
    }
    return { count, avg, dist, nps, npsResponses: npsList.length };
  });

// ============ MERCHANT: reply ============
export const replyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; reply: string }) =>
    z.object({ reviewId: z.string().uuid(), reply: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reviews")
      .update({ reply: data.reply, replied_at: new Date().toISOString(), replied_by: context.userId })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ MERCHANT: toggle publish ============
export const toggleReviewPublic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reviewId: string; isPublic: boolean }) =>
    z.object({ reviewId: z.string().uuid(), isPublic: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reviews")
      .update({ is_public: data.isPublic })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ MERCHANT: settings ============
export const getReviewSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string }) => z.object({ establishmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("review_settings")
      .select("*")
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();
    return row;
  });

const settingsSchema = z.object({
  establishmentId: z.string().uuid(),
  auto_prompt: z.boolean(),
  prompt_title: z.string().trim().min(1).max(120),
  prompt_message: z.string().trim().min(1).max(300),
  ask_nps: z.boolean(),
  ask_categories: z.boolean(),
  google_place_url: z.string().trim().url().max(500).nullable().optional(),
  google_redirect_min_rating: z.number().int().min(1).max(5),
  public_page_enabled: z.boolean(),
  thank_you_message: z.string().trim().min(1).max(300),
});

export const saveReviewSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof settingsSchema>) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { establishmentId, ...rest } = data;
    const { error } = await context.supabase
      .from("review_settings")
      .upsert({ establishment_id: establishmentId, ...rest, google_place_url: rest.google_place_url || null }, { onConflict: "establishment_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ MERCHANT: tema da página pública ============
const reviewThemeSchema = z.object({
  establishmentId: z.string().uuid(),
  theme: z.object({
    preset: z.enum(["circuit", "noir", "cream", "solar", "rose", "oceano"]),
    pattern: z.enum(["none", "grid", "dots", "aurora"]),
    accent: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).nullable(),
    bg_color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).nullable(),
    headline: z.string().trim().max(90).nullable(),
    subheadline: z.string().trim().max(160).nullable(),
    show_reviews: z.boolean(),
    show_powered_by: z.boolean(),
  }),
});

export const saveReviewTheme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof reviewThemeSchema>) => reviewThemeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("review_settings")
      .upsert(
        { establishment_id: data.establishmentId, theme: data.theme },
        { onConflict: "establishment_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
