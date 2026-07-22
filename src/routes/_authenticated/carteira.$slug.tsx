import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyEstablishmentCard } from "@/lib/my-wallet.functions";
import { listPublicReviewsBySlug } from "@/lib/public-reviews.functions";
import { LoyaltyVoucher } from "@/components/LoyaltyVoucher";
import { formatDate } from "@/lib/format";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Instagram,
  MapPin,
  Navigation,
  Gift,
  Stamp as StampIcon,
  Trophy,
  Clock,
  Share2,
  Copy,
  Check,
  Star,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { ExpiredCardState, WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";
import { PushOptIn } from "@/components/PushOptIn";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


const opts = (slug: string) =>
  queryOptions({
    queryKey: ["my-wallet", slug],
    queryFn: () => getMyEstablishmentCard({ data: { slug } }),
    staleTime: 10_000,
  });

const reviewsOpts = (slug: string) =>
  queryOptions({
    queryKey: ["public-reviews", slug],
    queryFn: () => listPublicReviewsBySlug({ data: { slug, limit: 50 } }),
    staleTime: 60_000,
  });


export const Route = createFileRoute("/_authenticated/carteira/$slug")({
  ssr: false,
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${(loaderData.establishment as { name: string }).name} — Minha carteira`
          : "Estabelecimento — Minha carteira",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletEstablishment,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
  notFoundComponent: () => (
    <div className="pt-10 text-center">
      <p className="text-sm text-muted-foreground">Você ainda não participa deste programa.</p>
      <Link to="/carteira" className="mt-4 inline-block text-sm text-primary underline">
        ← Voltar para minha carteira
      </Link>
    </div>
  ),
});

function relativeTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `há ${days} d`;
  return formatDate(iso);
}

function WalletEstablishment() {
  const qc = useQueryClient();
  const slug = Route.useParams().slug;
  const { data } = useSuspenseQuery(opts(slug));
  const [copied, setCopied] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const reviewsQuery = useQuery(reviewsOpts(slug));

  const d = data!;
  const est = d.establishment as {
    name: string;
    logo_url: string | null;
    primary_color: string;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    description: string | null;
    active: boolean;
  };

  const activeCards = (d.cards ?? []).filter(
    (c) => (c.campaign as { active: boolean }).active,
  );
  const primaryCard = activeCards[0] ?? d.cards?.[0];
  const req = primaryCard
    ? (primaryCard.campaign as { stamps_required: number }).stamps_required || 1
    : 1;
  const stamps = primaryCard?.stamps ?? 0;
  const campaignActive = primaryCard
    ? (primaryCard.campaign as { active: boolean }).active
    : true;

  const brand = est.primary_color || "hsl(var(--primary))";
  const mapsUrl = est.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(est.address)}`
    : null;
  const waDigits = est.whatsapp?.replace(/\D/g, "");

  const recent = d.recentStamps ?? [];
  const redeemed = d.redeemedRewards ?? [];
  const otherCards = activeCards.slice(1);

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-wallet", slug] })}>
      <div className="space-y-5 pb-6">
        <Link
          to="/carteira"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Minha carteira
        </Link>

        {/* Header enriquecido com halo da marca */}
        <header
          className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur"
          style={{ ["--brand" as never]: brand }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-3xl"
            style={{ background: brand }}
          />
          <div className="relative flex items-center gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted text-xl font-bold uppercase"
              style={{ color: brand }}
            >
              {est.logo_url ? (
                <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" />
              ) : (
                est.name.slice(0, 2)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold leading-tight">{est.name}</h1>
              {est.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{est.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <StampIcon className="h-3 w-3" /> {d.customer.visitsCount ?? 0} visitas
                </span>
                {redeemed.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Trophy className="h-3 w-3" /> {redeemed.length} resgatado{redeemed.length > 1 ? "s" : ""}
                  </span>
                )}
                {d.customer.lastVisitAt && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {relativeTime(d.customer.lastVisitAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ações rápidas */}
          {(mapsUrl || waDigits || est.phone) && (
            <div className="relative mt-4 grid grid-cols-3 gap-2">
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border/50 bg-background/50 px-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Navigation className="h-4 w-4" />
                  Como chegar
                </a>
              )}
              {waDigits && (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border/50 bg-background/50 px-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              {est.phone && (
                <a
                  href={`tel:${est.phone}`}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-border/50 bg-background/50 px-2 py-2.5 text-[10px] font-bold uppercase tracking-widest text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Phone className="h-4 w-4" />
                  Ligar
                </a>
              )}
            </div>
          )}
        </header>

        {!est.active && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-300">
            Este estabelecimento está temporariamente indisponível. Os carimbos ficam salvos.
          </div>
        )}

        {primaryCard && !campaignActive ? (
          <ExpiredCardState establishmentName={est.name} />
        ) : primaryCard ? (
          <LoyaltyVoucher
            brandName={est.name}
            logoUrl={est.logo_url}
            campaignName={(primaryCard.campaign as { name: string }).name}
            customerName={d.customer.name}
            customerCode={d.customer.code}
            qrValue={
              typeof window !== "undefined"
                ? `${window.location.origin}/c/${d.customer.token}`
                : `/c/${d.customer.token}`
            }
            stamps={stamps}
            required={req}
            reward={(primaryCard.campaign as { reward_title: string }).reward_title}
            primary={
              (primaryCard.campaign as { primary_color: string | null }).primary_color ||
              est.primary_color
            }
            accent={(primaryCard.campaign as { accent_color: string | null }).accent_color || undefined}
            icon={(primaryCard.campaign as { stamp_icon: string }).stamp_icon}
            lastStampAt={primaryCard.updated_at}
          />
        ) : (
          <div className="rounded-3xl border border-dashed border-border/70 bg-card/30 p-6 text-center text-sm text-muted-foreground">
            Você ainda não possui carimbos aqui. Mostre seu QR Code no próximo atendimento.
          </div>
        )}

        {primaryCard && campaignActive && d.customer.token && (
          <PushOptIn token={d.customer.token} />
        )}

        {/* Outros programas nesta loja (cascata de prêmios) */}
        {otherCards.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Gift className="h-3.5 w-3.5" /> Outros programas desta loja
            </h2>
            <ul className="space-y-2.5">
              {otherCards.map((c) => {
                const camp = c.campaign as {
                  name: string;
                  stamps_required: number;
                  reward_title: string;
                  primary_color: string | null;
                };
                const reqN = camp.stamps_required || 1;
                const pct = Math.min(100, Math.round((c.stamps / reqN) * 100));
                const cardBrand = camp.primary_color || brand;
                return (
                  <li key={c.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{camp.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Prêmio: {camp.reward_title}
                        </p>
                      </div>
                      <span className="font-display text-sm font-bold text-primary">
                        {c.stamps}
                        <span className="text-xs text-muted-foreground">/{reqN}</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-border/60 bg-background/50">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: cardBrand }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Linha do tempo dos carimbos nesta loja */}
        {recent.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <StampIcon className="h-3.5 w-3.5" /> Últimos carimbos
            </h2>
            <ol className="relative space-y-3 pl-4">
              <div className="absolute bottom-1 left-1 top-1 w-px bg-border/60" aria-hidden />
              {recent.slice(0, 10).map((s) => (
                <li key={s.id} className="relative">
                  <span
                    className={
                      "absolute -left-3 top-1.5 h-2 w-2 rounded-full ring-2 ring-background " +
                      (s.reverted ? "bg-muted-foreground/40" : "bg-primary")
                    }
                    aria-hidden
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className={"text-sm " + (s.reverted ? "text-muted-foreground line-through" : "")}>
                      {s.campaignName ?? "Carimbo"}
                      {s.reverted && (
                        <span className="ml-1 text-[10px] uppercase tracking-widest">(estornado)</span>
                      )}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(s.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Histórico de recompensas resgatadas */}
        {redeemed.length > 0 && (
          <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Trophy className="h-3.5 w-3.5" /> Recompensas resgatadas
            </h2>
            <ul className="space-y-2">
              {redeemed.slice(0, 10).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{r.rewardTitle}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{r.campaignName}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDate(r.redeemedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Indicar esta loja — link contextualizado */}
        {d.customer.referralCode && (
          <ShareCardSection
            referralCode={d.customer.referralCode}
            establishmentName={est.name}
            copied={copied}
            onCopied={() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          />
        )}



        {primaryCard && (() => {
          const camp = primaryCard.campaign as {
            rules: string | null;
            stamp_validity_days: number | null;
            reward_validity_days: number | null;
            reward_description: string | null;
          };
          const hasAny = camp.rules || camp.stamp_validity_days || camp.reward_validity_days || camp.reward_description;
          if (!hasAny) return null;
          return (
            <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Regras do programa
              </h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {camp.stamp_validity_days ? (
                  <li className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    <span className="block font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Validade do carimbo</span>
                    <span className="mt-0.5 block text-sm font-semibold text-foreground">
                      {camp.stamp_validity_days} dias após emissão
                    </span>
                  </li>
                ) : null}
                {camp.reward_validity_days ? (
                  <li className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    <span className="block font-bold uppercase tracking-widest text-[10px] text-muted-foreground">Validade do prêmio</span>
                    <span className="mt-0.5 block text-sm font-semibold text-foreground">
                      {camp.reward_validity_days} dias após liberado
                    </span>
                  </li>
                ) : null}
              </ul>
              {camp.reward_description && (
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Sobre o prêmio: </span>
                  {camp.reward_description}
                </p>
              )}
              {camp.rules && (
                <p className="mt-3 whitespace-pre-line text-sm">{camp.rules}</p>
              )}
            </section>
          );
        })()}

        {/* Avaliações do estabelecimento */}
        <ReviewsSummary
          data={reviewsQuery.data}
          loading={reviewsQuery.isLoading}
          onOpen={() => setReviewsOpen(true)}
        />

        <ReviewsDialog
          open={reviewsOpen}
          onOpenChange={setReviewsOpen}
          establishmentName={est.name}
          data={reviewsQuery.data}
          isLoading={reviewsQuery.isLoading}
          isError={reviewsQuery.isError}
          error={reviewsQuery.error as Error | null}
          onRetry={() => reviewsQuery.refetch()}
        />



        {(est.address || est.instagram) && (
          <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Sobre a loja
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {est.address && (
                <li className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /> {est.address}
                </li>
              )}
              {est.instagram && (
                <li>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={`https://instagram.com/${est.instagram.replace(/^@/, "")}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <Instagram className="h-4 w-4 text-muted-foreground" /> @
                    {est.instagram.replace(/^@/, "")}
                  </a>
                </li>
              )}
            </ul>
          </section>
        )}
      </div>
    </WithOfflineFallback>
  );
}

function ShareCardSection({
  referralCode,
  establishmentName,
  copied,
  onCopied,
}: {
  referralCode: string;
  establishmentName: string;
  copied: boolean;
  onCopied: () => void;
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const buildUrl = (source: string) => {
    const params = new URLSearchParams({
      utm_source: source,
      utm_medium: "referral",
      utm_campaign: "wallet_share",
      utm_content: referralCode.toUpperCase(),
    });
    return `${origin}/r/${referralCode.toUpperCase()}?${params.toString()}`;
  };
  const displayUrl = `${origin || ""}/r/${referralCode.toUpperCase()}`;
  const shareText = `Vem carimbar comigo na ${establishmentName}! Use meu link e a gente ganha carimbo-bônus 🎁`;

  async function handleShare() {
    const url = buildUrl("native_share");
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: `Indicação — ${establishmentName}`, text: shareText, url });
        return;
      }
    } catch {
      /* usuário cancelou — segue para o fallback */
    }
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      onCopied();
      toast.success("Link copiado! Envie para um amigo.");
    } catch {
      toast.error("Não consegui copiar. Copie manualmente.");
    }
  }

  async function copyOnly() {
    try {
      await navigator.clipboard.writeText(buildUrl("copy_link"));
      onCopied();
      toast.success("Link copiado.");
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  function shareWhatsapp() {
    const url = buildUrl("whatsapp");
    const wa = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
    if (typeof window !== "undefined") window.open(wa, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Share2 className="h-3.5 w-3.5" /> Indicar esta loja
      </h2>
      <p className="text-xs text-muted-foreground">
        Compartilhe seu link. Quando um amigo se cadastrar por ele, vocês dois ganham carimbo-bônus.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-[11px] font-mono">
        <span className="min-w-0 truncate text-muted-foreground">{displayUrl}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={handleShare}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-[11px] font-black uppercase tracking-widest text-primary-foreground shadow-[0_0_16px_color-mix(in_oklab,var(--primary)_35%,transparent)] transition-transform active:scale-95"
        >
          <Share2 className="h-3.5 w-3.5" /> Enviar
        </button>
        <button
          onClick={shareWhatsapp}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
        >
          WhatsApp
        </button>
        <button
          onClick={copyOnly}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </section>

  );
}

type ReviewsData = Awaited<ReturnType<typeof listPublicReviewsBySlug>>;

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Nota ${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= full ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}

function ReviewsSummary({
  data,
  loading,
  onOpen,
}: {
  data: ReviewsData | undefined;
  loading: boolean;
  onOpen: () => void;
}) {
  if (loading) {
    return (
      <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
        <div className="h-14 animate-pulse rounded-xl bg-muted/40" />
      </section>
    );
  }
  if (!data || data.stats.count === 0) return null;
  const { avg, count } = data.stats;
  const showAvg = data.settings.show_average !== false;
  const showCount = data.settings.show_review_count !== false;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 text-left transition-colors hover:border-amber-400/50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-400/40 bg-amber-400/10">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {showAvg && <span className="font-display text-lg font-bold leading-none">{avg.toFixed(1)}</span>}
            <Stars value={avg} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {showCount ? `${count} avaliação${count > 1 ? "ões" : ""} · ` : ""}Toque para ler
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function ReviewsDialog({
  open,
  onOpenChange,
  establishmentName,
  data,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentName: string;
  data: ReviewsData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<import("@/lib/reviews-sort").SortMode>("recent");

  const rawReviews = data?.reviews ?? [];
  const filtered = filterByRating(rawReviews, ratingFilter);
  const visible = sortReviews(filtered, sortMode);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            Avaliações — {establishmentName}
          </DialogTitle>
          {data && data.stats.count > 0 && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-display text-sm font-bold text-foreground">{data.stats.avg.toFixed(1)}</span>
              <Stars value={data.stats.avg} size={12} />
              <span>· {data.stats.count} no total</span>
            </div>
          )}
          {(data?.reviews?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Filtrar por nota">
                <button
                  type="button"
                  onClick={() => setRatingFilter(null)}
                  aria-pressed={ratingFilter === null}
                  className={
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                    (ratingFilter === null
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground")
                  }
                >
                  Todas
                </button>
                {[5, 4, 3, 2, 1].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatingFilter(ratingFilter === n ? null : n)}
                    aria-pressed={ratingFilter === n}
                    aria-label={`Filtrar por ${n} estrela${n > 1 ? "s" : ""}`}
                    className={
                      "inline-flex items-center gap-0.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition-colors " +
                      (ratingFilter === n
                        ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
                        : "border-border/60 text-muted-foreground hover:text-foreground")
                    }
                  >
                    {n}
                    <Star className="h-3 w-3 fill-current" />
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1" role="group" aria-label="Ordenar avaliações">
                <button
                  type="button"
                  onClick={() => setSortMode("recent")}
                  aria-pressed={sortMode === "recent"}
                  className={
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                    (sortMode === "recent"
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground")
                  }
                >
                  Mais recentes
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("helpful")}
                  aria-pressed={sortMode === "helpful"}
                  className={
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                    (sortMode === "helpful"
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground")
                  }
                >
                  Mais úteis
                </button>
              </div>
            </div>
          )}
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div data-testid="reviews-loading" className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-border/60 bg-background/50 p-3">
                  <div className="mb-2 h-3 w-32 rounded bg-muted/50" />
                  <div className="h-3 w-20 rounded bg-muted/40" />
                  <div className="mt-3 h-3 w-full rounded bg-muted/40" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-muted/30" />
                </div>
              ))}
            </div>
          )}
          {!isLoading && isError && (
            <div
              role="alert"
              data-testid="reviews-error"
              className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-center"
            >
              <p className="text-sm font-semibold text-destructive">
                Não foi possível carregar as avaliações.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {error?.message ?? "Verifique sua conexão e tente novamente."}
              </p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted"
              >
                Tentar novamente
              </button>
            </div>
          )}
          {!isLoading && !isError && visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {rawReviews.length === 0
                ? "Ainda não há avaliações públicas."
                : "Nenhuma avaliação com esse filtro."}
            </p>
          )}
          {!isLoading && !isError && visible.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-border/60 bg-background/50 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{r.author || "Cliente"}</p>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatDate(r.submittedAt)}
                  </p>
                </div>
                <Stars value={r.rating ?? 0} />
              </div>
              {r.comment && (
                <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{r.comment}</p>
              )}
              {r.reply && (
                <div className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    Resposta da loja {r.replyAt ? `· ${formatDate(r.replyAt)}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">{r.reply}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

