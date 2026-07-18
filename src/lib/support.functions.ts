import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOrEnqueue } from "@/lib/email.server";

const CATEGORIES = ["duvidas","tecnico","carimbos","clientes","qrcode","campanhas","pagamentos","conta","sugestao","outro"] as const;
const CUSTOMER_PRIORITIES = ["low","normal","high"] as const;
const ALL_PRIORITIES = ["low","normal","high","urgent"] as const;
const ALL_STATUS = ["open","in_progress","waiting_customer","answered","resolved","closed"] as const;

const attachmentSchema = z.object({
  path: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  mime: z.string().max(120),
  size: z.number().int().min(0).max(10 * 1024 * 1024),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Não autorizado");
}

function getBaseUrl() {
  return process.env.VITE_APP_URL || "https://project--6fbe0482-baab-4f96-abc8-c1c72bc2e46e.lovable.app";
}

async function notify(to: string, subject: string, html: string, ticketId: string) {
  try {
    await sendOrEnqueue({ to, subject, html, template: "support_notification", variables: { ticket_id: ticketId } });
  } catch (e) {
    console.error("[support:notify]", e);
  }
}

// ============ CLIENTE (empresa) ============

export const createSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    subject: z.string().trim().min(4).max(150),
    category: z.enum(CATEGORIES),
    priority: z.enum(CUSTOMER_PRIORITIES).default("normal"),
    body: z.string().trim().min(4).max(5000),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRow } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userRow?.user?.email ?? "";
    const fullName = (userRow?.user?.user_metadata?.full_name as string) ?? null;

    const { data: est } = await supabaseAdmin
      .from("establishment_members")
      .select("establishment_id, establishments!inner(name)")
      .eq("user_id", context.userId).eq("active", true).limit(1).maybeSingle();

    const { data: ticket, error } = await context.supabase.from("support_tickets").insert({
      subject: data.subject,
      category: data.category,
      priority: data.priority,
      requester_user_id: context.userId,
      requester_name: fullName,
      requester_email: email,
      establishment_id: est?.establishment_id ?? null,
    }).select("id, protocol").single();
    if (error) throw new Error(error.message);

    await context.supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_type: "customer",
      sender_user_id: context.userId,
      sender_name: fullName ?? email,
      message: data.body,
      attachments: data.attachments as never,
    });

    // notificação para o cliente (confirmação)
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px">
        <h2>Ticket ${ticket.protocol} aberto</h2>
        <p>Olá${fullName ? ` ${fullName}` : ""}, recebemos seu chamado <strong>"${data.subject}"</strong>.</p>
        <p>Nossa equipe responderá em breve pelo painel de suporte. Acompanhe em:
          <br><a href="${getBaseUrl()}/suporte/${ticket.id}">${getBaseUrl()}/suporte/${ticket.id}</a>
        </p>
      </div>`;
    await notify(email, `Ticket ${ticket.protocol} aberto — ${data.subject}`, html, ticket.id);

    return ticket;
  });

export const listMySupportTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("support_tickets")
      .select("id, protocol, subject, category, priority, status, has_unread_customer, created_at, updated_at")
      .eq("requester_user_id", context.userId)
      .order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMySupportTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket } = await context.supabase.from("support_tickets")
      .select("id, protocol, subject, category, priority, status, created_at, updated_at, first_response_at, resolved_at, closed_at")
      .eq("id", data.id).eq("requester_user_id", context.userId).maybeSingle();
    if (!ticket) return null;

    const { data: messages } = await context.supabase.from("support_messages")
      .select("id, sender_type, sender_name, message, attachments, created_at")
      .eq("ticket_id", data.id).eq("is_internal", false).order("created_at");

    // marcar como lido pelo cliente
    await context.supabase.from("support_tickets")
      .update({ has_unread_customer: false }).eq("id", data.id);

    return { ticket, messages: messages ?? [] };
  });

export const replyMySupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    message: z.string().trim().min(1).max(5000),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ticket } = await context.supabase.from("support_tickets")
      .select("id, protocol, subject, status, requester_user_id, requester_name")
      .eq("id", data.ticket_id).maybeSingle();
    if (!ticket || ticket.requester_user_id !== context.userId) throw new Error("Não autorizado");
    if (ticket.status === "closed") throw new Error("Ticket fechado");

    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticket_id,
      sender_type: "customer",
      sender_user_id: context.userId,
      sender_name: ticket.requester_name ?? undefined,
      message: data.message,
      attachments: data.attachments as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ADMIN (super_admin) ============

export const adminListSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    status: z.enum([...ALL_STATUS, "all", "unanswered", "overdue"]).default("all"),
    priority: z.enum([...ALL_PRIORITIES, "all"]).default("all"),
    category: z.enum([...CATEGORIES, "all"]).default("all"),
    assigned: z.enum(["all","me","unassigned"]).default("all"),
    establishment_id: z.string().uuid().nullable().optional(),
    q: z.string().max(200).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    let q = context.supabase.from("support_tickets")
      .select("id, protocol, subject, category, priority, status, requester_email, requester_name, assigned_admin_id, establishment_id, has_unread_admin, created_at, updated_at, first_response_at")
      .order("has_unread_admin", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(500);

    if (data.status === "unanswered") q = q.is("first_response_at", null);
    else if (data.status === "overdue") q = q.in("status", ["open","in_progress"]).lt("created_at", new Date(Date.now() - 24*3600*1000).toISOString());
    else if (data.status !== "all") q = q.eq("status", data.status);

    if (data.priority !== "all") q = q.eq("priority", data.priority);
    if (data.category !== "all") q = q.eq("category", data.category);
    if (data.assigned === "me") q = q.eq("assigned_admin_id", context.userId);
    else if (data.assigned === "unassigned") q = q.is("assigned_admin_id", null);
    if (data.establishment_id) q = q.eq("establishment_id", data.establishment_id);
    if (data.q) q = q.or(`subject.ilike.%${data.q}%,protocol.ilike.%${data.q}%,requester_email.ilike.%${data.q}%`);

    const { data: tickets, error } = await q;
    if (error) throw new Error(error.message);

    const estIds = Array.from(new Set((tickets ?? []).map(t => t.establishment_id).filter(Boolean))) as string[];
    let estMap = new Map<string, string>();
    if (estIds.length) {
      const { data: ests } = await context.supabase.from("establishments").select("id, name").in("id", estIds);
      estMap = new Map((ests ?? []).map(e => [e.id as string, e.name as string]));
    }
    return (tickets ?? []).map(t => ({ ...t, establishment_name: t.establishment_id ? estMap.get(t.establishment_id) ?? null : null }));
  });

export const adminGetSupportTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { data: ticket } = await context.supabase.from("support_tickets").select("*").eq("id", data.id).maybeSingle();
    if (!ticket) return null;
    const [{ data: messages }, { data: history }, est] = await Promise.all([
      context.supabase.from("support_messages")
        .select("id, sender_type, sender_user_id, sender_name, message, is_internal, attachments, created_at")
        .eq("ticket_id", data.id).order("created_at"),
      context.supabase.from("support_status_history")
        .select("id, from_status, to_status, changed_by, reason, created_at")
        .eq("ticket_id", data.id).order("created_at"),
      ticket.establishment_id
        ? context.supabase.from("establishments").select("id, name, slug").eq("id", ticket.establishment_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    // marcar como lido pelo admin
    await context.supabase.from("support_tickets").update({ has_unread_admin: false }).eq("id", data.id);
    return { ticket, messages: messages ?? [], history: history ?? [], establishment: est?.data ?? null };
  });

export const adminReplySupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    message: z.string().trim().min(1).max(10000),
    internal: z.boolean().default(false),
    attachments: z.array(attachmentSchema).max(5).default([]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { data: userRow } = await context.supabase.auth.getUser();
    const name = (userRow?.user?.user_metadata?.full_name as string) ?? "Equipe Fidelize";

    const { error } = await context.supabase.from("support_messages").insert({
      ticket_id: data.ticket_id,
      sender_type: data.internal ? "admin" : "admin",
      sender_user_id: context.userId,
      sender_name: name,
      message: data.message,
      is_internal: data.internal,
      attachments: data.attachments as never,
    });
    if (error) throw new Error(error.message);

    // auto-assign se ainda sem atendente
    await context.supabase.from("support_tickets")
      .update({ assigned_admin_id: context.userId })
      .eq("id", data.ticket_id).is("assigned_admin_id", null);

    if (!data.internal) {
      const { data: t } = await context.supabase.from("support_tickets")
        .select("protocol, subject, requester_email, requester_name, id")
        .eq("id", data.ticket_id).maybeSingle();
      if (t?.requester_email) {
        const html = `
          <div style="font-family:system-ui,sans-serif;max-width:560px">
            <h2>Nova resposta no ticket ${t.protocol}</h2>
            <p>Olá${t.requester_name ? ` ${t.requester_name}` : ""}, a equipe respondeu ao seu chamado <strong>"${t.subject}"</strong>.</p>
            <div style="background:#f5f5f5;padding:12px;border-radius:8px;white-space:pre-wrap">${data.message.slice(0, 500)}${data.message.length > 500 ? "…" : ""}</div>
            <p style="margin-top:12px">Ver conversa: <a href="${getBaseUrl()}/suporte/${t.id}">${getBaseUrl()}/suporte/${t.id}</a></p>
          </div>`;
        await notify(t.requester_email, `Resposta — ${t.protocol} ${t.subject}`, html, t.id);
      }
    }
    return { ok: true };
  });

export const adminUpdateSupportTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    ticket_id: z.string().uuid(),
    status: z.enum(ALL_STATUS).optional(),
    priority: z.enum(ALL_PRIORITIES).optional(),
    assigned_admin_id: z.string().uuid().nullable().optional(),
    category: z.enum(CATEGORIES).optional(),
    reason: z.string().max(300).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const patch: Partial<{ status: typeof data.status; priority: typeof data.priority; assigned_admin_id: string | null; category: typeof data.category }> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.assigned_admin_id !== undefined) patch.assigned_admin_id = data.assigned_admin_id;
    if (data.category !== undefined) patch.category = data.category;
    const { error } = await context.supabase.from("support_tickets").update(patch as never).eq("id", data.ticket_id);
    if (error) throw new Error(error.message);

    // se resolveu ou fechou, notificar cliente
    if (data.status === "resolved" || data.status === "closed") {
      const { data: t } = await context.supabase.from("support_tickets")
        .select("protocol, subject, requester_email, requester_name, id")
        .eq("id", data.ticket_id).maybeSingle();
      if (t?.requester_email) {
        const label = data.status === "resolved" ? "resolvido" : "fechado";
        const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
          <h2>Ticket ${t.protocol} ${label}</h2>
          <p>Seu chamado <strong>"${t.subject}"</strong> foi marcado como ${label} pela equipe de suporte.</p>
          <p><a href="${getBaseUrl()}/suporte/${t.id}">Ver detalhes</a></p></div>`;
        await notify(t.requester_email, `Ticket ${t.protocol} ${label}`, html, t.id);
      }
    }
    return { ok: true };
  });

export const adminSupportDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const today = new Date(); today.setHours(0,0,0,0);
    const { data: all } = await context.supabase.from("support_tickets")
      .select("status, priority, first_response_at, resolved_at, created_at, updated_at");
    const rows = all ?? [];
    const respondedToday = rows.filter(r => r.first_response_at && new Date(r.first_response_at) >= today).length;
    const firstResponseMinutes = rows.filter(r => r.first_response_at).map(r =>
      (new Date(r.first_response_at!).getTime() - new Date(r.created_at).getTime()) / 60000
    );
    const resolutionMinutes = rows.filter(r => r.resolved_at).map(r =>
      (new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime()) / 60000
    );
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b)=>a+b,0) / arr.length) : 0;
    const now = Date.now();
    const overdue = rows.filter(r => ["open","in_progress"].includes(r.status as string) && (now - new Date(r.created_at).getTime()) > 24*3600*1000).length;
    return {
      open: rows.filter(r => r.status === "open").length,
      in_progress: rows.filter(r => r.status === "in_progress").length,
      waiting_customer: rows.filter(r => r.status === "waiting_customer").length,
      responded_today: respondedToday,
      resolved: rows.filter(r => r.status === "resolved").length,
      avg_first_response_min: avg(firstResponseMinutes),
      avg_resolution_min: avg(resolutionMinutes),
      overdue,
      total: rows.length,
    };
  });

// ============ Quick replies (admin) ============
export const listSupportQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { data } = await context.supabase.from("support_quick_replies")
      .select("id, shortcut, title, body, updated_at").order("shortcut");
    return data ?? [];
  });

export const saveSupportQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    shortcut: z.string().trim().min(2).max(30),
    title: z.string().trim().min(2).max(100),
    body: z.string().trim().min(2).max(5000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const payload = { shortcut: data.shortcut, title: data.title, body: data.body, created_by: context.userId };
    if (data.id) {
      const { error } = await context.supabase.from("support_quick_replies").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: r, error } = await context.supabase.from("support_quick_replies").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: r.id };
  });

export const deleteSupportQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("support_quick_replies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
