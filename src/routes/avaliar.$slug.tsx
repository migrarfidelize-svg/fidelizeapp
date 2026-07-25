import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { PublicRatingBlock } from "@/components/PublicRatingBlock";
import { getPublicReviewForm, getPublicReviewsList } from "@/lib/public-reviews.functions";
import { useChannelPageView } from "@/lib/tracking";
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
    const { applySeoCacheHeaders } = await import("@/lib/seo-cache.server");
    applySeoCacheHeaders({
      version: [
        (d.est as any)?.updated_at,
        (d.est as any)?.logo_url,
        (d.stats as any)?.count,
        (d.stats as any)?.avg,
      ],
    });
    return d;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Avaliar — Fidelize" }, { name: "robots", content: "noindex" }] };
    const url = `https://fidelizeapp.lovable.app/avaliar/${params.slug}`;
    const stats = loaderData.stats;
    const avgTxt = stats && stats.count > 0 ? ` · ${stats.avg.toFixed(1)}★ (${stats.count} avaliações)` : "";
    const title = `Avaliar ${loaderData.est.name}${avgTxt}`;
    const desc = loaderData.est.description?.trim()
      ? `${loaderData.est.description.trim().slice(0, 140)} — deixe sua avaliação em menos de 30 segundos.`
      : `Como foi seu atendimento em ${loaderData.est.name}? Sua opinião ajuda a melhorar. Leva menos de 30 segundos.`;
    const img = loaderData.est.logo_url && /^https?:\/\//i.test(loaderData.est.logo_url) ? loaderData.est.logo_url : null;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        ...(img ? [
          { property: "og:image", content: img },
          { name: "twitter:image", content: img },
        ] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: Page,
  notFoundComponent: () => <div className="grid min-h-dvh place-items-center text-muted-foreground">Página não encontrada.</div>,
});

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-cyan-400 text-cyan-400" : "text-white/15"}`} />
      ))}
    </div>
  );
}

function ReviewsSectionHeader() {
  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
        Avaliações Recentes
      </span>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
    </div>
  );
}

function ReviewSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-white/5 bg-[#0b0b0e]/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/5" />
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="h-3 w-20 rounded bg-white/5" />
          </div>
        </div>
        <div className="h-2.5 w-16 rounded bg-white/5" />
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="h-3 w-11/12 rounded bg-white/5" />
        <div className="h-3 w-2/3 rounded bg-white/5" />
      </div>
    </div>
  );
}

function ReviewsEmptyState({ accent }: { accent: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/5 bg-[#0b0b0e]/60 px-6 py-10 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{ background: `radial-gradient(300px 120px at 50% 0%, ${accent}, transparent 70%)` }}
      />
      <div
        className="relative mx-auto grid h-12 w-12 place-items-center rounded-full border"
        style={{ borderColor: `${accent}40`, background: `${accent}12` }}
      >
        <Star className="h-6 w-6" style={{ color: accent }} />
      </div>
      <h3 className="relative mt-4 text-sm font-semibold text-white">
        Ainda não há avaliações por aqui
      </h3>
      <p className="relative mx-auto mt-1 max-w-xs text-xs text-gray-400">
        Seja a primeira pessoa a compartilhar sua experiência — sua opinião ajuda outros clientes.
      </p>
    </div>
  );
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}

function Page() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const { data: reviews, isLoading: reviewsLoading } = useQuery(listOpts(slug));
  const d = data!;
  const est = d.est;
  const accent = est.primary_color || "#00ffff";
  useChannelPageView(slug, "reviews");

  return (
    <div
      className="min-h-dvh bg-[#050505] text-gray-200 antialiased"
      style={{
        backgroundImage: `
          radial-gradient(900px 380px at 50% -8%, ${accent}22, transparent 60%),
          radial-gradient(600px 300px at 100% 100%, #ff00ff11, transparent 60%),
          linear-gradient(#050505,#050505)
        `,
      }}
    >
      {/* Subtle circuit grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,255,.35) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black 40%, transparent 80%)",
        }}
      />

      <div className="relative mx-auto max-w-xl px-4 pb-20 pt-10">
        {/* Header */}
        <header className="text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1"
            style={{ borderColor: `${accent}33`, background: `${accent}12` }}
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>
              Portal de Avaliação
            </span>
          </div>

          {est.logo_url ? (
            <div className="mx-auto mt-5 grid h-20 w-20 place-items-center rounded-2xl border border-white/10 bg-black/40 p-1 shadow-[0_0_30px_rgba(0,255,255,0.15)]">
              <img src={est.logo_url} alt={est.name} className="h-full w-full rounded-xl object-cover" />
            </div>
          ) : null}

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">{est.name}</h1>
          <p className="mt-1 text-sm text-gray-400">Deixe sua avaliação para nos ajudar a melhorar</p>
        </header>

        {/* Rating card */}
        <section
          className="relative mt-8 overflow-hidden rounded-2xl border border-white/5 bg-[#0b0b0e]/90 p-6 shadow-2xl backdrop-blur sm:p-8"
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{ background: `linear-gradient(90deg, ${accent}, #ff00ff)` }}
          />
          <div
            aria-hidden
            className="absolute -inset-px rounded-2xl opacity-[0.08]"
            style={{ background: `radial-gradient(400px 120px at 50% 0%, ${accent}, transparent 70%)` }}
          />
          <div className="relative">
            {d.form ? (
              <PublicRatingBlock slug={slug} source="direct_url" />
            ) : (
              <div className="rounded-xl border border-white/5 bg-black/30 p-8 text-center text-gray-400">
                Este estabelecimento ainda não ativou avaliações públicas.
              </div>
            )}
          </div>
        </section>

        {/* Reviews list */}
        {d.form && (
          <section className="mt-12">
            <ReviewsSectionHeader />

            {reviewsLoading ? (
              <div className="space-y-4" aria-busy="true" aria-label="Carregando avaliações">
                <ReviewSkeleton />
                <ReviewSkeleton />
                <ReviewSkeleton />
              </div>
            ) : !reviews || reviews.length === 0 ? (
              <ReviewsEmptyState accent={accent} />
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <article
                    key={r.id}
                    className="group relative rounded-xl border border-white/5 bg-[#0b0b0e]/60 p-5 transition hover:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="grid h-9 w-9 place-items-center rounded-lg border font-mono text-[11px] font-bold"
                          style={{ borderColor: `${accent}40`, background: `${accent}12`, color: accent }}
                        >
                          {initials(r.author)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{r.author}</div>
                          <div className="mt-1"><Stars n={r.rating} /></div>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                        {formatDate(r.created_at)}
                      </span>
                    </div>

                    {r.comment && (
                      <p className="mt-3 text-sm leading-relaxed text-gray-400">{r.comment}</p>
                    )}

                    {r.merchant_reply && (
                      <div className="mt-4 rounded-lg border-l-2 border-fuchsia-500/60 bg-fuchsia-500/[0.04] py-3 pl-4 pr-3">
                        <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">
                          Resposta de {est.name}
                          {r.merchant_reply_at ? ` · ${formatDate(r.merchant_reply_at)}` : ""}
                        </div>
                        <p className="mt-1 text-sm italic text-gray-400">{r.merchant_reply}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <div className="mt-14 flex items-center justify-center gap-2 opacity-40">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Powered by</span>
          <span className="font-mono text-xs font-black tracking-tighter" style={{ color: accent }}>
            FIDELIZE
          </span>
        </div>
      </div>
    </div>
  );
}
