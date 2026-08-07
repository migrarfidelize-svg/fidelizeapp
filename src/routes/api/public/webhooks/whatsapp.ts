import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Webhook unificado para recebimento de mensagens de WhatsApp.
 * Suporta: UAZAPI, Evolution API, Z-API e Custom.
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
          return new Response("No active WhatsApp provider", { status: 404 });
        }

        const providerId = active.provider.meta.id;
        const config = active.runtime.config;
        
        // 2. Validar Segurança (Token/Secret) conforme o provedor
        // Nota: Cada provider tem sua forma de envio de webhook.
        const providedToken = headers["x-webhook-token"] || headers["apikey"] || headers["token"] || new URL(request.url).searchParams.get("token");
        const expectedToken = (config.webhookToken as string) || (config.token as string) || (config.apiKey as string);

        if (expectedToken && providedToken !== expectedToken) {
          console.warn(`[Webhook] Unauthorized attempt for provider ${providerId}`);
          return new Response("Unauthorized", { status: 401 });
        }

        let body: any;
        try {
          body = JSON.parse(rawBody);
        } catch (e) {
          return new Response("Invalid JSON", { status: 400 });
        }

        // 3. Normalizar Payload para o CRM
        let remoteMessageId: string | null = null;
        let fromPhone: string | null = null;
        let text: string | null = null;
        let type: "text" | "image" | "other" = "text";

        if (providerId === "uazapi") {
          // UAZAPI payload structure
          if (body.event !== "messages.upsert") return new Response("Ignored event", { status: 200 });
          const msg = body.data;
          remoteMessageId = msg.key?.id;
          fromPhone = msg.key?.remoteJid?.split("@")[0];
          text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
        } else if (providerId === "evolution") {
          // Evolution API payload structure
          if (body.event !== "MESSAGES_UPSERT") return new Response("Ignored event", { status: 200 });
          const msg = body.data?.message;
          remoteMessageId = body.data?.key?.id;
          fromPhone = body.data?.key?.remoteJid?.split("@")[0];
          text = msg?.conversation || msg?.extendedTextMessage?.text;
        } else if (providerId === "zapi") {
          // Z-API payload structure
          remoteMessageId = body.messageId;
          fromPhone = body.phone;
          text = body.text?.message;
        } else {
          // Custom / Fallback
          remoteMessageId = body.id || body.messageId || body.key?.id;
          fromPhone = body.phone || body.from || body.sender;
          text = body.text || body.message || body.content;
        }

        if (!remoteMessageId || !fromPhone || !text) {
          return new Response("Could not parse message", { status: 200 }); // 200 to avoid retries on malformed but valid hits
        }

        // 4. Idempotência (Check if exists)
        const { data: existing } = await supabaseAdmin
          .from("crm_messages")
          .select("id")
          .eq("provider_message_id", remoteMessageId)
          .maybeSingle();

        if (existing) {
          return new Response("Duplicate", { status: 200 });
        }

        // 5. Persistência e Fluxo CRM
        // Nota: A lógica de criação de conversa e mensagens deve estar alinhada com as tabelas do CRM.
        // Assumindo tabelas: crm_conversations (phone) e crm_messages (conversation_id, body, direction)
        
        // Encontrar ou criar conversa
        let { data: conversation } = await supabaseAdmin
          .from("crm_conversations")
          .select("id")
          .eq("customer_phone", fromPhone)
          .maybeSingle();
          
        if (!conversation) {
          const { data: newConv, error: convErr } = await supabaseAdmin
            .from("crm_conversations")
            .insert({
              customer_phone: fromPhone,
              status: "open",
              last_message_at: new Date().toISOString()
            })
            .select("id")
            .single();
          
          if (convErr) throw convErr;
          conversation = newConv;
        } else {
          await supabaseAdmin
            .from("crm_conversations")
            .update({ last_message_at: new Date().toISOString(), status: "open" })
            .eq("id", conversation.id);
        }

        // Inserir Mensagem
        const { error: msgErr } = await supabaseAdmin
          .from("crm_messages")
          .insert({
            conversation_id: conversation.id,
            body: text,
            direction: "inbound",
            provider_message_id: remoteMessageId,
            metadata: { raw: body }
          });

        if (msgErr) throw msgErr;

        return new Response("OK", { status: 200 });
      },
    },
  },
});
