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
  Gift,
  ChevronDown,
  ImageIcon,
  PlayCircle,
  X,
} from "lucide-react";
import { getStampIcon } from "@/lib/stampIcons";
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
  const [showCampaigns, setShowCampaigns] = useState(false);

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

  const location = [est.address, est.city].filter(Boolean).join(" · ");
  const contactLinks: { icon: typeof Phone; label: string; url: string }[] = [];
  if (est.whatsapp) {
    const num = est.whatsapp.replace(/\D/g, "");
    contactLinks.push({ icon: MessageCircle, label: "WhatsApp", url: `https://wa.me/${num}` });
  }
  if (est.phone) contactLinks.push({ icon: Phone, label: est.phone, url: `tel:${est.phone}` });
  if (est.instagram) {
    const handle = est.instagram.replace(/^@/, "");
    contactLinks.push({ icon: Instagram, label: `@${handle}`, url: `https://instagram.com/${handle}` });
  }
  if (est.website) contactLinks.push({ icon: Globe, label: "Site", url: est.website });

  return (
    <div className="space-y-4 pb-6">
      <Link
        to="/carteira/descobrir"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar para descobrir
      </Link>

      <header
        className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-5"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
          style={{ background: brand }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-background text-lg font-black uppercase"
            style={{ color: brand }}
          >
            {est.logo_url ? (
              <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              est.name.slice(0, 2)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-black tracking-tight">
              {est.name}
            </h1>
            {location && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> <span className="truncate">{location}</span>
              </div>
            )}
            {est.business_hours && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> <span className="truncate">{est.business_hours}</span>
              </div>
            )}
            {est.description && (
              <p className="mt-2 text-sm text-muted-foreground">{est.description}</p>
            )}
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCampaigns((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
            style={{ background: brand }}
          >
            <Gift className="h-3.5 w-3.5" />
            {showCampaigns ? "Ocultar campanhas" : `Ver campanhas ativas${data.campaigns.length ? ` (${data.campaigns.length})` : ""}`}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showCampaigns ? "rotate-180" : ""}`}
            />
          </button>
          {contactLinks.map((c, i) => {
            const Icon = c.icon;
            return (
              <a
                key={`${c.url}-${i}`}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
              >
                <Icon className="h-3.5 w-3.5" /> {c.label}
              </a>
            );
          })}
        </div>
      </header>

      {showCampaigns && (
        <section className="space-y-3 rounded-3xl border border-border/60 bg-card/40 p-4">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4" style={{ color: brand }} />
            <h2 className="font-display text-sm font-bold uppercase tracking-widest">
              Campanhas ativas
            </h2>
          </div>
          {data.campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma campanha ativa no momento.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {data.campaigns.map((c) => {
                const Icon = getStampIcon(c.stamp_icon);
                const color = c.primary_color || brand;
                return (
                  <li
                    key={c.id}
                    className="flex gap-3 rounded-2xl border border-border/60 bg-background/40 p-3"
                  >
                    <div
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                      style={{ background: `${color}22`, color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="truncate font-display text-sm font-bold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        A cada <strong>{c.stamps_required}</strong> carimbos:{" "}
                        <span style={{ color }}>{c.reward_title}</span>
                      </div>
                      {c.reward_description && (
                        <p className="text-[11px] text-muted-foreground">
                          {c.reward_description}
                        </p>
                      )}
                      {c.rules && (
                        <p className="text-[11px] text-muted-foreground/80">
                          <strong>Regras:</strong> {c.rules}
                        </p>
                      )}
                      {(c.stamp_validity_days || c.reward_validity_days) && (
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                          {c.stamp_validity_days
                            ? `Carimbo vale ${c.stamp_validity_days}d`
                            : ""}
                          {c.stamp_validity_days && c.reward_validity_days ? " · " : ""}
                          {c.reward_validity_days
                            ? `Prêmio vale ${c.reward_validity_days}d`
                            : ""}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to="/carteira/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
            style={{ color: brand }}
          >
            Abrir meu cartão →
          </Link>
        </section>
      )}



      <div className="flex items-center gap-2 pt-1">
        <Megaphone className="h-4 w-4" style={{ color: brand }} />
        <h2 className="font-display text-sm font-bold uppercase tracking-widest">
          Promoções
        </h2>
      </div>

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
