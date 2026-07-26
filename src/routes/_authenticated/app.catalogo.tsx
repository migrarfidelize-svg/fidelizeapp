import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseGate } from "@/components/showcase/ShowcaseGate";

export const Route = createFileRoute("/_authenticated/app/catalogo")({
  component: () => <ShowcaseGate kind="catalog" />,
});
