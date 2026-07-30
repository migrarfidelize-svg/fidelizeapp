import { createFileRoute } from "@tanstack/react-router";

// Endpoint público chamado por pg_cron/monitor externo para processar a fila.
// Exige cabeçalho `apikey` com a chave publicável do backend.
export const Route = createFileRoute("/api/public/hooks/process-email-queue")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/lib/cron-auth.server");
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const { processEmailQueue } = await import("@/lib/email.server");
          const result = await processEmailQueue(50);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
