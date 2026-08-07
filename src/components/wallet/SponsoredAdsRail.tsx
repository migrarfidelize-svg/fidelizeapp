import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDiscoverySponsoredAds, trackSponsoredAdEvent } from "@/lib/sponsored-ads-public.functions";
import { getAdSessionId, type DestinationType } from "@/lib/sponsored-ads-core";
import { SponsoredAdCard } from "@/components/SponsoredAdCard";

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
 * Utiliza o componente oficial SponsoredAdCard para garantir consistência visual
 * entre vitrine, editor e moderação.
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
    <section className="space-y-4">
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Em destaque</div>
      <div className="flex flex-col gap-4">
        {ads.map((ad) => (
          <AdWrapper
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
      </div>
    </section>
  );
}

function AdWrapper({
  ad,
  onImpression,
  onClick,
}: {
  ad: Ad;
  onImpression: () => void;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const seen = useRef(false);
  const navigate = useNavigate();

  // Rastreamento de impressão
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

  const to = ROUTE_BY_DESTINATION[ad.destination_type as DestinationType] ?? ROUTE_BY_DESTINATION.establishment;
  
  const handleAdClick = () => {
    onClick();
    // O destino precisa ser resolvido substituindo o $slug
    const path = to.replace("$slug", ad.destination_slug);
    navigate({ to: path });
  };

  return (
    <div ref={ref} onClick={handleAdClick} className="cursor-pointer active:scale-[0.99] transition-transform">
      <SponsoredAdCard
        model={(ad.display_model as any) || "sponsored_feed"}
        data={{
          id: ad.campaign_id,
          title: ad.title,
          description: ad.description || undefined,
          merchantName: ad.establishment_name,
          imageUrl: ad.image_url || "",
          originalPrice: ad.original_price_cents || undefined,
          fidelizePrice: ad.fidelize_price_cents || undefined,
          discountValue: ad.discount_value || undefined,
          benefitText: ad.benefit_text || undefined,
          ctaLabel: ad.cta_label || undefined,
          theme: (ad.theme as any) || "dark",
        }}
      />
    </div>
  );
}
