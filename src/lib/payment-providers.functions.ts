import { createServerFn } from "@tanstack/react-start";

/**
 * Lista provedores de pagamento ativos (Mercado Pago / Asaas) consultando
 * a tabela `integrations`. Público — só devolve identificador e modo,
 * nunca segredos.
 */
export const getActivePaymentProviders = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const providers: Array<{ id: "mercadopago" | "asaas"; enabled: boolean; mode: "sandbox" | "production" }> = [];

  try {
    const { data } = await (supabaseAdmin as any)
      .from("integrations")
      .select("provider, mode, enabled, credentials")
      .eq("category", "payments")
      .in("provider", ["mercadopago", "asaas"]);
    for (const row of (data ?? []) as Array<{ provider: string; mode: string | null; enabled: boolean | null; credentials: Record<string, unknown> | null }>) {
      const creds = row.credentials ?? {};
      const hasToken =
        typeof creds.access_token === "string" && creds.access_token.trim().length > 0;
      providers.push({
        id: row.provider as "mercadopago" | "asaas",
        enabled: Boolean(row.enabled) && hasToken,
        mode: (row.mode === "production" ? "production" : "sandbox"),
      });
    }
  } catch { /* tabela pode não existir em builds antigos */ }

  // Fallback env: se Mercado Pago tem token via env e nada retornou.
  if (!providers.some((p) => p.id === "mercadopago")) {
    if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
      providers.push({ id: "mercadopago", enabled: true, mode: process.env.MERCADOPAGO_ACCESS_TOKEN.startsWith("TEST-") ? "sandbox" : "production" });
    }
  }
  if (!providers.some((p) => p.id === "asaas")) {
    if (process.env.ASAAS_ACCESS_TOKEN || process.env.ASAAS_API_KEY) {
      providers.push({ id: "asaas", enabled: true, mode: process.env.ASAAS_MODE === "production" ? "production" : "sandbox" });
    }
  }

  return { providers };
});
