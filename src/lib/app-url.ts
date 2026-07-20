/**
 * Resolve a URL pública da aplicação para uso em server functions
 * (links em e-mails, webhooks, redirects). Ordem de precedência:
 *   1. PUBLISHED_APP_URL    (domínio publicado/canônico)
 *   2. PUBLIC_APP_URL       (produção — recomendado)
 *   3. APP_URL              (alias legado)
 *   4. VITE_APP_URL         (compartilhado com o cliente)
 *   5. http://localhost:8080 (fallback apenas em dev)
 *
 * Nunca fazer hardcode do domínio do projeto — configure via env.
 */
export function getPublicAppUrl(): string {
  const PUBLISHED_FALLBACK = "https://fidelizeapp.lovable.app";
  const isPreviewOrLocal = (u: string) =>
    /(-preview--|--[0-9a-f-]+\.lovable\.app|localhost|127\.0\.0\.1)/i.test(u);

  const candidates = [
    process.env.PUBLISHED_APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VITE_APP_URL,
  ].filter((v): v is string => !!v);

  // Prefer any candidate that is NOT a preview/local URL
  const canonical = candidates.find((u) => !isPreviewOrLocal(u));
  if (canonical) return canonical.replace(/\/+$/, "");

  // Known published domain fallback (avoids exposing preview URL in admin UI)
  if (process.env.NODE_ENV === "production") return PUBLISHED_FALLBACK;

  // Dev fallback
  return candidates[0]?.replace(/\/+$/, "") || "http://localhost:8080";
}
