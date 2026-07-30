import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const guardSchema = z.object({
  identifier: z.string().max(200).optional().nullable(),
  action: z.enum(["login", "signup"]),
  /** Honeypot invisível: qualquer conteúdo indica bot. */
  honeypot: z.string().max(500).optional().nullable(),
  /** Tempo entre abrir e enviar o formulário (ms). */
  elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
});

/**
 * Portão anti-bot para /auth: valida honeypot, tempo mínimo de preenchimento
 * e o rate limit por IP + identificador antes de chamar o provedor de auth.
 */
export const guardAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => guardSchema.parse(d))
  .handler(async ({ data }) => {
    const {
      checkAuthRateLimit,
      clientIpFromHeaders,
      normalizeIdentifier,
    } = await import("./auth-rate-limit.server");

    const req = getRequest();
    const ip = req?.headers ? clientIpFromHeaders(req.headers) : null;
    const identifier = normalizeIdentifier(data.identifier ?? null);

    // Honeypot preenchido ou envio instantâneo: trata como bot.
    if ((data.honeypot ?? "").trim() !== "" || (data.elapsedMs ?? 9999) < 1200) {
      const { recordAuthAttempt } = await import("./auth-rate-limit.server");
      await recordAuthAttempt({ ip, identifier, action: data.action, success: false });
      return {
        ok: false as const,
        reason: "bot" as const,
        message: "Não foi possível validar o envio. Recarregue a página e tente novamente.",
      };
    }

    const decision = await checkAuthRateLimit({ ip, identifier, action: data.action });
    if (!decision.allowed) {
      const minutes = Math.ceil(decision.retryAfterSeconds / 60);
      return {
        ok: false as const,
        reason: "rate_limited" as const,
        retryAfterSeconds: decision.retryAfterSeconds,
        message: `Muitas tentativas. Aguarde ${minutes} minuto(s) antes de tentar novamente.`,
      };
    }

    return { ok: true as const };
  });

/** Registra o resultado da tentativa (sucesso limpa a pressão do bloqueio). */
export const reportAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        identifier: z.string().max(200).optional().nullable(),
        action: z.enum(["login", "signup"]),
        success: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { recordAuthAttempt, clientIpFromHeaders, normalizeIdentifier } = await import(
      "./auth-rate-limit.server"
    );
    const req = getRequest();
    const ip = req?.headers ? clientIpFromHeaders(req.headers) : null;
    await recordAuthAttempt({
      ip,
      identifier: normalizeIdentifier(data.identifier ?? null),
      action: data.action,
      success: data.success,
    });
    return { ok: true as const };
  });
