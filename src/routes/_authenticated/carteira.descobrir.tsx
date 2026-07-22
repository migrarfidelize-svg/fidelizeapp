import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Compass, MapPin, Sparkles, ChevronRight, ShieldCheck } from "lucide-react";
import { getDiscoveryEstablishments } from "@/lib/my-wallet.functions";
import { WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";

const opts = queryOptions({
  queryKey: ["discovery-establishments"],
  queryFn: () => getDiscoveryEstablishments(),
  staleTime: 60_000,
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
  pendingComponent: () => (
    <div className="space-y-3 pt-2">
      <div className="h-7 w-56 rounded-full bg-muted/70" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 rounded-2xl border border-border/60 bg-card/40" />
      ))}
    </div>
  ),
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

type GeoState = "idle" | "asking" | "granted" | "denied" | "unsupported";

function DiscoverPage() {
  const qc = useQueryClient();
  const { data = [] } = useSuspenseQuery(opts);
  const [geo, setGeo] = useState<GeoState>(() => {
    if (typeof window === "undefined") return "idle";
    return (localStorage.getItem("wallet:geo") as GeoState) || "idle";
  });

  useEffect(() => {
    if (geo === "granted" || geo === "denied" || geo === "unsupported") {
      localStorage.setItem("wallet:geo", geo);
    }
  }, [geo]);

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

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["discovery-establishments"] })}>
      <div className="space-y-4">
        <div className="pt-2">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">Descobrir</h1>
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
            Localização ativa — mostrando estabelecimentos por proximidade.
          </p>
        )}

        {data.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-card/30 p-8 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            <div className="font-display text-sm font-bold">Nada por aqui ainda</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Assim que novos estabelecimentos parceiros entrarem, eles aparecem aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {[...data]
              .sort((a, b) => Number(a.visited) - Number(b.visited))
              .map((e) => (
                <DiscoverRow key={e.id} e={e} />
              ))}
          </ul>
        )}
      </div>
    </WithOfflineFallback>
  );
}

function DiscoverRow({
  e,
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
  };
}) {
  const brand = e.primary_color || "hsl(var(--primary))";
  const location = [e.address, e.city].filter(Boolean).join(" · ");
  return (
    <li>
      <Link
        to="/carteira/$slug/promocoes"
        params={{ slug: e.slug }}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-3 transition-all hover:border-primary/40 hover:bg-card/60"
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
            <img src={e.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            e.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm font-semibold">{e.name}</div>
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
    </li>
  );
}
