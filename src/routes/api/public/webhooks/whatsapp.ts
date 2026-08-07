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

        // 3. Normalizar Payload via Strategy
        const normalized = active.provider.parseWebhook?.(body, headers);
        
        if (!normalized || !normalized.remoteMessageId || !normalized.fromPhone || !normalized.text) {
          console.log(`[Webhook] Message ignored or could not be parsed for provider ${providerId}`);
          return new Response("Ignored or unparseable", { status: 200 });
        }

        const { remoteMessageId, fromPhone, text, messageType, mediaUrl } = normalized;

        // 4. Idempotência (provider_message_id)
        // Usamos asany para ignorar erros de tipo até o próximo build regenerar os tipos
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
          .eq("customer_phone", fromPhone)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (!conversation) {
          const { data: newConv, error: convErr } = await (supabaseAdmin as any)
            .from("crm_conversations")
            .insert({
              customer_phone: fromPhone,
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
              updated_at: new Date().toISOString()
            })
            .eq("id", conversation.id);
        }

        const { error: msgErr } = await (supabaseAdmin as any)
          .from("crm_messages")
          .insert({
            conversation_id: conversation.id,
            body: text,
            direction: "inbound",
            provider_message_id: remoteMessageId,
            message_type: messageType || "text",
            media_url: mediaUrl,
            metadata: { raw: body }
          });

        if (msgErr) {
          console.error("[Webhook] Error persisting message:", msgErr);
          throw msgErr;
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
