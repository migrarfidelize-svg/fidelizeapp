/**
 * Mapeia o destino escolhido no editor do QR para o caminho público
 * correspondente. Mantém em um único lugar a fonte da verdade que a UI e
 * o redirect `/api/public/r/qr/:slug/:dest` precisam concordar.
 */
export type QrDest = "reviews" | "linktree" | "landing";

export function qrDestinationPath(dest: QrDest): "avaliar" | "links" | "l" {
  if (dest === "linktree") return "links";
  if (dest === "landing") return "cartao";
  return "avaliar";
}

export function buildFidelizeUrl(origin: string, slug: string, dest: QrDest): string {
  return `${origin}/${qrDestinationPath(dest)}/${slug}`;
}
