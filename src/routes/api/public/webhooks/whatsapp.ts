import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveWhatsAppProvider } from "@/lib/otp.functions";

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const url = new URL(request.url);
        const urlEst = url.searchParams.get("establishment_id");

        const active = await getActiveWhatsAppProvider(urlEst || undefined);
        if (!active) return new Response("No provider", { status: 500 });
        
        const estId = active.establishmentId;
        if (!estId) {
          console.error("[Webhook] Active WhatsApp provider has no establishmentId");
          return new Response("WhatsApp provider missing establishment", { status: 500 });
        }

        const normalized = active.provider.parseWebhook?.(JSON.parse(rawBody), {});
        if (!normalized) return new Response("Ignored", { status: 200 });

        const customerPhone = normalized.fromPhone.replace(/\D/g, "");
        
        let { data: conv } = await supabaseAdmin.from("crm_conversations")
          .select("id")
          .eq("establishment_id", estId)
          .eq("customer_phone", customerPhone)
          .maybeSingle();

        if (!conv) {
             const { data: contact } = await supabaseAdmin.from("crm_contacts").insert({ 
               phone: customerPhone,
               name: normalized.senderName || customerPhone,
               establishment_id: estId
             } as any).select("id").single();
             
             const { data: newConv } = await supabaseAdmin.from("crm_conversations").insert({ 
               establishment_id: estId, 
               customer_phone: customerPhone, 
               contact_id: contact?.id, 
               status: 'bot' 
             } as any).select("id").single();
             conv = newConv;
        }

        if (!conv) return new Response("Failed to create conversation", { status: 500 });

        await supabaseAdmin.from("crm_messages").insert({
            conversation_id: conv.id,
            establishment_id: estId,
            body: normalized.text,
            direction: 'inbound',
            provider: active.provider.meta.id,
            provider_message_id: normalized.remoteMessageId,
            message_type: 'text'
        });

        const { executeFlow } = await import("@/lib/crm/flow-engine.server");
        await executeFlow(conv.id, normalized.text);

        return new Response("OK", { status: 200 });
      }
    }
  }
});
