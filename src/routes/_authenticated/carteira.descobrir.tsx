import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Compass,
  MapPin,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Tag,
  Search,
  ArrowLeft,
  X,
  RefreshCw,
  UtensilsCrossed,
  ShoppingBag,
  Scissors,
  HeartPulse,
  Shirt,
  Dumbbell,
  PawPrint,
  Wrench,
  PartyPopper,
  Navigation,
  type LucideIcon,
} from "lucide-react";
import { getDiscoveryEstablishments } from "@/lib/my-wallet.functions";
import { WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";
import { SponsoredAdsRail } from "@/components/wallet/SponsoredAdsRail";
import { DiscoverBanners } from "@/components/wallet/DiscoverBanners";
import { getDiscoverSettings } from "@/lib/discover.functions";
import { DEFAULT_DISCOVER_SETTINGS, formatDistance } from "@/lib/discover";
import {
  DISCOVER_CATEGORIES,
  CATEGORY_BY_ID,
  CATEGORY_ICON_NAME,
  categorizeEstablishment,
  type DiscoverCategoryId,
} from "@/lib/discover-categories";

// Lista aberta a todos os estabelecimentos ativos — sem distinção de plano.
// Revalidamos sempre ao abrir para que parceiros recém-criados apareçam na hora.
type GeoQuery = { lat?: number; lng?: number; radiusKm?: number; city?: string | null };

const ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Scissors,
  HeartPulse,
  Shirt,
  Dumbbell,
  PawPrint,
  Wrench,
  PartyPopper,
  Sparkles,
};

const buildOpts = (geo: GeoQuery) =>
  queryOptions({
    queryKey: ["discovery-establishments", geo.lat ?? null, geo.lng ?? null, geo.radiusKm ?? null, geo.city ?? null],
    queryFn: () => getDiscoveryEstablishments({ data: geo }),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

const opts = buildOpts({});

export const Route = createFileRoute("/_authenticated/carteira/descobrir")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  head: () => ({
    meta: [
      { title: "Descobrir estabelecimentos — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscoverPage,
  pendingComponent: () => <RouteLoading label="Carregando estabelecimentos…" fullscreen={false} />,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

type GeoState = "idle" | "asking" | "granted" | "denied" | "unsupported";

/** Normaliza cidade para comparação tolerante (case + acentos + espaços). */
function normalizeCity(s: string | null | undefined) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function DiscoverPage() {
  const qc = useQueryClient();
  const base = useSuspenseQuery(opts);
  const [geo, setGeo] = useState<GeoState>(() => {
    if (typeof window === "undefined") return "idle";
    return (localStorage.getItem("wallet:geo") as GeoState) || "idle";
  });
  const [myCity, setMyCity] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("wallet:geo:city") || "";
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("wallet:geo:coords");
      return raw ? (JSON.parse(raw) as { lat: number; lng: number }) : null;
    } catch {
      return null;
    }
  });
  const [radiusKm, setRadiusKm] = useState<number>(() => {
    if (typeof window === "undefined") return 30;
    return Number(localStorage.getItem("wallet:geo:radius")) || 30;
  });
  const [locating, setLocating] = useState(false);
  const [active, setActive] = useState<DiscoverCategoryId | "promo" | "perto" | "todos" | null>(null);
  const [query, setQuery] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["discover-settings"],
    queryFn: () => getDiscoverSettings(),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const settings = settingsQuery.data ?? DEFAULT_DISCOVER_SETTINGS;

  const hasGeo = !!coords;
  const geoList = useQuery({
    ...buildOpts(hasGeo ? { lat: coords!.lat, lng: coords!.lng, radiusKm, city: myCity || null } : {}),
    enabled: hasGeo,
  });
  const data = (hasGeo ? geoList.data ?? [] : base.data) ?? [];

  useEffect(() => {
    if (coords) localStorage.setItem("wallet:geo:coords", JSON.stringify(coords));
  }, [coords]);

  useEffect(() => {
    localStorage.setItem("wallet:geo:radius", String(radiusKm));
  }, [radiusKm]);

  useEffect(() => {
    if (geo === "granted" || geo === "denied" || geo === "unsupported") {
      localStorage.setItem("wallet:geo", geo);
    }
  }, [geo]);

  useEffect(() => {
    if (myCity) localStorage.setItem("wallet:geo:city", myCity);
  }, [myCity]);

  // Se acabamos de conceder e ainda não temos cidade/coordenadas, resolvemos.
  useEffect(() => {
    if (geo !== "granted" || (myCity && coords) || typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          if (!cancelled) setCoords({ lat: latitude, lng: longitude });
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=pt-BR`,
            { headers: { Accept: "application/json" } },
          );
          const j = (await res.json()) as {
            address?: { city?: string; town?: string; village?: string; municipality?: string };
          };
          const city = j.address?.city || j.address?.town || j.address?.village || j.address?.municipality || "";
          if (!cancelled) setMyCity(city);
        } catch {
          /* silêncio — mantemos a lista base */
        } finally {
          if (!cancelled) setLocating(false);
        }
      },
      () => {
        if (!cancelled) setLocating(false);
      },
      { timeout: 8000, maximumAge: 5 * 60_000 },
    );
    return () => {
      cancelled = true;
    };
  }, [geo, myCity, coords]);

  function askGeo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("unsupported");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo("granted");
      },
      () => setGeo("denied"),
      { timeout: 8000 },
    );
  }

  const myCityNorm = normalizeCity(myCity);
  const sorted = useMemo(
    () =>
      [...data]
        .map((e) => ({ ...e, category: categorizeEstablishment(e) }))
        .sort((a, b) => {
          // 1) Mais perto primeiro quando temos distância real.
          if (a.distance_km != null && b.distance_km != null && a.distance_km !== b.distance_km) {
            return a.distance_km - b.distance_km;
          }
          // 2) Promoções ativas.
          const aPromo = a.has_promotion ? 1 : 0;
          const bPromo = b.has_promotion ? 1 : 0;
          if (aPromo !== bPromo) return bPromo - aPromo;
          // 3) Mesma cidade.
          if (myCityNorm) {
            const aMatch = normalizeCity(a.city) === myCityNorm ? 1 : 0;
            const bMatch = normalizeCity(b.city) === myCityNorm ? 1 : 0;
            if (aMatch !== bMatch) return bMatch - aMatch;
          }
          return Number(a.visited) - Number(b.visited);
        }),
    [data, myCityNorm],
  );

  const categories = useMemo(() => {
    const counts = new Map<DiscoverCategoryId, number>();
    for (const e of sorted) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return DISCOVER_CATEGORIES.filter((c) => (counts.get(c.id) ?? 0) > 0).map((c) => ({
      ...c,
      count: counts.get(c.id) ?? 0,
    }));
  }, [sorted]);

  const promoCount = sorted.filter((e) => e.has_promotion).length;
  const nearbyCount = myCityNorm ? sorted.filter((e) => normalizeCity(e.city) === myCityNorm).length : 0;

  const visible = useMemo(() => {
    const q = normalizeCity(query);
    return sorted.filter((e) => {
      if (active === "promo" && !e.has_promotion) return false;
      if (active === "perto" && normalizeCity(e.city) !== myCityNorm) return false;
      if (active && active !== "promo" && active !== "perto" && active !== "todos" && e.category !== active)
        return false;
      if (q) {
        const hay = normalizeCity(`${e.name} ${e.city ?? ""} ${e.description ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, active, query, myCityNorm]);

  const showList = !!active || query.trim().length > 0;
  const activeLabel =
    active === "promo"
      ? "Com promoção"
      : active === "perto"
      ? `Perto de você${myCity ? ` · ${myCity}` : ""}`
      : active && active !== "todos"
      ? CATEGORY_BY_ID.get(active)?.label ?? "Todos"
      : "Todos os lugares";

  const highlights = sorted.slice(0, 4);

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["discovery-establishments"] })}>
      <div className="space-y-6 pb-4">
        {/* Cabeçalho de localização */}
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pt-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
              <Compass className="h-3.5 w-3.5" /> Descobrir
            </div>
            <button
              onClick={() => (geo === "granted" ? undefined : askGeo())}
              className="mt-0.5 flex min-w-0 items-center gap-1.5"
            >
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate font-display text-lg font-extrabold tracking-tight">
                {locating ? "Detectando…" : myCity || (hasGeo ? "Sua região" : "Ativar localização")}
              </span>
              {geo !== "granted" && <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </button>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["discovery-establishments"] })}
            aria-label="Atualizar lista"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border/60 bg-card/60 text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
        </header>

        {/* Seletor de raio — sempre visível */}
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Raio</span>
          {settings.radiusOptions.map((km) => (
            <button
              key={km}
              onClick={() => {
                setRadiusKm(km);
                if (!hasGeo) askGeo();
              }}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                radiusKm === km && hasGeo
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {km} km
            </button>
          ))}
        </div>

        {geo !== "granted" && (
          <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/25 bg-gradient-to-br from-primary/12 via-accent/8 to-transparent p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <Navigation className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-base font-extrabold tracking-tight">Só o que está perto de você</div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ative a localização para ver apenas estabelecimentos dentro do raio escolhido.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={askGeo}
                    disabled={geo === "asking"}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95 disabled:opacity-60"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {geo === "asking" ? "Detectando…" : "Ativar localização"}
                  </button>
                  {geo !== "denied" && (
                    <button
                      onClick={() => setGeo("denied")}
                      className="text-[11px] font-semibold text-muted-foreground underline underline-offset-2"
                    >
                      Agora não
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Usada só para filtrar esta lista
            </div>
          </div>
        )}

        {/* Banners promocionais em slide */}
        <DiscoverBanners city={myCity} intervalMs={settings.bannerIntervalMs} />

        {hasGeo && (
          <p className="flex items-center gap-1.5 text-xs text-primary">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {locating
              ? "Detectando sua região…"
              : `Mostrando lugares num raio de ${radiusKm} km${myCity ? ` · ${myCity}` : ""}.`}
          </p>
        )}

        {/* Busca */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="Encontrar benefícios, lojas, cidades…"
            className="w-full rounded-2xl border border-border/60 bg-card/70 py-4 pl-12 pr-10 text-sm font-medium shadow-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-border/60 bg-card/40 p-8 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            <div className="font-display text-base font-extrabold">Nada dentro de {radiusKm} km</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Aumente o raio de busca acima para encontrar parceiros um pouco mais distantes.
            </p>
          </div>
        ) : (
          <>
            <SponsoredAdsRail
              category={active && active !== "promo" && active !== "perto" && active !== "todos" ? active : null}
            />

            {!showList ? (
              <div className="space-y-8">
                {/* Filtros inteligentes */}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setActive("promo")}
                    disabled={promoCount === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/70 py-3.5 text-xs font-bold shadow-sm transition-all active:scale-[0.97] disabled:opacity-40"
                  >
                    <Tag className="h-4 w-4 text-primary" /> Promoções · {promoCount}
                  </button>
                  <button
                    onClick={() => setActive("perto")}
                    disabled={nearbyCount === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/70 py-3.5 text-xs font-bold shadow-sm transition-all active:scale-[0.97] disabled:opacity-40"
                  >
                    <Navigation className="h-4 w-4 text-primary" /> Perto · {nearbyCount}
                  </button>
                </div>

                {/* Categorias com ícones premium */}
                <section>
                  <div className="mb-4 flex items-end justify-between">
                    <h2 className="font-display text-lg font-extrabold tracking-tight">Categorias</h2>
                    <button
                      onClick={() => setActive("todos")}
                      className="text-[10px] font-black uppercase tracking-widest text-primary"
                    >
                      Ver todas
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {categories.map((c) => {
                      const Icon = ICONS[CATEGORY_ICON_NAME[c.id]] ?? Sparkles;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setActive(c.id)}
                          className="group flex flex-col items-center gap-2"
                        >
                          <span className="grid h-16 w-16 place-items-center rounded-[1.25rem] border border-border/60 bg-card/70 text-primary shadow-sm transition-all group-hover:border-primary/40 group-active:scale-90">
                            <Icon className="h-7 w-7" strokeWidth={1.6} />
                          </span>
                          <span className="text-center text-[11px] font-bold leading-tight text-muted-foreground">
                            {c.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Destaques na região */}
                <section className="space-y-4">
                  <div className="flex items-end justify-between">
                    <h2 className="font-display text-lg font-extrabold tracking-tight">Destaques na região</h2>
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {sorted.length} locais
                    </span>
                  </div>
                  {highlights.map((e) => (
                    <DiscoverCard key={e.id} e={e} nearby={!!myCityNorm && normalizeCity(e.city) === myCityNorm} />
                  ))}
                </section>

                <button
                  onClick={() => setActive("todos")}
                  className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/50 px-5 py-4 text-sm font-bold transition-colors hover:border-primary/40"
                >
                  Ver todos os {sorted.length} estabelecimentos
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActive(null);
                      setQuery("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-border/60 bg-card/60 px-3.5 py-2 text-xs font-bold transition-colors hover:border-primary/40"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                  </button>
                  <span className="truncate text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {activeLabel} · {visible.length}
                  </span>
                </div>

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((c) => {
                    const Icon = ICONS[CATEGORY_ICON_NAME[c.id]] ?? Sparkles;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setActive(c.id)}
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                          active === c.id
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : "border border-border/60 bg-card/60 text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {c.label}
                      </button>
                    );
                  })}
                </div>

                {visible.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-border/60 bg-card/40 p-8 text-center">
                    <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
                    <div className="font-display text-sm font-extrabold">Nenhum resultado</div>
                    <p className="mt-1 text-xs text-muted-foreground">Tente outra categoria ou busca.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {visible.map((e) => (
                      <DiscoverCard key={e.id} e={e} nearby={!!myCityNorm && normalizeCity(e.city) === myCityNorm} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </WithOfflineFallback>
  );
}

type CardEstablishment = {
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  address: string | null;
  city: string | null;
  description: string | null;
  distance_km?: number | null;
  visited: boolean;
  has_promotion: boolean;
  has_menu: boolean;
  has_catalog: boolean;
};

function DiscoverCard({ e, nearby }: { e: CardEstablishment; nearby?: boolean }) {
  const brand = e.primary_color || "hsl(var(--primary))";
  const distance = formatDistance(e.distance_km);
  const location = [e.address, e.city].filter(Boolean).join(" · ");

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/70 p-5 shadow-sm transition-all hover:border-primary/40 active:scale-[0.99]">
      <div className="flex gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-background text-base font-black uppercase"
          style={{ color: brand }}
        >
          {e.logo_url ? (
            <img src={e.logo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            e.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <h3 className="truncate font-display text-base font-extrabold tracking-tight">{e.name}</h3>
            {distance && (
              <span className="shrink-0 rounded-xl bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                {distance}
              </span>
            )}
          </div>
          {location && (
            <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-semibold text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {e.has_promotion && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-300">
                <Tag className="h-2.5 w-2.5" /> Promoção
              </span>
            )}
            {nearby && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-accent">
                <Navigation className="h-2.5 w-2.5" /> Na sua cidade
              </span>
            )}
            {!e.visited ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/12 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary">
                <Sparkles className="h-2.5 w-2.5" /> Novo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                Visitado
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <Link
          to="/carteira/e/$slug"
          params={{ slug: e.slug }}
          className="grid place-items-center rounded-2xl bg-primary py-3.5 text-[11px] font-black uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.97]"
        >
          Ver estabelecimento
        </Link>
        <div className="flex gap-2">
          {e.has_menu && (
            <Link
              to="/cardapio/$slug"
              params={{ slug: e.slug }}
              aria-label="Ver cardápio"
              className="grid h-full w-12 place-items-center rounded-2xl border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <UtensilsCrossed className="h-5 w-5" />
            </Link>
          )}
          {e.has_catalog && (
            <Link
              to="/catalogo/$slug"
              params={{ slug: e.slug }}
              aria-label="Ver catálogo"
              className="grid h-full w-12 place-items-center rounded-2xl border border-border/60 bg-background/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ShoppingBag className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
