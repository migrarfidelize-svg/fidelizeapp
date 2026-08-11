import { createFileRoute } from "@tanstack/react-router";

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

        const active = await getActiveWhatsAppProvider(urlEstablishmentId || undefined);
        if (!active) {
          console.error(`[Webhook] No active provider found for ${urlEstablishmentId || 'default'}`);
          return new Response("No active provider", { status: 404 });
        }

        const providerId = active.provider.meta.id;
        const config = active.runtime.config;
        const establishmentId = (active.runtime as any).establishment_id;
        
        const webhookToken = typeof config.webhookToken === "string" ? config.webhookToken.trim() : "";
        if (webhookToken) {
          const providedToken = headers["x-webhook-token"] || headers["x-webhook-secret"] || url.searchParams.get("token") || "";
          if (providedToken !== webhookToken) return new Response("Unauthorized", { status: 401 });
        }

        let body: any;
        try { body = JSON.parse(rawBody); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }

        const normalized = active.provider.parseWebhook?.(body, headers);
        if (!normalized || !normalized.fromPhone || !normalized.remoteMessageId) {
          return new Response("Ignored", { status: 200 });
        }

        const { remoteMessageId, fromPhone, text, messageType, mediaUrl, pushName } = normalized;
        const customerPhone = String(fromPhone || "").replace(/\D/g, "");

        // 4. Idempotência
        const { data: existingMsg } = await supabaseAdmin
          .from("crm_messages")
          .select("id")
          .eq("provider_message_id", remoteMessageId)
          .maybeSingle();

        if (existingMsg) return new Response("Duplicate", { status: 200 });

        // 5. Contact Sync
        let contact: any = null;
        const { data: existingContact } = await supabaseAdmin
          .from("crm_contacts")
          .select("id, name, name_source")
          .eq("phone", customerPhone)
          .maybeSingle();

        if (!existingContact) {
          const { data: newContact } = await supabaseAdmin
            .from("crm_contacts")
            .insert({
              phone: customerPhone,
              name: pushName || null,
              name_source: pushName ? 'push_name' : null,
              accept_communications: true
            })
            .select("id, name, name_source")
            .single();
          contact = newContact;
        } else {
          contact = existingContact;
          if (pushName && (!contact.name || contact.name_source === 'push_name')) {
            await supabaseAdmin.from("crm_contacts").update({ name: pushName, name_source: 'push_name' }).eq("id", contact.id);
          }
        }

        // 6. Conversation
        let conversation: any = null;
        const { data: existingConv } = await supabaseAdmin
          .from("crm_conversations")
          .select("id, status")
          .eq("establishment_id", establishmentId)
          .eq("customer_phone", customerPhone)
          .neq("status", "closed")
          .maybeSingle();

        if (!existingConv) {
          const { data: newConv } = await supabaseAdmin
            .from("crm_conversations")
            .insert({
              establishment_id: establishmentId,
              customer_phone: customerPhone,
              contact_id: contact?.id,
              status: "bot",
              last_message_at: new Date().toISOString()
            })
            .select("id, status")
            .single();
          conversation = newConv;
        } else {
          conversation = existingConv;
        }

        if (!conversation?.id) return new Response("Error identifying conversation", { status: 200 });

        // 7. Queue Message
        const { data: message, error: msgErr } = await supabaseAdmin
          .from("crm_messages")
          .insert({
            conversation_id: conversation.id,
            establishment_id: establishmentId,
            body: text,
            direction: "inbound",
            provider: providerId,
            provider_message_id: remoteMessageId,
            message_type: (messageType as any) || "text",
            media_url: mediaUrl || null,
            metadata: { raw: body },
            processed_at: null
          })
          .select("id")
          .single();

        if (msgErr || !message) return new Response("Error persisting message", { status: 200 });

        // 8. Process with Lock
        const lockToken = Math.random().toString(36).substring(7);
        const convId = conversation.id;
        
        (async () => {
          for (let i = 0; i < 3; i++) {
            const { data: locked } = await supabaseAdmin.rpc("acquire_crm_lock", {
              _conv_id: convId,
              _token: lockToken,
              _ttl_sec: 30
            });

            if (locked) {
              try {
                const { data: pending } = await supabaseAdmin
                  .from("crm_messages")
                  .select("*")
                  .eq("conversation_id", convId)
                  .is("processed_at", null)
                  .order("created_at", { ascending: true });

                if (pending?.length) {
                  const { executeFlow } = await import("@/lib/crm/flow-engine.server");
                  for (const m of pending) {
                    await executeFlow(convId, m.body || "");
                    await supabaseAdmin.from("crm_messages").update({ processed_at: new Date().toISOString() }).eq("id", m.id);
                  }
                }
                break;
              } catch (err) {
                console.error("[Webhook] Processing Error:", err);
              } finally {
                await supabaseAdmin.rpc("release_crm_lock", { _conv_id: convId, _token: lockToken });
              }
            } else {
              await new Promise(r => setTimeout(r, 500 * (i + 1)));
            }
          }
        })();

        return new Response("OK", { status: 200 });
      },
    },
  },
});
