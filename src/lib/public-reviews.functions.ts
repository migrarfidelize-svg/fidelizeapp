import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createHash } from "crypto";
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

const DEFAULT_LABELS: Record<number, string> = {
  1: "Muito ruim", 2: "Ruim", 3: "Regular", 4: "Bom", 5: "Excelente",
};
const DEFAULT_ACTIONS: Record<number, "apologize" | "ask_details" | "thank" | "invite_google"> = {
  1: "apologize", 2: "ask_details", 3: "thank", 4: "invite_google", 5: "invite_google",
};

// Ensure a form (and its 5 rating options) exists for an establishment.
async function ensureForm(
  sb: ReturnType<typeof publicClient>,
  establishmentId: string,
): Promise<string> {
  const { data: existing } = await sb.from("review_forms").select("id").eq("establishment_id", establishmentId).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await sb.from("review_forms").insert({ establishment_id: establishmentId }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Falha ao criar formulário");
  const rows = [1, 2, 3, 4, 5].map((n) => ({
    review_form_id: created.id,
    rating: n,
    label: DEFAULT_LABELS[n],
    comment_required: n <= 2,
    post_submit_action: DEFAULT_ACTIONS[n],
    display_order: n,
  }));
  await sb.from("review_rating_options").insert(rows);
  return created.id;
}

// ============ PUBLIC: fetch form by establishment slug ============
export const getPublicReviewForm = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: est } = await sb
      .from("establishments")
      .select("id, name, slug, logo_url, primary_color, accent_color, description")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!est) return null;

    const { data: form } = await sb
      .from("review_forms")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .maybeSingle();
    if (!form) return { est, form: null, options: [], questions: [], stats: null };

    const [{ data: options }, { data: questions }] = await Promise.all([
      sb.from("review_rating_options").select("*").eq("review_form_id", form.id).eq("enabled", true).order("display_order"),
      sb.from("review_questions").select("*").eq("review_form_id", form.id).eq("active", true).order("display_order"),
    ]);

    let stats: { count: number; avg: number } | null = null;
    if (form.show_average || form.show_review_count) {
      const { data: rows } = await sb
        .from("customer_reviews")
        .select("rating")
        .eq("establishment_id", est.id);
      const list = rows ?? [];
      stats = {
        count: list.length,
        avg: list.length ? list.reduce((a, r) => a + r.rating, 0) / list.length : 0,
      };
    }
    return { est, form, options: options ?? [], questions: questions ?? [], stats };
  });

// ============ PUBLIC: submit ============
const answerSchema = z.object({
  question_id: z.string().uuid(),
  answer_text: z.string().max(2000).optional().nullable(),
  answer_number: z.number().optional().nullable(),
  answer_boolean: z.boolean().optional().nullable(),
});

const submitSchema = z.object({
  slug: z.string().min(1).max(80),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  customer_name: z.string().trim().max(120).optional(),
  customer_phone: z.string().trim().max(40).optional(),
  customer_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  order_reference: z.string().trim().max(80).optional(),
  anonymous: z.boolean().optional(),
  source: z.enum(["linktree", "direct_url", "qr", "embed"]).optional(),
  device_id: z.string().trim().min(6).max(80),
  answers: z.array(answerSchema).max(30).optional(),
});

function sanitizeText(v: string | undefined | null): string | null {
  if (!v) return null;
  // strip HTML tags & control chars, keep basic text
  const t = String(v).replace(/<[^>]*>/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  return t.length ? t.slice(0, 2000) : null;
}

export const submitPublicReview = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof submitSchema>) => submitSchema.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: est } = await sb.from("establishments").select("id").eq("slug", data.slug).maybeSingle();
    if (!est) throw new Error("Estabelecimento não encontrado.");
    const { data: form } = await sb
      .from("review_forms")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .maybeSingle();
    if (!form) throw new Error("Avaliações desativadas.");

    // rating enabled?
    const { data: opt } = await sb
      .from("review_rating_options")
      .select("enabled, comment_required, post_submit_action, selection_message")
      .eq("review_form_id", form.id)
      .eq("rating", data.rating)
      .maybeSingle();
    if (!opt || !opt.enabled) throw new Error("Esta nota não está disponível.");

    // required fields
    const commentRequired = form.comment_required || opt.comment_required;
    const cleanComment = sanitizeText(data.comment);
    if (commentRequired && !cleanComment) throw new Error("Comentário é obrigatório para essa avaliação.");
    const isAnon = !!(data.anonymous && form.anonymous_allowed);
    if (!isAnon) {
      if (form.name_required && !data.customer_name?.trim()) throw new Error("Informe seu nome.");
      if (form.phone_required && !data.customer_phone?.trim()) throw new Error("Informe seu telefone.");
      if (form.email_required && !data.customer_email?.trim()) throw new Error("Informe seu e-mail.");
    }

    // cooldown via device hash (per form)
    const deviceHash = createHash("sha256").update(`${form.id}:${data.device_id}`).digest("hex");
    if (!form.allow_multiple && form.cooldown_hours > 0) {
      const since = new Date(Date.now() - form.cooldown_hours * 3600_000).toISOString();
      const { data: prev } = await sb
        .from("customer_reviews")
        .select("id")
        .eq("review_form_id", form.id)
        .eq("device_hash", deviceHash)
        .gte("submitted_at", since)
        .limit(1)
        .maybeSingle();
      if (prev) throw new Error(`Você já enviou uma avaliação recentemente. Tente novamente em ${form.cooldown_hours}h.`);
    }

    // insert (service role bypasses RLS: no INSERT policy on customer_reviews)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("customer_reviews")
      .insert({
        establishment_id: est.id,
        review_form_id: form.id,
        rating: data.rating,
        comment: cleanComment,
        customer_name: isAnon ? null : sanitizeText(data.customer_name),
        customer_phone: isAnon ? null : sanitizeText(data.customer_phone),
        customer_email: isAnon ? null : (data.customer_email || null),
        order_reference: sanitizeText(data.order_reference),
        source: data.source ?? "linktree",
        anonymous: isAnon,
        device_hash: deviceHash,
        status: data.rating <= 2 ? "analyzing" : "new",
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Erro ao enviar");

    // answers
    if (data.answers?.length) {
      const rows = data.answers.map((a) => ({
        review_id: inserted.id,
        question_id: a.question_id,
        answer_text: sanitizeText(a.answer_text ?? undefined),
        answer_number: a.answer_number ?? null,
        answer_boolean: a.answer_boolean ?? null,
      }));
      await supabaseAdmin.from("review_answers").insert(rows);
    }

    await supabaseAdmin.from("review_events").insert({
      review_form_id: form.id,
      review_id: inserted.id,
      event_type: "submitted",
      meta: { rating: data.rating, source: data.source ?? "linktree" },
    });

    const shouldOfferGoogle =
      form.redirect_to_google_enabled &&
      !!form.google_review_url &&
      (opt.post_submit_action === "invite_google");

    return {
      id: inserted.id,
      action: opt.post_submit_action,
      selection_message: opt.selection_message,
      google_url: shouldOfferGoogle ? form.google_review_url : null,
      success_message: form.success_message,
    };
  });

// ============ PUBLIC: telemetry (open, google_shown, google_clicked) ============
export const logPublicReviewEvent = createServerFn({ method: "POST" })
  .inputValidator((d: { form_id: string; event_type: string; review_id?: string }) =>
    z.object({
      form_id: z.string().uuid(),
      event_type: z.enum(["page_opened", "rating_selected", "google_shown", "google_clicked"]),
      review_id: z.string().uuid().optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("review_events").insert({
      review_form_id: data.form_id,
      review_id: data.review_id ?? null,
      event_type: data.event_type,
    });
    return { ok: true };
  });

// ============ MERCHANT ============
export const getMerchantReviewForm = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string }) => z.object({ establishmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const formId = await ensureForm(
      context.supabase as unknown as ReturnType<typeof publicClient>,
      data.establishmentId,
    );
    const [{ data: form }, { data: options }, { data: questions }] = await Promise.all([
      context.supabase.from("review_forms").select("*").eq("id", formId).single(),
      context.supabase.from("review_rating_options").select("*").eq("review_form_id", formId).order("display_order"),
      context.supabase.from("review_questions").select("*").eq("review_form_id", formId).order("display_order"),
    ]);
    return { form: form!, options: options ?? [], questions: questions ?? [] };
  });

const formSaveSchema = z.object({
  establishmentId: z.string().uuid(),
  active: z.boolean(),
  title: z.string().trim().min(1).max(160),
  question: z.string().trim().min(1).max(300),
  description: z.string().trim().max(500).nullable().optional(),
  submit_label: z.string().trim().min(1).max(60),
  success_message: z.string().trim().min(1).max(300),
  star_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  button_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  google_review_url: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  redirect_to_google_enabled: z.boolean(),
  show_average: z.boolean(),
  show_review_count: z.boolean(),
  anonymous_allowed: z.boolean(),
  name_required: z.boolean(),
  phone_required: z.boolean(),
  email_required: z.boolean(),
  comment_required: z.boolean(),
  allow_multiple: z.boolean(),
  cooldown_hours: z.number().int().min(0).max(720),
  consent_text: z.string().trim().max(500).nullable().optional(),
});

export const saveMerchantReviewForm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof formSaveSchema>) => formSaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const formId = await ensureForm(
      context.supabase as unknown as ReturnType<typeof publicClient>,
      data.establishmentId,
    );
    const { establishmentId: _e, ...rest } = data;
    const { error } = await context.supabase
      .from("review_forms")
      .update({
        ...rest,
        google_review_url: rest.google_review_url || null,
      })
      .eq("id", formId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const optionSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean(),
  label: z.string().trim().min(1).max(60),
  selection_message: z.string().trim().max(300).nullable().optional(),
  comment_required: z.boolean(),
  post_submit_action: z.enum(["apologize", "ask_details", "thank", "invite_google", "invite_share", "none"]),
});

export const saveRatingOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; options: z.infer<typeof optionSchema>[] }) =>
    z.object({
      establishmentId: z.string().uuid(),
      options: z.array(optionSchema).min(1).max(5),
    }).parse(d))
  .handler(async ({ data, context }) => {
    // authorize: options belong to form of that establishment
    const { data: form } = await context.supabase
      .from("review_forms")
      .select("id")
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();
    if (!form) throw new Error("Formulário não encontrado.");
    for (const o of data.options) {
      const { error } = await context.supabase
        .from("review_rating_options")
        .update({
          enabled: o.enabled,
          label: o.label,
          selection_message: o.selection_message ?? null,
          comment_required: o.comment_required,
          post_submit_action: o.post_submit_action,
        })
        .eq("id", o.id)
        .eq("review_form_id", form.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Questions CRUD
const questionUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(1).max(200),
  question_type: z.enum(["stars", "nps", "yes_no", "choice", "short", "long"]),
  choices: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  required: z.boolean(),
  display_order: z.number().int().min(0).max(1000),
  active: z.boolean(),
});

export const upsertReviewQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; question: z.infer<typeof questionUpsertSchema> }) =>
    z.object({ establishmentId: z.string().uuid(), question: questionUpsertSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: form } = await context.supabase
      .from("review_forms")
      .select("id")
      .eq("establishment_id", data.establishmentId)
      .maybeSingle();
    if (!form) throw new Error("Formulário não encontrado.");
    const payload = {
      review_form_id: form.id,
      question: data.question.question,
      question_type: data.question.question_type,
      choices: data.question.choices ?? null,
      required: data.question.required,
      display_order: data.question.display_order,
      active: data.question.active,
    };
    if (data.question.id) {
      const { error } = await context.supabase.from("review_questions").update(payload).eq("id", data.question.id).eq("review_form_id", form.id);
      if (error) throw new Error(error.message);
      return { id: data.question.id };
    }
    const { data: ins, error } = await context.supabase.from("review_questions").insert(payload).select("id").single();
    if (error || !ins) throw new Error(error?.message ?? "Erro");
    return { id: ins.id };
  });

export const deleteReviewQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("review_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Inbox
export const listPublicReviewsInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; status?: string; ratingFilter?: number; withCommentOnly?: boolean; limit?: number }) =>
    z.object({
      establishmentId: z.string().uuid(),
      status: z.enum(["new", "analyzing", "contacting", "resolved", "archived"]).optional(),
      ratingFilter: z.number().int().min(1).max(5).optional(),
      withCommentOnly: z.boolean().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("customer_reviews")
      .select("id, rating, comment, customer_name, customer_phone, customer_email, order_reference, source, status, anonymous, internal_note, ticket_id, submitted_at, created_at, resolved_at")
      .eq("establishment_id", data.establishmentId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.ratingFilter) q = q.eq("rating", data.ratingFilter);
    if (data.withCommentOnly) q = q.not("comment", "is", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updatePublicReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status?: string; internal_note?: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["new", "analyzing", "contacting", "resolved", "archived"]).optional(),
      internal_note: z.string().trim().max(2000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: {
      status?: "new" | "analyzing" | "contacting" | "resolved" | "archived";
      resolved_at?: string;
      internal_note?: string;
    } = {};
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
    }
    if (data.internal_note !== undefined) patch.internal_note = data.internal_note;
    const { error } = await context.supabase.from("customer_reviews").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublicReviewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishmentId: string; days?: number }) =>
    z.object({ establishmentId: z.string().uuid(), days: z.number().int().min(1).max(365).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - (data.days ?? 30) * 86400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("customer_reviews")
      .select("rating, created_at, source, status")
      .eq("establishment_id", data.establishmentId)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const count = list.length;
    const avg = count ? list.reduce((a, r) => a + r.rating, 0) / count : 0;
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const bySource: Record<string, number> = {};
    list.forEach((r) => {
      dist[r.rating] = (dist[r.rating] ?? 0) + 1;
      bySource[r.source ?? "linktree"] = (bySource[r.source ?? "linktree"] ?? 0) + 1;
    });
    const pending = list.filter((r) => r.status === "new").length;
    return { count, avg, dist, bySource, pending };
  });
