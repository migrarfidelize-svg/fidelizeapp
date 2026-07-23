import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada: unificamos a página pública em /avaliar/$slug (que já embute
// formulário + feed). Mantemos este arquivo apenas como redirect 301 para
// preservar links antigos, QR codes impressos e SEO.
export const Route = createFileRoute("/avaliacoes/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/avaliar/$slug", params: { slug: params.slug }, replace: true });
  },
});
