import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook unificado para recebimento de mensagens de WhatsApp.
 * Suporta: UAZAPI, Evolution API, Z-API e Custom via Strategy.
 * Rota: /api/public/webhooks/whatsapp
 */

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      GET: async () => new Response("WhatsApp Webhook Active", { status: 200 }),
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { getActiveWhatsAppProvider } = await import("@/lib/otp.functions");
        
        const rawBody = await request.text();
        const headers = Object.fromEntries(request.headers.entries());
        
        // 1. Identificar Provedor Ativo
        const active = await getActiveWhatsAppProvider();
        if (!active) {
          console.error("[Webhook] No active WhatsApp provider found.");
          return new Response("No active WhatsApp provider", { status: 404 });
        }

        const providerId = active.provider.meta.id;
        const config = active.runtime.config;
        
        // 2. Validar Segurança (Token/Secret)
        const webhookToken =
          typeof config.webhookToken === "string"
            ? config.webhookToken.trim()
            : "";
 
        if (webhookToken) {
          const providedToken =
            headers["x-webhook-token"] ||
            headers["x-webhook-secret"] ||
            new URL(request.url).searchParams.get("token") ||
            "";
 
          if (providedToken !== webhookToken) {
            console.warn(
              `[Webhook] Unauthorized attempt for provider ${providerId}`
            );
 
            return new Response(
              "Unauthorized",
              { status: 401 }
            );
          }
        }

        let body: any;
        try {
          body = JSON.parse(rawBody);
          console.log("[Webhook] Incoming payload", {
            provider: providerId,
            event:
              body?.event ||
              body?.type ||
              body?.EventType ||
              null,
            topLevelKeys:
              body && typeof body === "object"
                ? Object.keys(body).slice(0, 25)
                : [],
          });
        } catch (e) {
          return new Response("Invalid JSON", { status: 400 });
        }

        // 3. Normalizar Payload via Strategy
        const normalized = active.provider.parseWebhook?.(body, headers);
        
        if (!normalized || !normalized.fromPhone) {
          console.log(`[Webhook] Message ignored or could not be parsed for provider ${providerId}`);
          return new Response("Ignored or unparseable", { status: 200 });
        }

        const { remoteMessageId, fromPhone, text, messageType, mediaUrl, pushName } = normalized;
 
        const customerPhone =
          String(fromPhone || "")
            .replace(/\D/g, "");
 
        if (!customerPhone) {
          console.warn(
            `[Webhook] Invalid sender for provider ${providerId}`
          );
 
          return new Response(
            "Ignored - invalid sender",
            { status: 200 }
          );
        }
 
        if (!remoteMessageId) {
          console.warn(
            `[Webhook] Message without provider id for ${providerId}`
          );
 
          return new Response(
            "Ignored - missing message id",
            { status: 200 }
          );
        }

        // --- CRM Contact Sync ---
        let contactId: string | null = null;
        try {
          // Normalize phone (digits only)
          const { data: contact } = await (supabaseAdmin as any)
            .from("crm_contacts")
            .select("id, name, name_source")
            .eq("phone", customerPhone)
            .maybeSingle();

          if (!contact) {
            const { data: newContact, error: contactErr } = await (supabaseAdmin as any)
              .from("crm_contacts")
              .insert({
                phone: customerPhone,
                name: pushName || null,
                name_source: pushName ? 'push_name' : null,
                accept_communications: true
              })
              .select("id")
              .single();
            if (!contactErr) contactId = newContact.id;
          } else {
            contactId = contact.id;
            // Update name if source allows it (priority: manual > flow > push_name)
            if (pushName && (!contact.name || contact.name_source === 'push_name')) {
              await (supabaseAdmin as any)
                .from("crm_contacts")
                .update({ 
                  name: pushName, 
                  name_source: 'push_name',
                  updated_at: new Date().toISOString()
                })
                .eq("id", contact.id);
            }
          }
        } catch (err) {
          console.error("[Webhook] Error syncing CRM contact:", err);
        }

        if (!text) return new Response("OK - No text", { status: 200 });

        // 4. Idempotência (provider_message_id)
        const { data: existing } = await (supabaseAdmin as any)
          .from("crm_messages")
          .select("id")
          .eq("provider_message_id", remoteMessageId)
          .maybeSingle();

        if (existing) {
          return new Response("Duplicate", { status: 200 });
        }

        // 5. Fluxo CRM (Conversa + Mensagem)
        let { data: conversation } = await (supabaseAdmin as any)
          .from("crm_conversations")
          .select("id")
          .eq("customer_phone", customerPhone)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (!conversation) {
          const { data: newConv, error: convErr } = await (supabaseAdmin as any)
            .from("crm_conversations")
            .insert({
              customer_phone: customerPhone,
              contact_id: contactId,
              status: "waiting",
              last_message_at: new Date().toISOString()
            })
            .select("id")
            .single();
          
          if (convErr) {
            console.error("[Webhook] Error creating conversation:", convErr);
            throw convErr;
          }
          conversation = newConv;
        } else {
          await (supabaseAdmin as any)
            .from("crm_conversations")
            .update({ 
              last_message_at: new Date().toISOString(), 
              status: "waiting",
              updated_at: new Date().toISOString(),
              contact_id: contactId // Ensure relation is up to date
            })
            .eq("id", conversation.id);
        }

        const { error: msgErr } = await (supabaseAdmin as any)
          .from("crm_messages")
          .insert({
            conversation_id: conversation.id,
            body: text,
            direction: "inbound",
            provider: providerId,
            provider_message_id: remoteMessageId,
            message_type: messageType || "text",
            media_url: mediaUrl || null,
            metadata: { raw: body }
          });

        if (msgErr) {
          console.error("[Webhook] Error persisting message:", msgErr);
          throw msgErr;
        }

        // 6. Engine do Bot / Fluxo
        try {
          const { executeFlow } =
            await import("@/lib/crm/flow-engine.server");

          const { ensureDefaultWhatsAppFlow } = await import("@/lib/crm/bootstrap.server");
          await ensureDefaultWhatsAppFlow();

 
          await executeFlow(
            conversation.id,
            text
          );
        } catch (flowError) {
          console.error(
            "[Webhook] Flow engine failed after message persistence:",
            flowError
          );
        }
 
        console.log("[Webhook] Inbound message persisted", {
          provider: providerId,
          conversationId: conversation.id,
          hasContact: Boolean(contactId),
          messageType: messageType || "text",
        });
 
        return new Response("OK", { status: 200 });
      },
    },
  },
});
