import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
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

// ---------- Public: help center by slug ----------
export const getHelpCenter = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: est, error } = await s
      .from("establishments")
      .select("id, slug, name, description, logo_url, primary_color, accent_color")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!est) throw new Error("Central de ajuda não encontrada.");
    const [{ data: cats }, { data: articles }] = await Promise.all([
      s.from("kb_categories").select("id, name, slug, description, icon, sort_order").eq("establishment_id", est.id).order("sort_order"),
      s.from("kb_articles").select("id, slug, title, excerpt, category_id, views, helpful_count, tags").eq("establishment_id", est.id).eq("published", true).order("views", { ascending: false }),
    ]);
    return { establishment: est, categories: cats ?? [], articles: articles ?? [] };
  });

export const searchArticles = createServerFn({ method: "GET" })
  .inputValidator((d: { establishment_id: string; q: string }) =>
    z.object({ establishment_id: z.string().uuid(), q: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    // Use plainto_tsquery for portuguese
    const { data: results, error } = await s.rpc("kb_search" as never, { _est: data.establishment_id, _q: data.q } as never) as { data: unknown; error: { message: string } | null };
    if (error) {
      // fallback: ilike
      const { data: fb } = await s.from("kb_articles")
        .select("id, slug, title, excerpt")
        .eq("establishment_id", data.establishment_id).eq("published", true)
        .or(`title.ilike.%${data.q}%,body_text.ilike.%${data.q}%`)
        .limit(10);
      return (fb ?? []) as Array<{ id: string; slug: string; title: string; excerpt: string | null }>;
    }
    return (results ?? []) as Array<{ id: string; slug: string; title: string; excerpt: string | null }>;
  });

export const getArticle = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; article_slug: string }) =>
    z.object({ slug: z.string().min(1), article_slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: est } = await s.from("establishments").select("id, slug, name, logo_url, primary_color").eq("slug", data.slug).maybeSingle();
    if (!est) return null;
    const { data: article } = await s.from("kb_articles")
      .select("id, slug, title, excerpt, body_html, views, helpful_count, not_helpful_count, tags, updated_at, category_id")
      .eq("establishment_id", est.id).eq("slug", data.article_slug).eq("published", true).maybeSingle();
    if (!article) return null;
    // increment views (best effort)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("kb_articles").update({ views: article.views + 1 }).eq("id", article.id);
    const { data: related } = await s.from("kb_articles")
      .select("id, slug, title").eq("establishment_id", est.id).eq("published", true).neq("id", article.id)
      .limit(4);
    const { sanitizeRichHtml } = await import("@/lib/sanitize-html");
    return { establishment: est, article: { ...article, body_html: sanitizeRichHtml(article.body_html) }, related: related ?? [] };
  });

export const submitArticleFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    article_id: z.string().uuid(),
    helpful: z.boolean(),
    comment: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("kb_feedback").insert({
      article_id: data.article_id, helpful: data.helpful, comment: data.comment ?? null,
    });
    const { data: a } = await supabaseAdmin.from("kb_articles").select("helpful_count, not_helpful_count").eq("id", data.article_id).single();
    if (a) await supabaseAdmin.from("kb_articles").update({
      helpful_count: (a.helpful_count ?? 0) + (data.helpful ? 1 : 0),
      not_helpful_count: (a.not_helpful_count ?? 0) + (data.helpful ? 0 : 1),
    }).eq("id", data.article_id);
    return { ok: true };
  });

// ---------- Attachments schema ----------
const attachmentSchema = z.object({
  path: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  mime: z.string().max(120),
  size: z.number().int().min(0).max(10 * 1024 * 1024),
});
type AttachmentMeta = z.infer<typeof attachmentSchema>;

// ---------- Tickets: customer side ----------
export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_slug: z.string().min(1),
    subject: z.string().trim().min(4).max(150),
    body: z.string().trim().min(4).max(5000),
    priority: z.enum(["low","normal","high","urgent"]).default("normal"),
    channel: z.enum(["form","email","chat"]).default("form"),
    name: z.string().trim().min(2).max(80).optional(),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: est } = await supabaseAdmin.from("establishments").select("id").eq("slug", data.establishment_slug).maybeSingle();
    if (!est) throw new Error("Estabelecimento não encontrado");
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRow?.user?.email ?? "";
    const { data: ticket, error } = await supabaseAdmin.from("tickets").insert({
      establishment_id: est.id,
      subject: data.subject,
      priority: data.priority,
      channel: data.channel,
      requester_user_id: context.userId,
      requester_email: email,
      requester_name: data.name ?? userRow?.user?.user_metadata?.full_name ?? null,
    }).select("id, number").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      author_type: "customer",
      author_user_id: context.userId,
      author_name: data.name ?? email,
      body: data.body,
      internal: false,
      attachments: data.attachments as unknown as never,
    });
    return ticket;
  });

export const myTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("tickets")
      .select("id, number, subject, status, priority, created_at, updated_at, establishment_id")
      .eq("requester_user_id", context.userId)
      .order("updated_at", { ascending: false }).limit(50);
    return data ?? [];
  });

export const getMyTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket } = await context.supabase.from("tickets")
      .select("*").eq("id", data.id).eq("requester_user_id", context.userId).maybeSingle();
    if (!ticket) return null;
    const { data: messages } = await context.supabase.from("ticket_messages")
      .select("id, author_type, author_name, body, internal, created_at, attachments")
      .eq("ticket_id", data.id).eq("internal", false).order("created_at");
    return { ticket, messages: messages ?? [] };
  });

export const replyToMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    body: z.string().trim().min(1).max(5000),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket } = await context.supabase.from("tickets").select("id, requester_user_id").eq("id", data.ticket_id).maybeSingle();
    if (!ticket || ticket.requester_user_id !== context.userId) throw new Error("Não autorizado");
    const { error } = await context.supabase.from("ticket_messages").insert({
      ticket_id: data.ticket_id, author_type: "customer", author_user_id: context.userId,
      body: data.body, internal: false,
      attachments: data.attachments as unknown as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    csat: z.number().int().min(1).max(5),
    comment: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("tickets").update({
      csat: data.csat, csat_comment: data.comment ?? null,
    }).eq("id", data.ticket_id).eq("requester_user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Tickets: agent side ----------
export const listTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    status: z.enum(["all","open","pending","on_hold","solved","closed"]).default("open"),
    q: z.string().max(200).optional(),
    assigned_to_me: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("tickets")
      .select("id, number, subject, status, priority, channel, tags, requester_email, requester_name, assigned_to, created_at, updated_at, due_first_response_at, first_response_at")
      .eq("establishment_id", data.establishment_id)
      .order("updated_at", { ascending: false }).limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.assigned_to_me) q = q.eq("assigned_to", context.userId);
    if (data.q) q = q.ilike("subject", `%${data.q}%`);
    const { data: tickets, error } = await q;
    if (error) throw new Error(error.message);
    return tickets ?? [];
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase.from("tickets").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) return null;
    const { data: messages } = await context.supabase.from("ticket_messages")
      .select("*").eq("ticket_id", data.id).order("created_at");
    return { ticket, messages: messages ?? [] };
  });

export const agentReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    body: z.string().trim().min(1).max(10000),
    internal: z.boolean().default(false),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ticket_messages").insert({
      ticket_id: data.ticket_id,
      author_type: "agent",
      author_user_id: context.userId,
      body: data.body,
      internal: data.internal,
      attachments: data.attachments as unknown as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    status: z.enum(["open","pending","on_hold","solved","closed"]).optional(),
    priority: z.enum(["low","normal","high","urgent"]).optional(),
    assigned_to: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().max(30)).max(10).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Partial<{ status: typeof data.status; priority: typeof data.priority; assigned_to: string | null; tags: string[]; solved_at: string }> = {};
    if (data.status !== undefined) {
      patch.status = data.status;
      if (data.status === "solved") patch.solved_at = new Date().toISOString();
    }
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    if (data.tags !== undefined) patch.tags = data.tags;
    const { error } = await context.supabase.from("tickets").update(patch as never).eq("id", data.ticket_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- KB manager ----------
export const listArticlesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: cats }, { data: arts }] = await Promise.all([
      context.supabase.from("kb_categories").select("*").eq("establishment_id", data.establishment_id).order("sort_order"),
      context.supabase.from("kb_articles").select("id, title, slug, excerpt, body_html, tags, published, views, helpful_count, not_helpful_count, category_id, updated_at").eq("establishment_id", data.establishment_id).order("updated_at", { ascending: false }),
    ]);
    // O HTML volta sanitizado também no painel (a pré-visualização renderiza cru).
    const { sanitizeRichHtml } = await import("@/lib/sanitize-html");
    const articles = (arts ?? []).map((a) => ({ ...a, body_html: sanitizeRichHtml(a.body_html) }));
    return { categories: cats ?? [], articles };
  });

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    establishment_id: z.string().uuid(),
    category_id: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(3).max(150),
    slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/, "slug inválido"),
    excerpt: z.string().max(300).optional(),
    body_html: z.string().max(50000),
    tags: z.array(z.string().max(30)).max(10).default([]),
    published: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { sanitizeRichHtml } = await import("@/lib/sanitize-html");
    const clean_html = sanitizeRichHtml(data.body_html);
    const body_text = clean_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const payload = {
      establishment_id: data.establishment_id,
      category_id: data.category_id ?? null,
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? null,
      body_html: clean_html,
      body_text,
      tags: data.tags,
      published: data.published,
      author_id: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase.from("kb_articles").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase.from("kb_articles").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kb_articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    establishment_id: z.string().uuid(),
    name: z.string().trim().min(2).max(60),
    slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/),
    description: z.string().max(200).optional(),
    icon: z.string().max(30).optional(),
    sort_order: z.number().int().default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      establishment_id: data.establishment_id, name: data.name, slug: data.slug,
      description: data.description ?? null, icon: data.icon ?? null, sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await context.supabase.from("kb_categories").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase.from("kb_categories").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

// ---------- Helpdesk dashboard ----------
export const helpdeskDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [{ data: tickets }, { data: articles }] = await Promise.all([
      context.supabase.from("tickets").select("id, status, priority, created_at, first_response_at, solved_at, csat").eq("establishment_id", data.establishment_id).gte("created_at", since),
      context.supabase.from("kb_articles").select("id, title, views, helpful_count, not_helpful_count").eq("establishment_id", data.establishment_id).eq("published", true).order("views", { ascending: false }).limit(5),
    ]);
    const t = tickets ?? [];
    const open = t.filter(x => ["open","pending","on_hold"].includes(x.status)).length;
    const solved = t.filter(x => x.status === "solved" || x.status === "closed").length;
    const responded = t.filter(x => x.first_response_at);
    const tmrMinutes = responded.length
      ? Math.round(responded.reduce((a,x) => a + (new Date(x.first_response_at!).getTime() - new Date(x.created_at).getTime()) / 60000, 0) / responded.length)
      : 0;
    const csatValues = t.map(x => x.csat).filter((v): v is number => typeof v === "number");
    const csat = csatValues.length ? Math.round((csatValues.reduce((a,b) => a+b,0) / csatValues.length) * 20) : 0;
    // by day (last 14 days)
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0,10)] = 0;
    }
    for (const x of t) {
      const k = x.created_at.slice(0,10);
      if (k in days) days[k]++;
    }
    return {
      total: t.length,
      open,
      solved,
      tmrMinutes,
      csat,
      series: Object.entries(days).map(([date, count]) => ({ date, count })),
      topArticles: articles ?? [],
    };
  });

// ---------- Ensure current user is helpdesk agent for their establishments ----------
export const ensureHelpdeskAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Owners/managers implicitly are hd agents via is_helpdesk_agent(). This is a no-op for now.
    return { ok: true, establishment_id: data.establishment_id };
  });

// ---------- Attachments: upload + signed URL ----------
const ATTACHMENT_BUCKET = "ticket-attachments";

async function assertTicketAccess(ticketId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: t } = await supabaseAdmin.from("tickets").select("id, establishment_id, requester_user_id").eq("id", ticketId).maybeSingle();
  if (!t) throw new Error("Chamado não encontrado");
  if (t.requester_user_id === userId) return t;
  const { data: agent } = await supabaseAdmin.rpc("is_helpdesk_agent", { _user: userId, _est: t.establishment_id });
  if (agent === true) return t;
  throw new Error("Sem acesso a este chamado");
}

export const uploadTicketAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    name: z.string().min(1).max(200),
    mime: z.string().max(120),
    base64: z.string().min(1).max(15_000_000), // ~10MB binary after decoding
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertTicketAccess(data.ticket_id, context.userId);
    const buf = Buffer.from(data.base64, "base64");
    if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Arquivo excede 10MB");
    const safeName = data.name.replace(/[^\w.\-]+/g, "_").slice(-100);
    const path = `${data.ticket_id}/${crypto.randomUUID()}-${safeName}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).upload(path, buf, {
      contentType: data.mime || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path, name: data.name, mime: data.mime, size: buf.byteLength };
  });

// Used before creating a ticket (no ticket_id yet): scoped to authenticated user's temp folder.
export const uploadDraftAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    name: z.string().min(1).max(200),
    mime: z.string().max(120),
    base64: z.string().min(1).max(15_000_000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const buf = Buffer.from(data.base64, "base64");
    if (buf.byteLength > 10 * 1024 * 1024) throw new Error("Arquivo excede 10MB");
    const safeName = data.name.replace(/[^\w.\-]+/g, "_").slice(-100);
    const path = `_drafts/${context.userId}/${crypto.randomUUID()}-${safeName}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).upload(path, buf, {
      contentType: data.mime || "application/octet-stream", upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path, name: data.name, mime: data.mime, size: buf.byteLength };
  });

export const getAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    // Path format: {ticket_id}/{uuid}-name  or  _drafts/{userId}/{uuid}-name
    const seg = data.path.split("/")[0];
    if (seg === "_drafts") {
      const userSeg = data.path.split("/")[1];
      if (userSeg !== context.userId) throw new Error("Sem acesso");
    } else {
      await assertTicketAccess(seg, context.userId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ---------- Quick replies (agent macros) ----------
export const listQuickReplies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("ticket_quick_replies")
      .select("id, title, body, shortcut, created_at").eq("establishment_id", data.establishment_id)
      .order("title");
    return rows ?? [];
  });

export const saveQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    establishment_id: z.string().uuid(),
    title: z.string().trim().min(2).max(80),
    body: z.string().trim().min(1).max(4000),
    shortcut: z.string().trim().max(20).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      establishment_id: data.establishment_id,
      title: data.title,
      body: data.body,
      shortcut: data.shortcut ?? "",
    };
    if (data.id) {
      const { error } = await context.supabase.from("ticket_quick_replies").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase.from("ticket_quick_replies").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ticket_quick_replies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ---------- Importar artigos da Central de Ajuda Fidelize ----------
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  const out: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (list) { out.push(`<ul>${list.map((i) => `<li>${i}</li>`).join("")}</ul>`); list = null; }
  };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) { flush(); const lvl = Math.min(h[1].length, 4); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    const li = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (li) { (list ??= []).push(inline(li[1])); continue; }
    flush();
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("");
}

export const importFidelizeArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: member } = await context.supabase
      .from("establishment_members")
      .select("role")
      .eq("establishment_id", data.establishment_id)
      .eq("user_id", context.userId)
      .eq("active", true)
      .maybeSingle();
    if (!member || !["owner", "manager"].includes(member.role)) throw new Error("Sem permissão");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: srcCats }, { data: srcArts }, { data: curCats }, { data: curArts }] = await Promise.all([
      supabaseAdmin.from("help_categories").select("id, slug, name, description, icon, sort_order").eq("active", true).order("sort_order"),
      supabaseAdmin.from("help_articles").select("id, category_id, slug, title, excerpt, content, keywords, sort_order").eq("published", true).order("sort_order"),
      supabaseAdmin.from("kb_categories").select("id, slug").eq("establishment_id", data.establishment_id),
      supabaseAdmin.from("kb_articles").select("slug").eq("establishment_id", data.establishment_id),
    ]);

    const catBySlug = new Map((curCats ?? []).map((c) => [c.slug, c.id]));
    const missing = (srcCats ?? []).filter((c) => !catBySlug.has(c.slug));
    if (missing.length) {
      const { data: inserted, error } = await supabaseAdmin
        .from("kb_categories")
        .insert(missing.map((c) => ({
          establishment_id: data.establishment_id,
          name: c.name, slug: c.slug, description: c.description ?? null,
          icon: c.icon ?? null, sort_order: c.sort_order ?? 0,
        })))
        .select("id, slug");
      if (error) throw new Error(error.message);
      (inserted ?? []).forEach((c) => catBySlug.set(c.slug, c.id));
    }
    const srcCatSlug = new Map((srcCats ?? []).map((c) => [c.id, c.slug]));

    const existing = new Set((curArts ?? []).map((a) => a.slug));
    const rows = (srcArts ?? [])
      .filter((a) => !existing.has(a.slug))
      .map((a) => {
        const body_html = mdToHtml(a.content ?? "");
        return {
          establishment_id: data.establishment_id,
          category_id: catBySlug.get(srcCatSlug.get(a.category_id) ?? "") ?? null,
          title: a.title,
          slug: a.slug,
          excerpt: a.excerpt ?? null,
          body_html,
          body_text: body_html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
          tags: a.keywords ? String(a.keywords).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10) : [],
          published: true,
          author_id: context.userId,
        };
      });

    if (rows.length) {
      const { error } = await supabaseAdmin.from("kb_articles").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { imported: rows.length, categories: missing.length };
  });
