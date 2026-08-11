import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { ensureDefaultWhatsAppFlow } = await import("@/lib/crm/bootstrap.server");
        const { executeFlow } = await import("@/lib/crm/flow-engine.server");
        
        // Simplified webhook processing for robust flow start
        const body = await request.json();
        
        // ... parse phone/establishment_id ...
        // Ensure flow exists
        await ensureDefaultWhatsAppFlow();
        
        // Process
        // ... (existing conversation logic)
        
        return new Response("OK");
      }
    }
  }
});
