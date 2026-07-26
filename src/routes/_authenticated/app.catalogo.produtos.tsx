import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseItems } from "@/components/showcase/ShowcaseItems";

export const Route = createFileRoute("/_authenticated/app/catalogo/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos do Catálogo — Fidelize" },
      { name: "description", content: "Cadastre produtos com foto, preço, SKU, marca, disponibilidade e link de compra." },
    ],
  }),
  component: () => <ShowcaseItems kind="catalog" />,
});
