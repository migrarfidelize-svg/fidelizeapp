import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { PublicRatingBlock } from "@/components/PublicRatingBlock";
import { getPublicReviewForm } from "@/lib/public-reviews.functions";

const opts = (slug: string) => queryOptions({
  queryKey: ["public-review-form", slug],
  queryFn: () => getPublicReviewForm({ data: { slug } }),
});

export const Route = createFileRoute("/avaliar/$slug")({
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Avaliar — Fidelize" }, { name: "robots", content: "noindex" }] };
    const title = `Avaliar ${loaderData.est.name}`;
    const desc = `Como foi seu atendimento em ${loaderData.est.name}? Sua opinião ajuda a melhorar.`;
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
    ] };
  },
  component: Page,
  notFoundComponent: () => <div className="grid min-h-dvh place-items-center text-muted-foreground">Página não encontrada.</div>,
});

function Page() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const d = data!;
  const est = d.est;

  return (
    <div className="min-h-dvh"
      style={{ background: `radial-gradient(1000px 400px at 50% -10%, ${est.primary_color}22, transparent 60%), hsl(var(--background))` }}>
      <div className="mx-auto max-w-xl px-4 pb-16 pt-10">
        <header className="text-center">
          {est.logo_url && <img src={est.logo_url} alt={est.name} className="mx-auto h-20 w-20 rounded-2xl object-cover" />}
          <h1 className="mt-3 text-2xl font-bold tracking-tight">{est.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Deixe sua avaliação</p>
        </header>

        <div className="mt-6">
          {d.form ? (
            <PublicRatingBlock slug={slug} source="direct_url" />
          ) : (
            <div className="rounded-xl border p-8 text-center text-muted-foreground">
              Este estabelecimento ainda não ativou avaliações públicas.
            </div>
          )}
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">Powered by Fidelize</div>
      </div>
    </div>
  );
}
