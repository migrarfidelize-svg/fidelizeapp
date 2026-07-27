// Apple Wallet Web Service — recebe logs de diagnóstico do dispositivo.
// POST /api/public/wallet/v1/log
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/wallet/v1/log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { logs?: string[] };
          const logs = (body.logs ?? []).slice(0, 20).map((l) => String(l).slice(0, 500));
          if (logs.length) console.warn("[apple-wallet]", logs.join(" | "));
        } catch { /* ignora corpo inválido */ }
        return new Response(null, { status: 200 });
      },
    },
  },
});
