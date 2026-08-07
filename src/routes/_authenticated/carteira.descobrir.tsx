import { RouteLoading } from "@/components/RouteLoading";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Compass, MapPin, Sparkles, ChevronRight, ShieldCheck, Tag, Search, ArrowLeft, X, RefreshCw, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { getDiscoveryEstablishments } from "@/lib/my-wallet.functions";
import { WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";
import { SponsoredAdsRail } from "@/components/wallet/SponsoredAdsRail";
import {
  DISCOVER_CATEGORIES,
  CATEGORY_BY_ID,
  categorizeEstablishment,
  type DiscoverCategoryId,
} from "@/lib/discover-categories";


// Lista aberta a todos os estabelecimentos ativos — sem distinção de plano.
// Revalidamos sempre ao abrir para que parceiros recém-criados (tipicamente
// no plano gratuito) apareçam na hora, sem depender de cache antigo.
const opts = queryOptions({
  queryKey: ["discovery-establishments"],
  queryFn: () => getDiscoveryEstablishments(),
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
});

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
  const { data = [] } = useSuspenseQuery(opts);
  const [geo, setGeo] = useState<GeoState>(() => {
    if (typeof window === "undefined") return "idle";
    return (localStorage.getItem("wallet:geo") as GeoState) || "idle";
  });
  const [myCity, setMyCity] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("wallet:geo:city") || "";
  });
  const [locating, setLocating] = useState(false);
  const [active, setActive] = useState<DiscoverCategoryId | "promo" | "perto" | "todos" | null>(null);
  const [query, setQuery] = useState("");


  useEffect(() => {
    if (geo === "granted" || geo === "denied" || geo === "unsupported") {
      localStorage.setItem("wallet:geo", geo);
    }
  }, [geo]);

  useEffect(() => {
    if (myCity) localStorage.setItem("wallet:geo:city", myCity);
  }, [myCity]);

  // Se acabamos de conceder e ainda não temos cidade, tenta resolver.
  useEffect(() => {
    if (geo !== "granted" || myCity || typeof navigator === "undefined" || !navigator.geolocation) return;
    let cancelled = false;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=pt-BR`,
            { headers: { Accept: "application/json" } },
          );
          const j = (await res.json()) as { address?: { city?: string; town?: string; village?: string; municipality?: string } };
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
  }, [geo, myCity]);

  function askGeo() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo("unsupported");
      return;
    }
    setGeo("asking");
    navigator.geolocation.getCurrentPosition(
      () => setGeo("granted"),
      () => setGeo("denied"),
      { timeout: 8000 },
    );
  }

  // Ordenação: quando temos cidade do usuário, prioriza estabelecimentos na mesma cidade,
  // depois não-visitados, depois o resto. Sem cidade, mantém heurística "não visitados no topo".
  const myCityNorm = normalizeCity(myCity);
  const sorted = useMemo(
    () =>
      [...data]
        .map((e) => ({ ...e, category: categorizeEstablishment(e) }))
        .sort((a, b) => {
          // 1) Promoções ativas primeiro — o cliente vê ofertas antes de tudo.
          const aPromo = a.has_promotion ? 1 : 0;
          const bPromo = b.has_promotion ? 1 : 0;
          if (aPromo !== bPromo) return bPromo - aPromo;
          // 2) Proximidade (mesma cidade) quando disponível.
          if (myCityNorm) {
            const aMatch = normalizeCity(a.city) === myCityNorm ? 1 : 0;
            const bMatch = normalizeCity(b.city) === myCityNorm ? 1 : 0;
            if (aMatch !== bMatch) return bMatch - aMatch;
          }
          // 3) Não visitados no topo.
          return Number(a.visited) - Number(b.visited);
        }),
    [data, myCityNorm],
  );

  // Categorias disponíveis (só as que têm estabelecimentos), com contagem.
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


  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["discovery-establishments"] })}>
      <div className="px-4 pb-8 space-y-6">
        {/* Header Superior Premium */}
        <div className="pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black tracking-tighter text-neutral-900 dark:text-white">Descobrir</h1>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">
                Novas experiências próximas a você
              </p>
            </div>
          </div>
        </div>


        {geo !== "granted" && geo !== "denied" && geo !== "unsupported" && (
          <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold">Ver o que está perto de você</div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe sua localização para priorizar estabelecimentos próximos. Você pode revogar a qualquer momento.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={askGeo}
                    disabled={geo === "asking"}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform active:scale-95 disabled:opacity-60"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {geo === "asking" ? "Detectando…" : "Ativar localização"}
                  </button>
                  <button
                    onClick={() => setGeo("denied")}
                    className="text-[11px] text-muted-foreground underline underline-offset-2"
                  >
                    Agora não
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Localização usada só para ordenar esta lista
            </div>
          </div>
        )}

        {geo === "granted" && (
          <p className="rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            <MapPin className="mr-1 inline h-3.5 w-3.5" />
            {locating
              ? "Detectando sua região…"
              : myCity
              ? `Ordenado por proximidade — priorizando ${myCity}.`
              : "Localização ativa — priorizando novidades."}
          </p>
        )}

        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            <div className="font-display text-sm font-bold">Nada por aqui ainda</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Assim que novos estabelecimentos parceiros entrarem, eles aparecem aqui.
            </p>
          </div>
        ) : (
          <>
            {/* Busca Premium Clean */}
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground transition-colors group-focus-within:text-primary">
                <Search className="h-4 w-4" />
              </div>
              <input
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                placeholder="Buscar por nome, cidade ou tipo…"
                className="w-full rounded-2xl border border-border/60 bg-white/50 dark:bg-black/20 py-3.5 pl-10 pr-10 text-sm font-medium outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-white dark:focus:bg-black/40 focus:ring-4 focus:ring-primary/5 shadow-sm"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>


            <SponsoredAdsRail
              category={active && active !== "promo" && active !== "perto" && active !== "todos" ? active : null}
            />

            {!showList ? (
              /* Passo 1 — o cliente escolhe onde quer navegar */
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {promoCount > 0 && (
                    <button
                      onClick={() => setActive("promo")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 transition-transform active:scale-95 dark:text-amber-300"
                    >
                      <Tag className="h-3.5 w-3.5" /> Com promoção · {promoCount}
                    </button>
                  )}
                  {nearbyCount > 0 && (
                    <button
                      onClick={() => setActive("perto")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-transform active:scale-95"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Perto de você · {nearbyCount}
                    </button>
                  )}
                </div>

                <div className="pt-2">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Explorar Categorias</h2>
                    <button
                      onClick={() => qc.invalidateQueries({ queryKey: ["discovery-establishments"] })}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      Atualizar
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActive(c.id)}
                        className="group relative overflow-hidden rounded-3xl border border-border/40 bg-white/50 dark:bg-black/20 p-4 text-left transition-all hover:border-primary/40 hover:bg-white dark:hover:bg-black/40 active:scale-[0.98] shadow-sm"
                      >
                        <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-primary/10 opacity-40 blur-xl transition-opacity group-hover:opacity-60" />
                        <div className="text-2xl">{c.emoji}</div>
                        <div className="mt-2 font-display text-sm font-black tracking-tight">{c.label}</div>
                        <div className="text-[10px] font-bold text-muted-foreground/60">
                          {c.count} {c.count === 1 ? "lugar" : "lugares"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setActive("todos")}
                  className="flex w-full items-center justify-between rounded-3xl border border-border/40 bg-primary/5 dark:bg-primary/10 px-6 py-4 text-sm font-black text-primary transition-all hover:bg-primary/10 active:scale-[0.99]"
                >
                  <span>Ver todos os {sorted.length} estabelecimentos</span>
                  <ChevronRight className="h-5 w-5" />
                </button>

              </div>
            ) : (
              /* Passo 2 — lista filtrada */
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-4">
                  <button
                    onClick={() => {
                      setActive(null);
                      setQuery("");
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-white dark:bg-black/20 px-4 py-2 text-xs font-black transition-all hover:bg-muted active:scale-95 shadow-sm"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">Filtrando por</div>
                    <div className="text-xs font-bold text-primary truncate max-w-[150px]">{activeLabel}</div>
                  </div>
                </div>

                {/* Troca rápida entre categorias sem voltar */}
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActive(c.id)}
                      className={`shrink-0 rounded-2xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all shadow-sm ${
                        active === c.id
                          ? "border-primary bg-primary text-primary-foreground shadow-primary/20"
                          : "border-border/60 bg-white/50 dark:bg-black/20 text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>

                {visible.length === 0 ? (
                  <div className="rounded-[2.5rem] border border-dashed border-border/60 bg-primary/5 p-12 text-center">
                    <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary/40" />
                    <div className="font-display text-lg font-black tracking-tight">Nenhum resultado</div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">Não encontramos nada nesta categoria no momento. Tente outra ou limpe a busca.</p>
                    <button 
                      onClick={() => { setActive(null); setQuery(""); }}
                      className="mt-6 text-xs font-black text-primary underline underline-offset-4"
                    >
                      Ver todas as opções
                    </button>
                  </div>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {visible.map((e) => (
                      <DiscoverRow key={e.id} e={e} nearby={!!myCityNorm && normalizeCity(e.city) === myCityNorm} />
                    ))}
                  </ul>
                )}

              </div>
            )}
          </>
        )}

      </div>
    </WithOfflineFallback>
  );
}

function DiscoverRow({
  e,
  nearby,
}: {
  e: {
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
    address: string | null;
    city: string | null;
    description: string | null;
    visited: boolean;
    has_promotion: boolean;
    has_menu: boolean;
    has_catalog: boolean;
  };
  nearby?: boolean;
}) {
  const brand = e.primary_color || "hsl(var(--primary))";
  const location = [e.address, e.city].filter(Boolean).join(" · ");
  const hasShowcase = e.has_menu || e.has_catalog;
  return (
    <li className="group overflow-hidden rounded-[2rem] border border-border/40 bg-white dark:bg-black/20 transition-all hover:border-primary/40 hover:bg-white dark:hover:bg-black/40 shadow-sm hover:shadow-md">
      <Link
        to="/carteira/e/$slug"
        params={{ slug: e.slug }}
        className="relative flex items-center gap-4 p-4"
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-10 blur-3xl transition-opacity group-hover:opacity-20"
          style={{ background: brand }}
        />
        <div
          className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[1.25rem] border border-border/40 bg-background text-sm font-black uppercase shadow-sm"
          style={{ color: brand }}
        >
          {e.logo_url ? (
            <img src={e.logo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            e.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-display text-base font-black tracking-tight text-neutral-900 dark:text-white">{e.name}</div>
            {e.has_promotion && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300 shadow-sm">
                <Tag className="h-2.5 w-2.5" /> Promo
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-1">
            {location && (
              <div className="flex items-center gap-1 truncate text-[10px] font-bold text-muted-foreground/70">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{location}</span>
                {nearby && (
                  <>
                    <span className="mx-1 opacity-40">·</span>
                    <span className="text-primary">Perto</span>
                  </>
                )}
              </div>
            )}
            {e.description && (
              <p className="line-clamp-1 text-[11px] font-medium text-muted-foreground/80 leading-tight">{e.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {e.visited ? (
            <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground/40">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
              <Sparkles className="h-4 w-4" />
            </div>
          )}
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      {hasShowcase && (
        <div className="flex flex-wrap gap-2 border-t border-border/40 px-3 pb-3 pt-2">
          {e.has_menu && (
            <Link
              to="/cardapio/$slug"
              params={{ slug: e.slug }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" /> Ver cardápio
            </Link>
          )}
          {e.has_catalog && (
            <Link
              to="/catalogo/$slug"
              params={{ slug: e.slug }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
            >
              <ShoppingBag className="h-3.5 w-3.5" /> Ver catálogo
            </Link>
          )}
        </div>
      )}
    </li>
  );
}
