import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDiscoverBanners } from "@/lib/discover.functions";
import type { DiscoverBanner } from "@/lib/discover";

/**
 * Carrossel de banners do Descobrir (estilo iFood).
 * Conteúdo controlado pelo Super Admin em /hash/descobrir. Enquanto nenhum
 * banner estiver cadastrado, exibimos exemplos fictícios para o cliente já ver
 * a vitrine funcionando.
 */
const DEMO_BANNERS: DiscoverBanner[] = [
  {
    id: "demo-1",
    title: "Cafés artesanais com 3x mais carimbos",
    subtitle: "Somente esta semana nos parceiros da sua região",
    image_url: null,
    link_url: null,
    bg_color: null,
    text_color: null,
    cta_label: "Ver parceiros",
    active: true,
    sort_order: 0,
    starts_at: null,
    ends_at: null,
    city: null,
  },
  {
    id: "demo-2",
    title: "Complete 10 carimbos e ganhe um prêmio",
    subtitle: "Colecione cartões digitais sem perder nenhum papelzinho",
    image_url: null,
    link_url: null,
    bg_color: null,
    text_color: null,
    cta_label: "Como funciona",
    active: true,
    sort_order: 1,
    starts_at: null,
    ends_at: null,
    city: null,
  },
  {
    id: "demo-3",
    title: "Novos parceiros perto de você",
    subtitle: "Restaurantes, beleza e serviços entrando toda semana",
    image_url: null,
    link_url: null,
    bg_color: null,
    text_color: null,
    cta_label: "Descobrir agora",
    active: true,
    sort_order: 2,
    starts_at: null,
    ends_at: null,
    city: null,
  },
];

export function DiscoverBanners({ city, intervalMs = 6000 }: { city?: string | null; intervalMs?: number }) {
  const { data } = useQuery({
    queryKey: ["discover-banners", city ?? ""],
    queryFn: () => getDiscoverBanners({ data: { city: city ?? null } }),
    staleTime: 60_000,
    retry: false,
  });

  const banners = useMemo(() => {
    const rows = (data ?? []) as DiscoverBanner[];
    return rows.length ? rows : DEMO_BANNERS;
  }, [data]);

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

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[1.75rem]">
        <div
          className="flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((b) => (
            <BannerCard key={b.id} banner={b} />
          ))}
        </div>
      </div>

      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setIndex(i)}
              aria-label={`Ir para o banner ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1.5 bg-border"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BannerCard({ banner }: { banner: DiscoverBanner }) {
  const inner = (
    <div className="relative flex aspect-[16/8] w-full shrink-0 basis-full flex-col justify-between overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground shadow-xl shadow-primary/20">
      {banner.image_url && (
        <img
          src={banner.image_url}
          alt={banner.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {banner.image_url && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />}

      {/* Formas decorativas — vitrine iluminada */}
      {!banner.image_url && (
        <>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 right-4 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        </>
      )}

      <div className="relative z-10 space-y-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Destaque</span>
        <h3 className="font-display text-xl font-extrabold leading-tight drop-shadow-sm">{banner.title}</h3>
        {banner.subtitle && <p className="max-w-[85%] text-xs font-medium opacity-85">{banner.subtitle}</p>}
      </div>

      {banner.cta_label && (
        <span className="relative z-10 inline-flex w-fit items-center rounded-2xl border border-white/30 bg-white/20 px-5 py-2.5 text-[11px] font-black uppercase tracking-wider backdrop-blur-md">
          {banner.cta_label}
        </span>
      )}
    </div>
  );

  if (!banner.link_url) return <div className="w-full shrink-0 basis-full">{inner}</div>;
  const external = /^https?:\/\//i.test(banner.link_url);
  return (
    <a
      href={banner.link_url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="w-full shrink-0 basis-full"
    >
      {inner}
    </a>
  );
}
