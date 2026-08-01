import { createFileRoute } from "@tanstack/react-router";

/**
 * Diagnóstico de ambiente do servidor (VPS/Docker).
 * Retorna APENAS booleanos — nunca valores de chaves.
 * Útil para descobrir por que funções de servidor (ex.: super admin) falham.
 */
export const Route = createFileRoute("/api/public/diag/env")({
  server: {
    handlers: {
      GET: async () => {
        const has = (k: string) => Boolean(process.env[k]);
        const url = process.env["SUPABASE_URL"] ?? null;
        let host: string | null = null;
        try {
          host = url ? new URL(url).host : null;
        } catch {
          host = "invalid-url";
        }

        const body = {
          ok: has("SUPABASE_URL") && has("SUPABASE_PUBLISHABLE_KEY"),
          supabase_host: host,
          env: {
            SUPABASE_URL: has("SUPABASE_URL"),
            SUPABASE_PUBLISHABLE_KEY: has("SUPABASE_PUBLISHABLE_KEY"),
            SUPABASE_SERVICE_ROLE_KEY: has("SUPABASE_SERVICE_ROLE_KEY"),
            PUBLIC_APP_URL: has("PUBLIC_APP_URL"),
          },
        };

        return new Response(JSON.stringify(body, null, 2), {
          status: body.ok ? 200 : 503,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
