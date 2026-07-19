import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { PublicRatingBlock } from "@/components/PublicRatingBlock";
import { getPublicReviewForm, getPublicReviewsList } from "@/lib/public-reviews.functions";
import { formatDate } from "@/lib/format";

const opts = (slug: string) => queryOptions({
  queryKey: ["public-review-form", slug],
  queryFn: () => getPublicReviewForm({ data: { slug } }),
});

const listOpts = (slug: string) => queryOptions({
  queryKey: ["public-reviews-list", slug],
  queryFn: () => getPublicReviewsList({ data: { slug, limit: 12 } }),
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

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-4 w-4 ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function Page() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const { data: reviews } = useQuery(listOpts(slug));
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

        {reviews && reviews.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">O que outros clientes disseram</h2>
            <div className="space-y-3">
              {reviews.map((r) => (
                <article key={r.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Stars n={r.rating} />
                      <span className="text-sm font-medium">{r.author}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-2 text-sm leading-relaxed">{r.comment}</p>}
                  {r.merchant_reply && (
                    <div className="mt-3 rounded-lg border-l-2 p-3" style={{ borderColor: est.primary_color, background: `${est.primary_color}10` }}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: est.primary_color }}>
                        Resposta de {est.name}{r.merchant_reply_at ? ` · ${formatDate(r.merchant_reply_at)}` : ""}
                      </div>
                      <p className="mt-1 text-sm">{r.merchant_reply}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 text-center text-xs text-muted-foreground">Powered by Fidelize</div>
      </div>
    </div>
  );
}
