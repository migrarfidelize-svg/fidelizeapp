/**
 * Rate limiting ad-hoc para login e criação de conta.
 *
 * Não existe um primitivo de rate limit no backend, então usamos uma tabela
 * (`public.auth_attempts`) para contar tentativas por IP e por identificador
 * (e-mail ou WhatsApp) dentro de uma janela deslizante.
 *
 * Trade-off aceito com o usuário: cada tentativa gera uma escrita no banco.
 * A tabela tem política de retenção de 30 dias (purge_expired_logs).
 */

export type AuthAction = "login" | "signup";

export const RATE_LIMITS = {
  /** Janela deslizante analisada. */
  windowMinutes: 15,
  /** Tentativas por IP na janela (todas as ações somadas). */
  maxPerIp: 20,
  /** Tentativas por e-mail/WhatsApp na janela. */
  maxPerIdentifier: 5,
  /** Tempo de bloqueio depois de estourar o limite. */
  blockMinutes: 15,
} as const;

/** Normaliza o identificador para agrupar tentativas (e-mail minúsculo / só dígitos). */
export function normalizeIdentifier(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("@")) return v.slice(0, 160);
  const digits = v.replace(/\D/g, "");
  return digits ? `wa:${digits}` : null;
}

/** Extrai o IP do cliente a partir dos headers do proxy. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  const ip =
    headers.get("cf-connecting-ip") ||
    (fwd ? fwd.split(",")[0] : null) ||
    headers.get("x-real-ip");
  return ip ? ip.trim().slice(0, 64) : null;
}

export type RateDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; scope: "ip" | "identifier" };

/**
 * Verifica se a tentativa pode seguir. Falhas de infraestrutura NÃO bloqueiam
 * o login (fail-open) — o captcha e o honeypot continuam como defesa.
 */
export async function checkAuthRateLimit(params: {
  ip: string | null;
  identifier: string | null;
  action: AuthAction;
}): Promise<RateDecision> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - RATE_LIMITS.windowMinutes * 60_000).toISOString();

    if (params.identifier) {
      const { count } = await (supabaseAdmin as any)
        .from("auth_attempts")
        .select("id", { count: "exact", head: true })
        .eq("identifier", params.identifier)
        .eq("success", false)
        .gte("created_at", since);
      if ((count ?? 0) >= RATE_LIMITS.maxPerIdentifier) {
        return {
          allowed: false,
          retryAfterSeconds: RATE_LIMITS.blockMinutes * 60,
          scope: "identifier",
        };
      }
    }

    if (params.ip) {
      const { count } = await (supabaseAdmin as any)
        .from("auth_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", params.ip)
        .eq("success", false)
        .gte("created_at", since);
      if ((count ?? 0) >= RATE_LIMITS.maxPerIp) {
        return { allowed: false, retryAfterSeconds: RATE_LIMITS.blockMinutes * 60, scope: "ip" };
      }
    }

    return { allowed: true };
  } catch (err) {
    console.error("[auth-rate-limit] falha ao consultar tentativas", err);
    return { allowed: true };
  }
}

/** Registra a tentativa (sucesso ou falha) para alimentar a janela. */
export async function recordAuthAttempt(params: {
  ip: string | null;
  identifier: string | null;
  action: AuthAction;
  success: boolean;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("auth_attempts").insert({
      ip: params.ip,
      identifier: params.identifier,
      action: params.action,
      success: params.success,
    });
  } catch (err) {
    console.error("[auth-rate-limit] falha ao registrar tentativa", err);
  }
}
