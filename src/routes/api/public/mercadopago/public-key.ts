import { createFileRoute } from "@tanstack/react-router";

async function readPublicKey() {
  const { loadMercadoPagoCredentials } = await import("@/lib/mercadopago-credentials.server");
  const creds = await loadMercadoPagoCredentials(true);
  const src = creds.sources.public_key;
  const source = src === "env" ? ("env" as const)
    : src === "db_integration" ? ("db_integration" as const)
    : src === "db_payment_settings" ? ("db_payment_settings" as const)
    : null;
  return { public_key: creds.public_key, source };
}

export const Route = createFileRoute("/api/public/mercadopago/public-key")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const payload = await readPublicKey();
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, max-age=0",
            },
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ public_key: null, source: null, error: error?.message ?? "Falha ao ler Public Key" }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, max-age=0",
            },
          });
        }
      },
    },
  },
});
