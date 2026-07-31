import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { getPublicAppUrl } from "@/lib/app-url";

/** Origem canônica: host da requisição (VPS/domínio próprio) com fallback nas envs. */
function resolveBaseUrl(request: Request): string {
  try {
    const u = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") ?? u.host;
    const proto = request.headers.get("x-forwarded-proto") ?? (u.protocol === "http:" ? "http" : "https");
    if (host && !/localhost|127\.0\.0\.1/i.test(host)) return `${proto}://${host}`;
  } catch {}
  return getPublicAppUrl();
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const base = resolveBaseUrl(request);
        const body = `# Fidelize — regras de rastreamento
# Áreas privadas ficam fora do índice. A proteção real é a autenticação
# do servidor + meta robots noindex; este arquivo evita apenas que os
# buscadores gastem rastreio e exponham páginas internas nos resultados.

User-agent: *
Allow: /

# --- Áreas autenticadas (painel, admin, carteira do cliente) ---
Disallow: /app/
Disallow: /hash/
Disallow: /carteira/
Disallow: /lgpd

# --- Fluxos de conta ---
Disallow: /auth
Disallow: /onboarding

# --- Links de uso único / tokenizados (nunca devem ser indexados) ---
Disallow: /c/
Disallow: /r/
Disallow: /l/
Disallow: /invite/
Disallow: /cartao/
Disallow: /avaliar/

# --- Suporte e páginas transacionais ---
Disallow: /suporte/

# --- Endpoints de API, webhooks e internos ---
Disallow: /api/
Disallow: /dev/
Disallow: /preview-dock
Disallow: /preview-hero
Disallow: /baixar-migrator

# --- Parâmetros que geram conteúdo duplicado ---
Disallow: /*?dest=
Disallow: /*?token=
Disallow: /*?code=

# Páginas públicas indexáveis: /, /precos, /ajuda, /videos, /privacidade,
# /termos, /e/{slug}, /links/{slug}, /cardapio/{slug}, /catalogo/{slug}

Sitemap: ${base}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
