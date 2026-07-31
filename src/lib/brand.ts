/**
 * Identidade visual da plataforma (logo do menu/cabeçalhos).
 * Browser-safe: apenas tipos, padrões e normalização.
 */
import logoLight from "@/assets/brand/fidelize-logo.png.asset.json";
import logoDark from "@/assets/brand/fidelize-logo-dark.png.asset.json";
import logoMark from "@/assets/brand/fidelize-mark.png.asset.json";

export type BrandIdentity = {
  /** Logo horizontal usada em fundos claros. */
  logoUrl: string;
  /** Logo horizontal usada em fundos escuros (tema dark). */
  logoDarkUrl: string;
  /** Símbolo quadrado usado quando o menu está colapsado / favicon interno. */
  markUrl: string;
  /** Texto alternativo acessível. */
  alt: string;
};

export const DEFAULT_BRAND: BrandIdentity = {
  logoUrl: logoLight.url,
  logoDarkUrl: logoDark.url,
  markUrl: logoMark.url,
  alt: "Fidelize",
};

/**
 * Só aceita URLs https absolutas ou caminhos internos.
 * Bloqueia `javascript:`, `data:` e afins (vetor de XSS ao renderizar em <img>/CSS).
 */
export function safeImageUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (!v) return fallback;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try {
    const u = new URL(v);
    if (u.protocol === "https:") return u.toString();
  } catch {
    /* url inválida */
  }
  return fallback;
}

export function normalizeBrand(raw: unknown): BrandIdentity {
  const d = (raw ?? {}) as Partial<BrandIdentity>;
  const light = safeImageUrl(d.logoUrl, DEFAULT_BRAND.logoUrl);
  return {
    logoUrl: light,
    // Se só uma versão for enviada, ela vale para os dois temas.
    logoDarkUrl: safeImageUrl(d.logoDarkUrl, d.logoUrl ? light : DEFAULT_BRAND.logoDarkUrl),
    markUrl: safeImageUrl(d.markUrl, d.logoUrl ? light : DEFAULT_BRAND.markUrl),
    alt: typeof d.alt === "string" && d.alt.trim() ? d.alt.trim().slice(0, 60) : DEFAULT_BRAND.alt,
  };
}

export const BRAND_CACHE_KEY = "fidelize.brand.v1";
