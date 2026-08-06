import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota legada: o editor de QR e materiais gráficos foi movido para /app/qr.
// Mantida apenas para redirecionar links, atalhos e PWAs antigos.
export const Route = createFileRoute("/_authenticated/app/avaliacoes/qr")({
  beforeLoad: () => {
    throw redirect({ to: "/app/qr", search: { dest: "reviews" }, replace: true });
  },
});
