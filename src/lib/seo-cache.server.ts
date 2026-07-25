/**
 * SEO/OpenGraph cache helpers (server-only).
 *
 * Estratégia:
 *  - Edge/CDN: `s-maxage` curto + `stale-while-revalidate` longo
 *    → crawlers e visitantes recebem HTML pré-renderizado quase
 *      instantâneo; a próxima request revalida em background.
 *  - Browser: `max-age=0, must-revalidate` para nunca servir HTML
 *    velho a um usuário logado que acabou de editar título/mídia.
 *  - ETag por página baseada em `updated_at` → quando o merchant
 *    altera nome, descrição, capa/logo ou publica novo cardápio,
 *    o token muda e o cache do edge é invalidado naturalmente.
 *
 * Usar dentro de loaders/handlers de rotas públicas de conteúdo
 * (cardápio, avaliação, árvore de links, cartão). Import é
 * server-only — nunca chamar do client.
 */
import {
  setResponseHeader,
  getRequestHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";

export type SeoCacheOptions = {
  /** Tempo em segundos que o edge pode servir sem revalidar. Default 300 (5 min). */
  sMaxAge?: number;
  /** Janela adicional em que edge serve stale enquanto revalida. Default 86400 (1 dia). */
  staleWhileRevalidate?: number;
  /** Fontes de "versão" da página — updated_at, contadores, flags. */
  version: Array<string | number | Date | null | undefined>;
};

function hash(input: string): string {
  // FNV-1a 32-bit — determinístico, curto, sem deps.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Aplica Cache-Control + ETag na resposta SSR e trata `If-None-Match`
 * devolvendo 304 quando o conteúdo não mudou.
 *
 * Retorna `true` quando emitiu 304 — o loader pode encerrar cedo se
 * quiser, mas TanStack já respeita o status setado.
 */
export function applySeoCacheHeaders(opts: SeoCacheOptions): boolean {
  const sMaxAge = opts.sMaxAge ?? 300;
  const swr = opts.staleWhileRevalidate ?? 86400;

  const versionKey = opts.version
    .map((v) => {
      if (v == null) return "";
      if (v instanceof Date) return String(v.getTime());
      return String(v);
    })
    .join("|");

  const etag = `W/"seo-${hash(versionKey)}"`;

  try {
    setResponseHeader(
      "Cache-Control",
      `public, max-age=0, must-revalidate, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    );
    setResponseHeader("ETag", etag);
    setResponseHeader("Vary", "Accept-Encoding");
  } catch {
    // fora de contexto de request (build/prerender) — ignorar
    return false;
  }

  try {
    const inm = getRequestHeader("if-none-match");
    if (inm && inm === etag) {
      setResponseStatus(304);
      return true;
    }
  } catch {}

  return false;
}
