import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseItems } from "@/components/showcase/ShowcaseItems";

export const Route = createFileRoute("/_authenticated/app/cardapio/pratos")({
  head: () => ({
    meta: [
      { title: "Pratos do Cardápio — Fidelize" },
      { name: "description", content: "Cadastre pratos com foto, vídeo vertical, preço, ingredientes e badges dietéticos." },
    ],
  }),
  component: () => <ShowcaseItems kind="menu" />,
});
