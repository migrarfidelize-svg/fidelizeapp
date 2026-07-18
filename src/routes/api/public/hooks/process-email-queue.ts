import { createFileRoute } from "@tanstack/react-router";

// Endpoint público chamado por pg_cron/monitor externo para processar a fila.
// Não expõe nenhum dado sensível.
export const Route = createFileRoute("/api/public/hooks/process-email-queue")({
  server: {
    handlers: {
      POST: async () => {
        const { processEmailQueue } = await import("@/lib/email.server");
        try {
          const result = await processEmailQueue(50);
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: err?.message ?? "erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => {
        const { processEmailQueue } = await import("@/lib/email.server");
        const result = await processEmailQueue(50);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
