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
