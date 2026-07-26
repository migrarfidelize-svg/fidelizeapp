import { createFileRoute } from "@tanstack/react-router";
import { ShowcaseOverview } from "@/components/showcase/ShowcaseOverview";

export const Route = createFileRoute("/_authenticated/app/catalogo/")({
  head: () => ({
    meta: [
      { title: "Catálogo Digital — Fidelize" },
      { name: "description", content: "Monte um catálogo digital para sua loja com coleções, fotos, preços e link de compra." },
    ],
  }),
  component: () => <ShowcaseOverview kind="catalog" />,
});
