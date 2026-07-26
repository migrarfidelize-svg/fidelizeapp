import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseCategories } from "@/components/showcase/ShowcaseCategories";

export const Route = createFileRoute("/_authenticated/app/catalogo/colecoes")({
  head: () => ({
    meta: [
      { title: "Coleções do Catálogo — Fidelize" },
      { name: "description", content: "Organize sua loja em coleções com imagem de capa e destaques." },
    ],
  }),
  component: () => <ShowcaseCategories kind="catalog" />,
});
