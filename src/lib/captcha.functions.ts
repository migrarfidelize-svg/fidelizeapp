import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Configuração pública do captcha (Cloudflare Turnstile).
 * O modo (produção / teste / desligado) vem da variável TURNSTILE_MODE.
 */
export const getCaptchaConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveTurnstile } = await import("./captcha.server");
  const cfg = resolveTurnstile();
  if (!cfg.enabled) return { enabled: false as const, siteKey: "", mode: cfg.mode };
  return { enabled: true as const, siteKey: cfg.siteKey, mode: cfg.mode };
});

/**
 * Valida o token do Turnstile no servidor (siteverify).
 * Chamado antes de qualquer signIn/signUp na tela /auth em desktop.
 */
export const verifyCaptcha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(1).max(4096) }).parse(d))
  .handler(async ({ data }) => {
    const { resolveTurnstile } = await import("./captcha.server");
    const cfg = resolveTurnstile();
    // Captcha desligado ou sem chave configurada: não bloqueia o acesso.
    if (!cfg.enabled) return { ok: true as const, skipped: true as const };

    const body = new URLSearchParams({ secret: cfg.secretKey, response: data.token });
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
 * Diagnóstico do Turnstile para o painel de integrações:
 * mostra o modo ativo, chaves mascaradas e testa a secret na Cloudflare.
 */
export const testTurnstileKeys = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveTurnstile, maskKey, TURNSTILE_KEY_RE } = await import("./captcha.server");
  const cfg = resolveTurnstile();

  const info = {
    mode: cfg.mode,
    usingCloudflareTestKeys: cfg.usingCloudflareTestKeys,
    siteKeyMasked: maskKey(cfg.siteKey),
    secretKeyMasked: maskKey(cfg.secretKey),
    productionKeysSet: Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY),
  };

  const checks = {
    siteKeySet: cfg.siteKey.length > 0,
    secretSet: cfg.secretKey.length > 0,
    siteKeyFormat: TURNSTILE_KEY_RE.test(cfg.siteKey),
    secretKeyFormat: TURNSTILE_KEY_RE.test(cfg.secretKey),
  };

  if (cfg.mode === "off") {
    return { ok: true, message: "Captcha desligado (TURNSTILE_MODE=off).", checks, ...info };
  }

  if (!checks.siteKeySet || !checks.secretSet) {
    return { ok: false, message: "Chaves não configuradas para este modo.", checks, ...info };
  }

  if (!checks.siteKeyFormat || !checks.secretKeyFormat) {
    return {
      ok: false,
      message:
        "Formato das chaves parece inválido. Site key e secret key devem começar com 0x, 1x ou 3x.",
      checks,
      ...info,
    };
  }

  const body = new URLSearchParams({ secret: cfg.secretKey, response: "dummy-token" });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    const errors = json["error-codes"] ?? [];
    if (errors.includes("invalid-input-secret")) {
      return {
        ok: false,
        message: "Secret key rejeitada pela Cloudflare (invalid-input-secret).",
        checks,
        errors,
        ...info,
      };
    }
    if (errors.includes("bad-request")) {
      return { ok: false, message: "Requisição mal formada. Verifique a secret key.", checks, errors, ...info };
    }
    return {
      ok: true,
      message: "Chaves válidas e reconhecidas pela Cloudflare.",
      checks,
      errors,
      ...info,
    };
  } catch (err) {
    return { ok: false, message: "Erro de rede ao testar chaves.", checks, error: String(err), ...info };
  }
});
