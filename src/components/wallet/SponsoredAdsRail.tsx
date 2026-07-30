import { useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Sparkles } from "lucide-react";
import { getDiscoverySponsoredAds, trackSponsoredAdEvent } from "@/lib/sponsored-ads-public.functions";
import { getAdSessionId, type DestinationType } from "@/lib/sponsored-ads-core";

const ROUTE_BY_DESTINATION: Record<DestinationType, string> = {
  establishment: "/carteira/e/$slug",
  catalog: "/catalogo/$slug",
  menu: "/cardapio/$slug",
  linktree: "/links/$slug",
  loyalty_card: "/cartao/$slug",
};

type Ad = Awaited<ReturnType<typeof getDiscoverySponsoredAds>>[number];

/**
 * Slots patrocinados da vitrine Descobrir.
 *
 * Sempre rotulados como "Patrocinado" e limitados pelas regras do servidor
 * (rotação, frequência por sessão e categorias liberadas).
 */
export function SponsoredAdsRail({ category }: { category?: string | null }) {
  const sessionId = useMemo(() => getAdSessionId(), []);
  const fetchAds = useServerFn(getDiscoverySponsoredAds);
  const track = useServerFn(trackSponsoredAdEvent);

  const { data } = useQuery({
    queryKey: ["sponsored-ads", category ?? "all"],
    queryFn: () => fetchAds({ data: { category: (category as any) ?? null, session_id: sessionId, limit: 3 } }),
    enabled: !!sessionId,
    staleTime: 60_000,
    retry: 0,
  });

  const ads = data ?? [];
  if (ads.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Patrocinado</div>
      <ul className="space-y-2.5">
        {ads.map((ad) => (
          <SponsoredCard
            key={ad.campaign_id}
            ad={ad}
            onImpression={() =>
              track({ data: { token: ad.tracking_token, event_type: "impression", session_id: sessionId, placement: "discover" } })
            }
            onClick={() =>
              track({ data: { token: ad.tracking_token, event_type: "click", session_id: sessionId, placement: "discover" } })
            }
          />
        ))}
      </ul>
    </section>
  );
}

function SponsoredCard({
  ad,
  onImpression,
  onClick,
}: {
  ad: Ad;
  onImpression: () => void;
  onClick: () => void;
}) {
  const ref = useRef<HTMLLIElement | null>(null);
  const seen = useRef(false);

  // Impressão só conta quando o card aparece de fato na tela.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !seen.current) {
            seen.current = true;
            void onImpression();
            io.disconnect();
          }
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onImpression]);

  const brand = ad.establishment_primary_color || "hsl(var(--primary))";
  const to = ROUTE_BY_DESTINATION[ad.destination_type as DestinationType] ?? ROUTE_BY_DESTINATION.establishment;

  return (
    <li
      ref={ref}
      className="group overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.07] to-transparent transition-all hover:border-primary/50"
    >
      <Link to={to} params={{ slug: ad.destination_slug }} onClick={() => void onClick()} className="relative flex items-center gap-3 p-3">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl"
          style={{ background: brand }}
        />
        <div
          className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background text-sm font-bold uppercase"
          style={{ color: brand }}
        >
          {ad.image_url ? (
            <img src={ad.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            ad.establishment_name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="truncate font-display text-sm font-semibold">{ad.title}</div>
            <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
              Patrocinado
            </span>
          </div>
          {ad.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{ad.description}</p>}
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
            <Sparkles className="h-3 w-3" /> {ad.cta_label}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
