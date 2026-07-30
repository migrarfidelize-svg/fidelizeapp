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
      <div className="space-y-4">
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">Descobrir</h1>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["discovery-establishments"] })}
              aria-label="Atualizar lista"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-[11px] font-bold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Outros lugares Fidelize esperando por você — colecione novos cartões e ganhe recompensas.
          </p>
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
            {/* Busca sempre disponível */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                placeholder="Buscar por nome, cidade ou tipo…"
                className="w-full rounded-2xl border border-border/60 bg-card/40 py-2.5 pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted/60"
                >
                  <X className="h-3.5 w-3.5" />
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

                <div>
                  <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Escolha uma categoria
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setActive(c.id)}
                        className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-3 text-left transition-all hover:border-primary/40 hover:bg-card/60 active:scale-[0.98]"
                      >
                        <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/15 opacity-40 blur-2xl transition-opacity group-hover:opacity-70" />
                        <div className="text-xl">{c.emoji}</div>
                        <div className="mt-1.5 font-display text-sm font-bold">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.count} {c.count === 1 ? "lugar" : "lugares"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setActive("todos")}
                  className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/30 px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/40"
                >
                  Ver todos os {sorted.length} estabelecimentos
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              /* Passo 2 — lista filtrada */
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActive(null);
                      setQuery("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary/40"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Categorias
                  </button>
                  <span className="truncate text-xs text-muted-foreground">
                    {activeLabel} · {visible.length}
                  </span>
                </div>

                {/* Troca rápida entre categorias sem voltar */}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActive(c.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active === c.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-card/40 hover:border-primary/40"
                      }`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>

                {visible.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
                    <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
                    <div className="font-display text-sm font-bold">Nenhum resultado</div>
                    <p className="mt-1 text-xs text-muted-foreground">Tente outra categoria ou busca.</p>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
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
    <li className="group overflow-hidden rounded-2xl border border-border/60 bg-card/40 transition-all hover:border-primary/40 hover:bg-card/60">
      <Link
        to="/carteira/e/$slug"
        params={{ slug: e.slug }}
        className="relative flex items-center gap-3 p-3"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl"
          style={{ background: brand }}
        />
        <div
          className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-background text-sm font-bold uppercase"
          style={{ color: brand }}
        >
          {e.logo_url ? (
            <img src={e.logo_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            e.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="truncate font-display text-sm font-semibold">{e.name}</div>
            {e.has_promotion && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
                <Tag className="h-2.5 w-2.5" /> Promoção
              </span>
            )}
            {nearby && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
                Perto
              </span>
            )}
          </div>
          {location && (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}
          {e.description && (
            <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/80">{e.description}</p>
          )}
        </div>
        {e.visited ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Visitado
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-sm"
            style={{ background: brand }}
          >
            <Sparkles className="h-3 w-3" /> Novo
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
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
