import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { listPublicReviews } from "@/lib/reviews.functions";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

const opts = (slug: string) => queryOptions({
  queryKey: ["public-reviews", slug],
  queryFn: () => listPublicReviews({ data: { slug, limit: 50 } }),
});

export const Route = createFileRoute("/avaliacoes/$slug")({
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Avaliações — Fidelize" }, { name: "robots", content: "noindex" }] };
    const { est, stats } = loaderData;
    const title = `Avaliações de ${est.name} — ${stats.avg.toFixed(1)}★`;
    const desc = `${stats.count} avaliações reais de clientes de ${est.name}. Veja o que dizem sobre o atendimento.`;
    return { meta: [
      { title }, { name: "description", content: desc },
      { property: "og:title", content: title }, { property: "og:description", content: desc },
    ] };
  },
  component: Page,
  notFoundComponent: () => <div className="grid min-h-dvh place-items-center text-muted-foreground">Estabelecimento não encontrado.</div>,
});

function Stars({ n, size = 4 }: { n: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-${size} w-${size} ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

function Page() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const d = data!;
  const { est, reviews, stats } = d;

  return (
    <div className="min-h-dvh bg-background"
      style={{ background: `radial-gradient(1000px 400px at 50% -10%, ${est.primary_color}22, transparent 60%), hsl(var(--background))` }}>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-10">
        <header className="text-center">
          {est.logo_url && <img src={est.logo_url} alt={est.name} className="mx-auto h-20 w-20 rounded-2xl object-cover" />}
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{est.name}</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-2xl font-bold">{stats.avg.toFixed(1)}</span>
            <Stars n={Math.round(stats.avg)} size={5} />
            <span className="text-sm text-muted-foreground">({stats.count})</span>
          </div>
        </header>

        <section className="mt-8 space-y-3">
          {reviews.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Ainda não há avaliações públicas.</CardContent></Card>
          )}
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stars n={r.rating} />
                    <span className="text-sm font-semibold">{r.customer_name || "Cliente"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="text-sm">{r.comment}</p>}
                {r.reply && (
                  <div className="mt-2 rounded-lg border-l-4 p-3 text-sm" style={{ borderColor: est.primary_color, background: `${est.primary_color}10` }}>
                    <div className="mb-1 text-xs font-semibold" style={{ color: est.primary_color }}>Resposta de {est.name}</div>
                    {r.reply}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="mt-10 text-center text-xs text-muted-foreground">Powered by Fidelize</div>
      </div>
    </div>
  );
}
