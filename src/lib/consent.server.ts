import { getRequest } from "@tanstack/react-start/server";

/** Versão vigente dos documentos legais — sincronizada com /privacidade e /termos. */
export const PRIVACY_VERSION = "2.0";
export const TERMS_VERSION = "2.0";

/**
 * Contexto probatório do aceite (LGPD art. 8º): quem aceitou, de onde e sob
 * qual versão do documento. Nunca grava dados além destes.
 */
export function consentContext(source: string) {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = getRequest().headers;
    ip =
      (h.get("cf-connecting-ip") ||
        h.get("x-forwarded-for")?.split(",")[0] ||
        h.get("x-real-ip") ||
        "").trim() || null;
    userAgent = (h.get("user-agent") || "").slice(0, 300) || null;
  } catch {
    // fora de contexto HTTP (build/prerender)
  }
  return {
    ip,
    user_agent: userAgent,
    privacy_version: PRIVACY_VERSION,
    terms_version: TERMS_VERSION,
    source,
    accepted_at: new Date().toISOString(),
  };
}
