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
        const url = new URL(request.url);
        const urlEstablishmentId = url.searchParams.get("establishment_id");

        // 1. Identificar Provedor Ativo
        // Se houver establishment_id na URL, usamos para isolamento imediato
        const active = await getActiveWhatsAppProvider(urlEstablishmentId || undefined);
        if (!active) {
          console.error(`[Webhook] No active WhatsApp provider found${urlEstablishmentId ? ` for establishment ${urlEstablishmentId}` : ''}.`);
          return new Response("No active WhatsApp provider", { status: 404 });
        }

        const providerId = active.provider.meta.id;
        const config = active.runtime.config;
        const establishmentId = (active.runtime as any).establishment_id;
        
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
 
        if (!customerPhone || !remoteMessageId) {
          return new Response("Ignored - invalid message/sender", { status: 200 });
        }

        // --- Início do Processamento com Fila e Lock ---
        
        // 4. Idempotência Imediata (Fast check)
        const { data: existingMsg } = await (supabaseAdmin as any)
          .from("crm_messages")
          .select("id")
          .eq("provider_message_id", remoteMessageId)
          .maybeSingle();

        if (existingMsg) {
          return new Response("Duplicate", { status: 200 });
        }

        // 5. CRM Contact Sync
        let contactId: string | null = null;
        const { data: contact } = await (supabaseAdmin as any)
          .from("crm_contacts")
          .select("id, name_source")
          .eq("phone", customerPhone)
          .maybeSingle();

        if (!contact) {
          const { data: newContact } = await (supabaseAdmin as any)
            .from("crm_contacts")
            .insert({
              phone: customerPhone,
              name: pushName || null,
              name_source: pushName ? 'push_name' : null,
              accept_communications: true
            })
            .select("id")
            .single();
          contactId = newContact?.id || null;
        } else {
          contactId = contact.id;
          if (pushName && (!contact.name || contact.name_source === 'push_name')) {
            await (supabaseAdmin as any)
              .from("crm_contacts")
              .update({ name: pushName, name_source: 'push_name', updated_at: new Date().toISOString() })
              .eq("id", contact.id);
          }
        }

        // 6. Identificar/Criar Conversa (Sem lock ainda)
        let { data: conversation } = await (supabaseAdmin as any)
          .from("crm_conversations")
          .select("id")
          .eq("establishment_id", establishmentId)
          .eq("customer_phone", customerPhone)
          .neq("status", "closed")
          .maybeSingle();

        if (!conversation) {
          const { data: newConv, error: convErr } = await (supabaseAdmin as any)
            .from("crm_conversations")
            .insert({
              establishment_id: establishmentId,
              customer_phone: customerPhone,
              contact_id: contactId,
              status: "bot", // Começa como bot para automação
              last_message_at: new Date().toISOString()
            })
            .select("id")
            .single();
          if (convErr) throw convErr;
          conversation = newConv;
        }

        // 7. Persistir Mensagem na Fila (processed_at IS NULL)
        const { data: message, error: msgErr } = await (supabaseAdmin as any)
          .from("crm_messages")
          .insert({
            conversation_id: conversation.id,
            establishment_id: establishmentId,
            body: text,
            direction: "inbound",
            provider: providerId,
            provider_message_id: remoteMessageId,
            message_type: messageType || "text",
            media_url: mediaUrl || null,
            metadata: { raw: body },
            processed_at: null // Fila
          })
          .select("id")
          .single();

        if (msgErr || !message) {
          return new Response("Persistence Error", { status: 200 });
        }

        // 8. Loop de Processamento com Concorrência (Lock)
        const lockToken = Math.random().toString(36).substring(7);
        const retryLimit = 3;
        
        // Disparamos o processamento, mas respondemos OK para o provedor (fire and forget assíncrono interno)
        (async () => {
          for (let i = 0; i < retryLimit; i++) {
            const { data: locked } = await (supabaseAdmin as any).rpc("acquire_crm_lock", {
              _conv_id: conversation.id,
              _token: lockToken,
              _ttl_sec: 20
            });

            if (locked) {
              try {
                // Buscar mensagens não processadas desta conversa
                const { data: pendingMessages } = await (supabaseAdmin as any)
                  .from("crm_messages")
                  .select("*")
                  .eq("conversation_id", conversation.id)
                  .eq("establishment_id", establishmentId)
                  .is("processed_at", null)
                  .order("created_at", { ascending: true })
                  .order("id", { ascending: true });

                if (pendingMessages && pendingMessages.length > 0) {
                  const { executeFlow } = await import("@/lib/crm/flow-engine.server");
                  const { ensureDefaultWhatsAppFlow } = await import("@/lib/crm/bootstrap.server");
                  await ensureDefaultWhatsAppFlow();

                  for (const msg of pendingMessages) {
                    await executeFlow(conversation.id, msg.body || "");
                    await (supabaseAdmin as any)
                      .from("crm_messages")
                      .update({ processed_at: new Date().toISOString() })
                      .eq("id", msg.id);
                  }
                }
                break; // Sucesso
              } catch (err) {
                console.error("[Webhook] Processing Error:", err);
              } finally {
                await (supabaseAdmin as any).rpc("release_crm_lock", {
                  _conv_id: conversation.id,
                  _token: lockToken
                });
              }
            } else {
              // Lock ocupado, aguardar e tentar novamente
              await new Promise(resolve => setTimeout(resolve, 500 + (i * 200)));
            }
          }
        })();

        return new Response("OK", { status: 200 });
      },
    },
  },
});