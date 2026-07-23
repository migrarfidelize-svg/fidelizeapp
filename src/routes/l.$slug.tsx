import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect legado — QR codes já impressos apontando para /l/:slug continuam
// funcionando ao serem redirecionados para o novo caminho /cartao/:slug.
export const Route = createFileRoute("/l/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/cartao/$slug", params: { slug: params.slug }, replace: true });
  },
});
