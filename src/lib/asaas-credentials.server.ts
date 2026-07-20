/**
 * Credenciais Asaas — carregadas do painel `/admin/integracoes` (fonte de verdade)
 * com fallback para `process.env.ASAAS_*`.
 */

type CredentialSource = "db_integration" | "env" | null;

export type AsaasCredentials = {
  access_token: string | null;
  webhook_token: string | null; // usado no header `asaas-access-token` das notificações
  mode: "sandbox" | "production";
  sources: {
    access_token: CredentialSource;
    webhook_token: CredentialSource;
  };
};

let cached: { at: number; value: AsaasCredentials } | null = null;
const TTL_MS = 5_000;

const normalize = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
};

export async function loadAsaasCredentials(force = false): Promise<AsaasCredentials> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let dbAccess: string | null = null;
  let dbWebhook: string | null = null;
  let dbMode: "sandbox" | "production" | null = null;

  try {
    const { data } = await (supabaseAdmin as any)
      .from("integrations")
      .select("credentials, mode")
      .eq("category", "payments")
      .eq("provider", "asaas")
      .maybeSingle();
    if (data) {
      const creds = (data.credentials ?? {}) as Record<string, unknown>;
      dbAccess = normalize(creds.access_token) ?? normalize(creds.api_key);
      dbWebhook = normalize(creds.webhook_token) ?? normalize(creds.webhook_secret);
      const m = typeof data.mode === "string" ? data.mode : null;
      dbMode = m === "sandbox" || m === "production" ? m : null;
    }
  } catch {
    /* tabela pode não existir em builds antigos — ok */
  }

  const envAccess = normalize(process.env.ASAAS_ACCESS_TOKEN) ?? normalize(process.env.ASAAS_API_KEY);
  const envWebhook = normalize(process.env.ASAAS_WEBHOOK_TOKEN);
  const envMode = (process.env.ASAAS_MODE === "production" ? "production" : "sandbox") as "sandbox" | "production";

  const value: AsaasCredentials = {
    access_token: dbAccess ?? envAccess,
    webhook_token: dbWebhook ?? envWebhook,
    mode: dbMode ?? envMode,
    sources: {
      access_token: dbAccess ? "db_integration" : envAccess ? "env" : null,
      webhook_token: dbWebhook ? "db_integration" : envWebhook ? "env" : null,
    },
  };

  cached = { at: Date.now(), value };
  return value;
}

export function asaasBaseUrl(mode: "sandbox" | "production"): string {
  return mode === "sandbox"
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
}

export async function requireAsaasAccessToken(): Promise<{ token: string; mode: "sandbox" | "production"; base: string }> {
  const c = await loadAsaasCredentials(true);
  if (!c.access_token) throw new Error("ASAAS_ACCESS_TOKEN não configurado (painel ou env).");
  return { token: c.access_token, mode: c.mode, base: asaasBaseUrl(c.mode) };
}
