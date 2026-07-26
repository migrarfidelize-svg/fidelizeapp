import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseAppearance } from "@/components/showcase/ShowcaseAppearance";

export const Route = createFileRoute("/_authenticated/app/cardapio/aparencia")({
  head: () => ({
    meta: [
      { title: "Aparência do Cardápio — Fidelize" },
      { name: "description", content: "Escolha o tema, o fundo e o layout da vitrine pública do seu cardápio digital." },
    ],
  }),
  component: () => <ShowcaseAppearance kind="menu" />,
});
