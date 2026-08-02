import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook público do provedor de WhatsApp.
 * A URL carrega um token opaco por conexão — é o segredo compartilhado que
 * autentica o provedor. Eventos duplicados são descartados por `dedupe_key`.
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = String(params.token ?? "");
        if (token.length < 16) return new Response("invalid token", { status: 401 });

        const raw = await request.text();
        let payload: any = null;
        try { payload = raw ? JSON.parse(raw) : null; } catch { payload = null; }
        if (!payload) return new Response("invalid body", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: secret } = await (supabaseAdmin as any)
          .from("whatsapp_connection_secrets")
          .select("connection_id")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!secret) return new Response("unknown connection", { status: 401 });

        const { data: conn } = await (supabaseAdmin as any)
          .from("whatsapp_connections")
          .select("*")
          .eq("id", secret.connection_id)
          .maybeSingle();
        if (!conn) return new Response("unknown connection", { status: 401 });
        if (conn.suspended) return new Response("suspended", { status: 202 });

        const { getWhatsAppProvider } = await import("@/lib/whatsapp/registry.server");
        const provider = getWhatsAppProvider(conn.provider);
        const msg = provider.parseWebhook(payload);

        const dedupeKey = `${conn.id}:${msg?.externalMessageId ?? ""}:${msg?.eventType ?? "event"}`;
        const { error: dupErr } = await (supabaseAdmin as any)
          .from("whatsapp_webhook_events")
          .insert({
            provider: conn.provider,
            external_instance_id: conn.external_instance_id,
            establishment_id: conn.establishment_id,
            event_type: msg?.eventType ?? "unknown",
            dedupe_key: dedupeKey,
            payload,
          });
        // Violação de unicidade = evento repetido; responder 200 e sair.
        if (dupErr && String(dupErr.code) === "23505") {
          return Response.json({ ok: true, deduped: true });
        }

        await (supabaseAdmin as any).from("whatsapp_connections").update({
          last_activity_at: new Date().toISOString(),
        }).eq("id", conn.id);

        // Eventos de conexão apenas atualizam o status.
        if (!msg || !msg.fromPhone || msg.fromMe || !msg.body) {
          const status = String(payload?.status ?? payload?.instance?.status ?? "").toLowerCase();
          if (status) {
            await (supabaseAdmin as any).from("whatsapp_connections").update({
              connection_status: ["connected", "open"].includes(status) ? "connected" : conn.connection_status,
              last_checked_at: new Date().toISOString(),
            }).eq("id", conn.id);
          }
          return Response.json({ ok: true, ignored: true });
        }

        const nowIso = new Date().toISOString();

        // Conversa existente ou nova, sempre no tenant correto.
        let { data: conv } = await (supabaseAdmin as any)
          .from("conversations").select("*")
          .eq("establishment_id", conn.establishment_id)
          .eq("contact_phone", msg.fromPhone)
          .maybeSingle();

        if (!conv) {
          const { data: customer } = await (supabaseAdmin as any)
            .from("customers").select("id, name")
            .eq("establishment_id", conn.establishment_id)
            .eq("phone", msg.fromPhone)
            .maybeSingle();

          const { data: created, error: cErr } = await (supabaseAdmin as any)
            .from("conversations")
            .insert({
              establishment_id: conn.establishment_id,
              connection_id: conn.id,
              customer_id: customer?.id ?? null,
              channel: "whatsapp",
              contact_phone: msg.fromPhone,
              contact_name: msg.contactName || customer?.name || msg.fromPhone,
              external_chat_id: msg.chatId,
              status: "queued",
              unread_count: 0,
            })
            .select("*").single();
          if (cErr) return new Response(cErr.message, { status: 500 });
          conv = created;
        }

        await (supabaseAdmin as any).from("conversation_messages").insert({
          conversation_id: conv.id,
          establishment_id: conn.establishment_id,
          direction: "inbound",
          sender_type: "customer",
          message_type: msg.messageType,
          body: msg.body,
          media_url: msg.mediaUrl,
          external_message_id: msg.externalMessageId,
          status: "received",
          sent_at: nowIso,
        });

        await (supabaseAdmin as any).from("conversations").update({
          connection_id: conn.id,
          contact_name: conv.contact_name || msg.contactName || msg.fromPhone,
          external_chat_id: conv.external_chat_id ?? msg.chatId,
          last_message_at: nowIso,
          last_inbound_at: nowIso,
          last_message_preview: msg.body.slice(0, 160),
          unread_count: (conv.unread_count ?? 0) + 1,
          status: conv.status === "resolved" ? "queued" : conv.status,
          reopened_at: conv.status === "resolved" ? nowIso : conv.reopened_at,
          updated_at: nowIso,
        }).eq("id", conv.id);

        await (supabaseAdmin as any).from("whatsapp_webhook_events")
          .update({ processed_at: nowIso })
          .eq("dedupe_key", dedupeKey);

        return Response.json({ ok: true });
      },
    },
  },
});
