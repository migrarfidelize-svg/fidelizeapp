import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseCategories } from "@/components/showcase/ShowcaseCategories";

export const Route = createFileRoute("/_authenticated/app/cardapio/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias do Cardápio — Fidelize" },
      { name: "description", content: "Organize seu cardápio em seções com imagem de capa e destaques." },
    ],
  }),
  component: () => <ShowcaseCategories kind="menu" />,
});
