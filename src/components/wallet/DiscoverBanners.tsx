import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDiscoverBanners } from "@/lib/discover.functions";
import type { DiscoverBanner } from "@/lib/discover";

/**
 * Carrossel de banners do Descobrir (estilo iFood).
 * Conteúdo 100% controlado pelo Super Admin em /hash/descobrir.
 */
export function DiscoverBanners({ city, intervalMs = 6000 }: { city?: string | null; intervalMs?: number }) {
  const { data } = useQuery({
    queryKey: ["discover-banners", city ?? ""],
    queryFn: () => getDiscoverBanners({ data: { city: city ?? null } }),
    staleTime: 60_000,
    retry: false,
  });

  const banners = useMemo(() => (data ?? []) as DiscoverBanner[], [data]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length < 2 || !intervalMs) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % banners.length), intervalMs);
    return () => clearInterval(t);
  }, [banners.length, intervalMs]);

  if (!banners.length) return null;

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + banners.length) % banners.length);

  return (
    <div className="relative -mx-1">
      <div className="overflow-hidden rounded-3xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b) => (
            <BannerCard key={b.id} banner={b} />
          ))}
        </div>
      </div>

      {banners.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Banner anterior"
            className="absolute left-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/70 p-1.5 text-foreground shadow-sm backdrop-blur transition-opacity hover:bg-background sm:block"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Próximo banner"
            className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/70 p-1.5 text-foreground shadow-sm backdrop-blur transition-opacity hover:bg-background sm:block"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mt-2 flex justify-center gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setIndex(i)}
                aria-label={`Ir para o banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BannerCard({ banner }: { banner: DiscoverBanner }) {
  const style = {
    background: banner.image_url
      ? undefined
      : banner.bg_color || "linear-gradient(120deg, hsl(var(--primary)/0.9), hsl(var(--accent)/0.85))",
    color: banner.text_color || undefined,
  } as const;

  const inner = (
    <div
      className="relative flex h-36 w-full shrink-0 basis-full items-end overflow-hidden rounded-3xl border border-border/50 sm:h-44"
      style={style}
    >
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt={banner.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="relative z-10 w-full bg-gradient-to-t from-black/70 via-black/25 to-transparent p-4">
        <div className="font-display text-base font-black text-white drop-shadow sm:text-lg">{banner.title}</div>
        {banner.subtitle && <p className="text-xs text-white/85">{banner.subtitle}</p>}
        {banner.cta_label && (
          <span className="mt-2 inline-flex rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-black">
            {banner.cta_label}
          </span>
        )}
      </div>
    </div>
  );

  if (!banner.link_url) return <div className="w-full shrink-0 basis-full px-1">{inner}</div>;
  const external = /^https?:\/\//i.test(banner.link_url);
  return (
    <a
      href={banner.link_url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="w-full shrink-0 basis-full px-1"
    >
      {inner}
    </a>
  );
}
