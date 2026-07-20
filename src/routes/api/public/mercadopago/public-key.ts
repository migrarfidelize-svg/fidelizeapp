import { createFileRoute } from "@tanstack/react-router";

function normalizePublicKey(value: unknown): string | null {
  const key = typeof value === "string" ? value.trim() : "";
  if (!key) return null;
  return key;
}

async function readPublicKey() {
  const envKey = normalizePublicKey(process.env.MERCADOPAGO_PUBLIC_KEY);
  if (envKey) return { public_key: envKey, source: "env" as const };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("payment_settings")
    .select("public_key, updated_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const dbKey = normalizePublicKey((data as any)?.public_key);
  return {
    public_key: dbKey,
    source: dbKey ? ("db" as const) : null,
    updated_at: ((data as any)?.updated_at as string | null) ?? null,
  };
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