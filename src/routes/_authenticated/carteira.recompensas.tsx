import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/carteira/recompensas")({
  beforeLoad: () => {
    throw redirect({ to: "/carteira/premios", search: { tab: "recompensas" }, replace: true });
  },
});
