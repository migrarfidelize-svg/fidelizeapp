import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/studio")({
  beforeLoad: () => {
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
