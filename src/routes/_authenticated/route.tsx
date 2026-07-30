import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSettledSession } from "@/lib/session-ready";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Nenhuma página autenticada deve entrar em índice de busca ou cache de IA.
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow, noarchive, nosnippet" }],
  }),
  beforeLoad: async ({ location }) => {

    // Se o usuário estava tentando abrir /carteira, sinaliza para a tela
    // de login exibir apenas o fluxo de cliente final.
    const fromWallet = location.pathname === "/carteira" || location.pathname.startsWith("/carteira/");
    const authSearch = fromWallet ? ({ as: "customer" as const, source: "wallet" }) : undefined;
    try {
      // Aguarda a auth terminar de inicializar antes de decidir: redirecionar
      // durante a reidratação causa ping-pong /auth ↔ rota privada.
      const session = await getSettledSession();
      if (!session?.user) throw redirect({ to: "/auth", search: authSearch });
      return { user: session.user };
    } catch (e) {
      if (e && typeof e === "object" && ("isRedirect" in e || "to" in e)) throw e;
      throw redirect({ to: "/auth", search: authSearch });
    }
  },

  component: () => <Outlet />,
});

