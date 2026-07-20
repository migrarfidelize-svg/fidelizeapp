import { createFileRoute } from "@tanstack/react-router";
import { retryFailedWebhooks } from "@/routes/api/public/webhooks/mercadopago";

// Cron endpoint chamado por pg_cron (a cada 5min).
// Reprocessa entregas do Mercado Pago que falharam e estão com next_retry_at vencido.
export const Route = createFileRoute("/api/public/hooks/mercadopago-retry")({
  server: {
    handlers: {
      GET: async () => new Response("mercadopago-retry OK", { status: 200 }),
      POST: async ({ request }) => {
        // Autenticação via anon key (Supabase). Padrão para cron endpoints.
        const anonKey = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!expected || anonKey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const result = await retryFailedWebhooks(50);
          return new Response(JSON.stringify(result), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
