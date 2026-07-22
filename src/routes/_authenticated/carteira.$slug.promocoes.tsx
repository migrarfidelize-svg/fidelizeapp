import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listPublicPromotionsBySlug } from "@/lib/promotions.functions";
import {
  Megaphone,
  ChevronLeft,
  ExternalLink,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  MapPin,
  Phone,
  MessageCircle,
  Instagram,
  Globe,
  Clock,
  CreditCard,
} from "lucide-react";
import { WalletErrorState } from "@/components/wallet/WalletStates";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["public-promotions", slug],
    queryFn: () => listPublicPromotionsBySlug({ data: { slug } }),
    staleTime: 30_000,
  });

export const Route = createFileRoute("/_authenticated/carteira/$slug/promocoes")({
  ssr: false,
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.slug)),
  head: ({ params }) => ({
    meta: [
      { title: `Promoções — ${params.slug} — Carteira Fidelize` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PromotionsListPage,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

type Media = { path: string; type: "image" | "video"; url?: string | null };

function PromotionsListPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));

  if (!data.establishment) {
    return (
      <div className="space-y-4 pt-2">
        <Link
          to="/carteira/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
          <div className="font-display text-sm font-bold">Estabelecimento indisponível</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Este estabelecimento não está mais ativo na Fidelize.
          </p>
        </div>
      </div>
    );
  }

  const est = data.establishment;
  const brand = est.primary_color || "hsl(var(--primary))";
  const globalLinks = est.external_links ?? [];

  return (
    <div className="space-y-4 pb-6">
      <Link
        to="/carteira/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar para {est.name}
      </Link>

      <header className="flex items-center gap-3 pt-1">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background text-sm font-bold uppercase"
          style={{ color: brand }}
        >
          {est.logo_url ? (
            <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            est.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" style={{ color: brand }} />
            <h1 className="truncate font-display text-xl font-bold tracking-tight">
              Promoções de {est.name}
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Ofertas, novidades e links diretos do estabelecimento.
          </p>
        </div>
      </header>

      {globalLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {globalLinks.map((l, i) => (
            <a
              key={`${l.url}-${i}`}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
              style={{ color: brand }}
            >
              <ExternalLink className="h-3 w-3" /> {l.label}
            </a>
          ))}
        </div>
      )}

      {data.promotions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
          <Megaphone className="mx-auto mb-2 h-6 w-6 text-primary" />
          <div className="font-display text-sm font-bold">Sem promoções ativas agora</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Fique de olho — novas ofertas aparecem aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.promotions.map((p) => (
            <PromoCard key={p.id} promo={p} brand={brand} globalLinks={globalLinks} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PromoCard({
  promo,
  brand,
  globalLinks,
}: {
  promo: {
    id: string;
    title: string;
    body: string | null;
    media: Media[];
    external_links: { label: string; url: string }[];
    ends_at: string | null;
  };
  brand: string;
  globalLinks: { label: string; url: string }[];
}) {
  const [idx, setIdx] = useState(0);
  const media = promo.media.filter((m) => !!m.url);
  const current = media[idx];

  const combinedLinks = [
    ...promo.external_links,
    ...globalLinks.filter(
      (g) => !promo.external_links.some((p) => p.url === g.url),
    ),
  ];

  return (
    <li className="overflow-hidden rounded-3xl border border-border/60 bg-card/40 shadow-sm">
      {current && (
        <div className="relative aspect-video w-full bg-black">
          {current.type === "video" ? (
            <video
              src={current.url ?? undefined}
              className="h-full w-full object-contain"
              controls
              playsInline
            />
          ) : (
            <img
              src={current.url ?? undefined}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIdx((idx - 1 + media.length) % media.length)}
                className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                aria-label="Anterior"
              >
                <PrevIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIdx((idx + 1) % media.length)}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                aria-label="Próxima"
              >
                <NextIcon className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {media.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition ${
                      i === idx ? "bg-white" : "bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="space-y-3 p-4">
        <h2 className="font-display text-base font-bold" style={{ color: brand }}>
          {promo.title}
        </h2>
        {promo.body && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{promo.body}</p>
        )}
        {promo.ends_at && (
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Válido até {new Date(promo.ends_at).toLocaleDateString("pt-BR")}
          </p>
        )}
        {combinedLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {combinedLinks.map((l, i) => (
              <a
                key={`${l.url}-${i}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                style={{ background: brand }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
