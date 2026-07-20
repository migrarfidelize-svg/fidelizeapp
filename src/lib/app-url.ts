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
  const fromEnv =
    process.env.PUBLISHED_APP_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VITE_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[app-url] PUBLIC_APP_URL não configurada — links absolutos podem quebrar.",
    );
  }
  return "http://localhost:8080";
}
