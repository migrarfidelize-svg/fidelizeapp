import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseOverview } from "@/components/showcase/ShowcaseOverview";

export const Route = createFileRoute("/_authenticated/app/cardapio/")({
  head: () => ({
    meta: [
      { title: "Cardápio Virtual — Fidelize" },
      { name: "description", content: "Crie um cardápio digital moderno em Stories ou Lista para o seu restaurante." },
    ],
  }),
  component: () => <ShowcaseOverview kind="menu" />,
});
