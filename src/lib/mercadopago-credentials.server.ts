/**
 * Fonte única para credenciais do Mercado Pago em runtime.
 *
 * Ordem de prioridade (a mais alta primeiro):
 *   1) `integrations.credentials` (category=payments, provider=mercadopago) — configurado
 *      manualmente pelo Super Admin em /admin/integracoes.
 *   2) `payment_settings.public_key` — legado, apenas para public_key.
 *   3) `process.env.MERCADOPAGO_*` — fallback de deploy.
 *
 * Isso garante que TODA cobrança do SaaS use o token que o admin cadastrou no
 * painel, não o secret do ambiente.
 */

type CredentialSource = "db_integration" | "db_payment_settings" | "env" | null;

export type MercadoPagoCredentials = {
  access_token: string | null;
  public_key: string | null;
  webhook_secret: string | null;
  mode: "sandbox" | "production" | null;
  sources: {
    access_token: CredentialSource;
    public_key: CredentialSource;
    webhook_secret: CredentialSource;
  };
};

let cached: { at: number; value: MercadoPagoCredentials } | null = null;
const TTL_MS = 5_000; // Curto: admin pode trocar o token no painel a qualquer momento.

function normalize(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

export async function loadMercadoPagoCredentials(force = false): Promise<MercadoPagoCredentials> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let dbAccess: string | null = null;
  let dbPublic: string | null = null;
  let dbSecret: string | null = null;
  let dbMode: "sandbox" | "production" | null = null;

  try {
    const { data } = await (supabaseAdmin as any)
      .from("integrations")
      .select("credentials, mode, enabled")
      .eq("category", "payments")
      .eq("provider", "mercadopago")
      .maybeSingle();
    if (data) {
      const creds = (data.credentials ?? {}) as Record<string, unknown>;
      dbAccess = normalize(creds.access_token);
      dbPublic = normalize(creds.public_key);
      dbSecret = normalize(creds.webhook_secret);
      const mode = typeof data.mode === "string" ? data.mode : null;
      dbMode = mode === "sandbox" || mode === "production" ? mode : null;
    }
  } catch {
    // integrations pode não existir em ambientes antigos — segue para fallback.
  }

  let legacyPublic: string | null = null;
  let legacyMode: "sandbox" | "production" | null = null;
  if (!dbPublic || !dbMode) {
    try {
      const { data } = await supabaseAdmin
        .from("payment_settings")
        .select("public_key, environment")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      legacyPublic = normalize((data as any)?.public_key);
      const env = (data as any)?.environment as string | null;
      legacyMode = env === "sandbox" || env === "production" ? env : null;
    } catch { /* noop */ }
  }

  const envAccess = normalize(process.env.MERCADOPAGO_ACCESS_TOKEN);
  const envPublic = normalize(process.env.MERCADOPAGO_PUBLIC_KEY);
  const envSecret = normalize(process.env.MERCADOPAGO_WEBHOOK_SECRET);

  const access_token = dbAccess ?? envAccess;
  const public_key = dbPublic ?? legacyPublic ?? envPublic;
  const webhook_secret = dbSecret ?? envSecret;

  const value: MercadoPagoCredentials = {
    access_token,
    public_key,
    webhook_secret,
    mode: dbMode ?? legacyMode ?? "production",
    sources: {
      access_token: dbAccess ? "db_integration" : envAccess ? "env" : null,
      public_key: dbPublic ? "db_integration" : legacyPublic ? "db_payment_settings" : envPublic ? "env" : null,
      webhook_secret: dbSecret ? "db_integration" : envSecret ? "env" : null,
    },
  };

  cached = { at: Date.now(), value };
  return value;
}

export function invalidateMercadoPagoCredentialsCache() {
  cached = null;
}

export async function requireMercadoPagoAccessToken(): Promise<string> {
  const { access_token } = await loadMercadoPagoCredentials();
  if (!access_token) {
    throw new Error(
      "Mercado Pago não configurado: cadastre o Access Token em /admin/integracoes → Pagamentos → Mercado Pago (aba Credenciais).",
    );
  }
  return access_token;
}
