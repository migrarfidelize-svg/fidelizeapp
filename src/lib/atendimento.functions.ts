import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertActiveSubscription } from "@/lib/subscription-guard";

/**
 * Central de Atendimento (CRM + WhatsApp) — funções do lojista.
 * Todo acesso é validado por `has_establishment_access` (RLS) + `member_can`.
 */

const estSchema = z.object({ establishment_id: z.string().uuid() });

async function assertMemberCan(supabase: any, userId: string, est: string, action: string) {
  const { data, error } = await supabase.rpc("member_can", { _user: userId, _est: est, _action: action });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Você não tem permissão para usar a Central de Atendimento.");
}

async function logEvent(supabase: any, row: Record<string, unknown>) {
  try { await supabase.from("conversation_events").insert(row); } catch { /* best-effort */ }
}

/* -------------------- Conexão do WhatsApp -------------------- */

export const getWhatsAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const { data: row, error } = await (context.supabase as any)
      .from("whatsapp_connections")
      .select("id, provider, connected_phone, connection_status, qr_status, qr_expires_at, connected_at, last_error, suspended, last_activity_at")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prov } = await (supabaseAdmin as any)
      .from("whatsapp_providers").select("provider, is_enabled").eq("is_enabled", true).limit(1).maybeSingle();

    return { connection: row ?? null, providerAvailable: Boolean(prov) };
  });

/** Cria (se preciso) a instância e devolve o QR para parear o número. */
export const startWhatsAppPairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertActiveSubscription(context.supabase, data.establishment_id);
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadProviderRuntime, loadInstanceRef } = await import("@/lib/whatsapp/registry.server");
    const { encryptSecret, newWebhookToken } = await import("@/lib/whatsapp/crypto.server");
    const { getPublicAppUrl } = await import("@/lib/app-url");

    const { runtime, provider, row: providerRow } = await loadProviderRuntime();

    let { data: conn } = await (supabaseAdmin as any)
      .from("whatsapp_connections").select("*").eq("establishment_id", data.establishment_id).maybeSingle();

    if (conn?.suspended) throw new Error("Conexão suspensa pelo administrador da plataforma.");

    let webhookToken: string;

    if (!conn) {
      const ref = await provider.createInstance(runtime, `fidelize-${data.establishment_id.slice(0, 8)}`);
      const { data: created, error: cErr } = await (supabaseAdmin as any)
        .from("whatsapp_connections")
        .insert({
          establishment_id: data.establishment_id,
          provider: providerRow.provider,
          external_instance_id: ref.externalInstanceId,
          connection_status: "connecting",
        })
        .select("*").single();
      if (cErr) throw new Error(cErr.message);
      conn = created;
      webhookToken = newWebhookToken();
      const { error: sErr } = await (supabaseAdmin as any).from("whatsapp_connection_secrets").insert({
        connection_id: conn.id,
        encrypted_instance_token: await encryptSecret(ref.instanceToken),
        webhook_token: webhookToken,
      });
      if (sErr) throw new Error(sErr.message);
    } else {
      const { data: sec } = await (supabaseAdmin as any)
        .from("whatsapp_connection_secrets").select("webhook_token").eq("connection_id", conn.id).maybeSingle();
      webhookToken = sec?.webhook_token ?? newWebhookToken();
    }

    const ref = await loadInstanceRef(conn);

    // Garante que o provedor entrega os eventos nesta conexão.
    try {
      await provider.setWebhook(runtime, ref, `${getPublicAppUrl()}/api/public/whatsapp/webhook/${webhookToken}`);
    } catch (e: any) {
      await (supabaseAdmin as any).from("whatsapp_connections")
        .update({ last_error: String(e?.message ?? e).slice(0, 400) }).eq("id", conn.id);
    }

    const state = await provider.connect(runtime, ref);

    await (supabaseAdmin as any).from("whatsapp_connections").update({
      connection_status: state.status,
      qr_status: state.qrCode ? "ready" : null,
      qr_expires_at: state.qrCode ? new Date(Date.now() + 60_000).toISOString() : null,
      connected_phone: state.connectedPhone ?? conn.connected_phone,
      connected_at: state.status === "connected" ? new Date().toISOString() : conn.connected_at,
      last_checked_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", conn.id);

    return { status: state.status, qrCode: state.qrCode ?? null };
  });

export const refreshWhatsAppStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadProviderRuntime, loadInstanceRef } = await import("@/lib/whatsapp/registry.server");

    const { data: conn } = await (supabaseAdmin as any)
      .from("whatsapp_connections").select("*").eq("establishment_id", data.establishment_id).maybeSingle();
    if (!conn) return { status: "disconnected" as const, connectedPhone: null };

    const { runtime, provider } = await loadProviderRuntime(conn.provider);
    const state = await provider.getState(runtime, await loadInstanceRef(conn));

    await (supabaseAdmin as any).from("whatsapp_connections").update({
      connection_status: state.status,
      connected_phone: state.connectedPhone ?? conn.connected_phone,
      connected_at: state.status === "connected" ? (conn.connected_at ?? new Date().toISOString()) : conn.connected_at,
      last_checked_at: new Date().toISOString(),
    }).eq("id", conn.id);

    return { status: state.status, connectedPhone: state.connectedPhone ?? conn.connected_phone };
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadProviderRuntime, loadInstanceRef } = await import("@/lib/whatsapp/registry.server");

    const { data: conn } = await (supabaseAdmin as any)
      .from("whatsapp_connections").select("*").eq("establishment_id", data.establishment_id).maybeSingle();
    if (!conn) return { ok: true };

    try {
      const { runtime, provider } = await loadProviderRuntime(conn.provider);
      await provider.disconnect(runtime, await loadInstanceRef(conn));
    } catch { /* mesmo com falha remota, marcamos localmente */ }

    await (supabaseAdmin as any).from("whatsapp_connections").update({
      connection_status: "disconnected",
      disconnected_at: new Date().toISOString(),
      qr_status: null,
      updated_at: new Date().toISOString(),
    }).eq("id", conn.id);

    return { ok: true };
  });

/* -------------------- Conversas -------------------- */

const listSchema = estSchema.extend({
  status: z.enum(["all", "queued", "in_progress", "waiting", "resolved"]).default("all"),
  search: z.string().max(80).optional(),
  mine: z.boolean().optional(),
});

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    let q = (context.supabase as any)
      .from("conversations")
      .select("id, contact_name, contact_phone, status, priority, assigned_to, unread_count, last_message_at, last_message_preview, tags, customer_id, channel")
      .eq("establishment_id", data.establishment_id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);

    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.mine) q = q.eq("assigned_to", context.userId);
    if (data.search?.trim()) {
      const s = data.search.trim().replace(/[%,]/g, "");
      q = q.or(`contact_name.ilike.%${s}%,contact_phone.ilike.%${s}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.extend({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");

    const { data: conv, error } = await (context.supabase as any)
      .from("conversations").select("*")
      .eq("id", data.conversation_id).eq("establishment_id", data.establishment_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Conversa não encontrada.");

    const { data: messages } = await (context.supabase as any)
      .from("conversation_messages")
      .select("id, direction, sender_type, sender_user_id, message_type, body, media_url, status, error_message, sent_at, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true })
      .limit(300);

    const { data: events } = await (context.supabase as any)
      .from("conversation_events")
      .select("id, event_type, title, description, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: false })
      .limit(50);

    let customer: any = null;
    if (conv.customer_id) {
      const { data: c } = await (context.supabase as any)
        .from("customers").select("id, name, phone, email, tier, visits_count, last_visit_at")
        .eq("id", conv.customer_id).maybeSingle();
      customer = c ?? null;
    }

    // Ler a conversa zera o não lido do time.
    if ((conv.unread_count ?? 0) > 0) {
      await (context.supabase as any).from("conversations")
        .update({ unread_count: 0 }).eq("id", conv.id);
    }

    return { conversation: conv, messages: messages ?? [], events: events ?? [], customer };
  });

export const sendConversationMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    estSchema.extend({
      conversation_id: z.string().uuid(),
      body: z.string().trim().min(1, "Mensagem vazia.").max(4000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertActiveSubscription(context.supabase, data.establishment_id);
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");

    const { data: conv, error } = await (context.supabase as any)
      .from("conversations").select("*")
      .eq("id", data.conversation_id).eq("establishment_id", data.establishment_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Conversa não encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadProviderRuntime, loadInstanceRef } = await import("@/lib/whatsapp/registry.server");

    const { data: msg, error: mErr } = await (context.supabase as any)
      .from("conversation_messages")
      .insert({
        conversation_id: conv.id,
        establishment_id: data.establishment_id,
        direction: "outbound",
        sender_type: "agent",
        sender_user_id: context.userId,
        message_type: "text",
        body: data.body,
        status: "queued",
      })
      .select("*").single();
    if (mErr) throw new Error(mErr.message);

    let status = "sent";
    let errorMessage: string | null = null;
    let externalId: string | null = null;

    try {
      const { data: conn } = await (supabaseAdmin as any)
        .from("whatsapp_connections").select("*").eq("establishment_id", data.establishment_id).maybeSingle();
      if (!conn) throw new Error("WhatsApp não conectado.");
      if (conn.suspended) throw new Error("Conexão suspensa pelo administrador.");
      const { runtime, provider } = await loadProviderRuntime(conn.provider);
      const res = await provider.sendText(runtime, await loadInstanceRef(conn), {
        to: conv.contact_phone, text: data.body,
      });
      externalId = res.externalMessageId;
      await (supabaseAdmin as any).from("whatsapp_connections")
        .update({ last_activity_at: new Date().toISOString() }).eq("id", conn.id);
    } catch (e: any) {
      status = "failed";
      errorMessage = String(e?.message ?? e).slice(0, 400);
    }

    await (supabaseAdmin as any).from("conversation_messages").update({
      status,
      error_message: errorMessage,
      external_message_id: externalId,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", msg.id);

    await (context.supabase as any).from("conversations").update({
      last_message_at: new Date().toISOString(),
      last_outbound_at: new Date().toISOString(),
      last_message_preview: data.body.slice(0, 160),
      status: conv.status === "queued" ? "in_progress" : conv.status,
      assigned_to: conv.assigned_to ?? context.userId,
      updated_at: new Date().toISOString(),
    }).eq("id", conv.id);

    if (status === "failed") throw new Error(`Não foi possível enviar: ${errorMessage}`);
    return { ok: true, message_id: msg.id };
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    estSchema.extend({
      conversation_id: z.string().uuid(),
      status: z.enum(["queued", "in_progress", "waiting", "resolved"]).optional(),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
      assign_to_me: z.boolean().optional(),
      unassign: z.boolean().optional(),
      tags: z.array(z.string().max(30)).max(12).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status) {
      patch["status"] = data.status;
      if (data.status === "resolved") patch["finished_at"] = new Date().toISOString();
    }
    if (data.priority) patch["priority"] = data.priority;
    if (data.tags) patch["tags"] = data.tags;
    if (data.assign_to_me) patch["assigned_to"] = context.userId;
    if (data.unassign) patch["assigned_to"] = null;

    const { error } = await (context.supabase as any)
      .from("conversations").update(patch)
      .eq("id", data.conversation_id).eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);

    if (data.assign_to_me || data.unassign) {
      await (context.supabase as any).from("conversation_assignments").insert({
        conversation_id: data.conversation_id,
        establishment_id: data.establishment_id,
        assigned_to: data.assign_to_me ? context.userId : null,
        assigned_by: context.userId,
        reason: data.assign_to_me ? "self_assign" : "release",
      });
    }

    await logEvent(context.supabase, {
      conversation_id: data.conversation_id,
      establishment_id: data.establishment_id,
      event_type: "updated",
      title: data.status ? `Status: ${data.status}` : "Conversa atualizada",
      actor_user_id: context.userId,
      payload: { ...data },
    });

    return { ok: true };
  });

/* -------------------- Novo atendimento manual -------------------- */

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    estSchema.extend({
      phone: z.string().min(8).max(20),
      name: z.string().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertActiveSubscription(context.supabase, data.establishment_id);
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const { normalizePhone } = await import("@/lib/whatsapp/types");
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Telefone inválido.");

    const { data: existing } = await (context.supabase as any)
      .from("conversations").select("id")
      .eq("establishment_id", data.establishment_id).eq("contact_phone", phone).maybeSingle();
    if (existing) return { conversation_id: existing.id, created: false };

    const { data: customer } = await (context.supabase as any)
      .from("customers").select("id, name")
      .eq("establishment_id", data.establishment_id).eq("phone", phone).maybeSingle();

    const { data: conv, error } = await (context.supabase as any)
      .from("conversations")
      .insert({
        establishment_id: data.establishment_id,
        contact_phone: phone,
        contact_name: data.name || customer?.name || phone,
        customer_id: customer?.id ?? null,
        channel: "whatsapp",
        status: "in_progress",
        assigned_to: context.userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    await logEvent(context.supabase, {
      conversation_id: conv.id,
      establishment_id: data.establishment_id,
      event_type: "created",
      title: "Atendimento iniciado pelo time",
      actor_user_id: context.userId,
      payload: {},
    });

    return { conversation_id: conv.id, created: true };
  });

/* -------------------- Respostas rápidas -------------------- */

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const { data: rows } = await (context.supabase as any)
      .from("conversation_templates")
      .select("id, title, body, shortcut, is_active")
      .eq("establishment_id", data.establishment_id)
      .eq("is_active", true)
      .order("title");
    return rows ?? [];
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    estSchema.extend({
      id: z.string().uuid().optional(),
      title: z.string().trim().min(2).max(80),
      body: z.string().trim().min(2).max(2000),
      shortcut: z.string().trim().max(30).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const row = {
      establishment_id: data.establishment_id,
      title: data.title,
      body: data.body,
      shortcut: data.shortcut || null,
      is_active: true,
      ...(data.id ? { id: data.id } : {}),
    };
    const { error } = await (context.supabase as any).from("conversation_templates").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const { error } = await (context.supabase as any)
      .from("conversation_templates").delete()
      .eq("id", data.id).eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- Métricas -------------------- */

export const getInboxStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertMemberCan(context.supabase, context.userId, data.establishment_id, "inbox.use");
    const base = () => (context.supabase as any)
      .from("conversations").select("id", { count: "exact", head: true })
      .eq("establishment_id", data.establishment_id);

    const [queued, inProgress, waiting, resolved] = await Promise.all([
      base().eq("status", "queued"),
      base().eq("status", "in_progress"),
      base().eq("status", "waiting"),
      base().eq("status", "resolved"),
    ]);

    return {
      queued: queued.count ?? 0,
      in_progress: inProgress.count ?? 0,
      waiting: waiting.count ?? 0,
      resolved: resolved.count ?? 0,
    };
  });
