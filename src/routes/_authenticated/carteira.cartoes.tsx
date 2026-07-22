import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/carteira/cartoes")({
  beforeLoad: () => {
    throw redirect({ to: "/carteira/premios", search: { tab: "cartoes" }, replace: true });
  },
});
