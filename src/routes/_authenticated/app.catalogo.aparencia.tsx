import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseAppearance } from "@/components/showcase/ShowcaseAppearance";

export const Route = createFileRoute("/_authenticated/app/catalogo/aparencia")({
  head: () => ({
    meta: [
      { title: "Aparência do Catálogo — Fidelize" },
      { name: "description", content: "Escolha o tema, o fundo e o layout da vitrine pública do seu catálogo digital." },
    ],
  }),
  component: () => <ShowcaseAppearance kind="catalog" />,
});
