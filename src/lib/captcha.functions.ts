import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Configuração pública do captcha (Cloudflare Turnstile).
 * Retorna `enabled: false` quando as chaves não estão configuradas —
 * assim o login continua funcionando normalmente antes do setup.
 */
export const getCaptchaConfig = createServerFn({ method: "GET" }).handler(async () => {
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? "";
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";
  if (!siteKey || !secret) return { enabled: false as const, siteKey: "" };
  return { enabled: true as const, siteKey };
});

/**
 * Valida o token do Turnstile no servidor (siteverify).
 * Chamado antes de qualquer signIn/signUp na tela /auth em desktop.
 */
export const verifyCaptcha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1).max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    // Sem chave configurada, não bloqueia o acesso.
    if (!secret) return { ok: true as const, skipped: true as const };

    const body = new URLSearchParams({ secret, response: data.token });
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
      if (!json.success) {
        console.error("[turnstile] verificação falhou", json["error-codes"]);
        return { ok: false as const, skipped: false as const };
      }
      return { ok: true as const, skipped: false as const };
    } catch (err) {
      console.error("[turnstile] erro ao verificar", err);
      return { ok: false as const, skipped: false as const };
    }
  });

/**
 * Verifica se as chaves do Turnstile estão configuradas e se o formato parece correto.
 * Faz uma chamada de teste à API Cloudflare para validar a secret key.
 * Útil no onboarding de integração e no painel de diagnóstico.
 */
export const testTurnstileKeys = createServerFn({ method: "GET" }).handler(async () => {
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? "";
  const secret = process.env.TURNSTILE_SECRET_KEY ?? "";

  const checks = {
    siteKeySet: siteKey.length > 0,
    secretSet: secret.length > 0,
    siteKeyFormat: /^(0x|1x|3x)[A-Za-z0-9_-]{30,60}$/.test(siteKey),
    secretKeyFormat: /^(0x|1x|3x)[A-Za-z0-9_-]{30,60}$/.test(secret),
  };

  if (!checks.siteKeySet || !checks.secretSet) {
    return { ok: false, message: "Chaves não configuradas.", checks };
  }

  if (!checks.siteKeyFormat || !checks.secretKeyFormat) {
    return { ok: false, message: "Formato das chaves parece inválido. Site key e secret key devem começar com 0x, 1x ou 3x e ter ~40 caracteres.", checks };
  }

  // Testa a secret key com um token dummy: a API deve aceitar a secret (mesmo que rejeite o token).
  const body = new URLSearchParams({ secret, response: "dummy-token" });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    const errors = json["error-codes"] ?? [];
    const invalidSecret = errors.includes("invalid-input-secret");
    const badRequest = errors.includes("bad-request");
    if (invalidSecret) {
      return { ok: false, message: "Secret key rejeitada pela Cloudflare (invalid-input-secret). Copie novamente do dashboard.", checks, errors };
    }
    if (badRequest) {
      return { ok: false, message: "Requisição mal formada. Verifique se a secret key está completa.", checks, errors };
    }
    return {
      ok: true,
      message: "Chaves no formato esperado e secret key reconhecida pela Cloudflare.",
      checks,
      errors,
    };
  } catch (err) {
    return { ok: false, message: "Erro de rede ao testar chaves.", checks, error: String(err) };
  }
});
