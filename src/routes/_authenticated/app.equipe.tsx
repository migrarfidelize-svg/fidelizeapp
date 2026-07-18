import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/equipe")({
  head: () => ({ meta: [{ title: "Equipe — Fidelize" }] }),
  component: () => <Navigate to="/app/config" replace />,
});
