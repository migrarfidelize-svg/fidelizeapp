import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyWallet, getMyRewards } from "@/lib/my-wallet.functions";
import { WalletCard } from "./carteira.index";
import {
  EmptyWalletState,
  WalletErrorState,
  WithOfflineFallback,
} from "@/components/wallet/WalletStates";
import { WalletCardSkeletonList } from "@/components/wallet/WalletCardSkeleton";
import { Gift, Sparkles, ChevronRight, CreditCard, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";


const walletOpts = queryOptions({
  queryKey: ["my-wallet"],
  queryFn: () => getMyWallet(),
  staleTime: 15_000,
});
const rewardsOpts = queryOptions({
  queryKey: ["my-rewards"],
  queryFn: () => getMyRewards(),
  staleTime: 15_000,
});

const searchSchema = z.object({
  tab: z.enum(["cartoes", "recompensas"]).optional().catch("cartoes"),
});

export const Route = createFileRoute("/_authenticated/carteira/premios")({
  ssr: false,
  validateSearch: searchSchema,
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(walletOpts),
      context.queryClient.ensureQueryData(rewardsOpts),
    ]),
  head: () => ({
    meta: [
      { title: "Meus cartões — Carteira Fidelize" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RewardsHub,
  pendingComponent: () => (
    <div className="space-y-4 pt-2">
      <div className="h-7 w-48 rounded-full bg-muted/70" />
      <WalletCardSkeletonList count={3} />
    </div>
  ),
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

function RewardsHub() {
  const qc = useQueryClient();
  const { tab = "cartoes" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: wallet } = useSuspenseQuery(walletOpts);
  const { data: rewards = [] } = useQuery(rewardsOpts);
  const items = wallet ?? [];
  const ready = rewards.filter((r) => r.ready);
  const inProgress = rewards.filter((r) => !r.ready);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "close" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const q = query.trim().toLowerCase();

  // Categorias únicas presentes na carteira do usuário (fallback "Outros" para vazio).
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const i of items) {
      const seg = ((i.establishment as { segment: string | null }).segment ?? "").trim();
      const key = seg ? seg.toLowerCase() : "__none__";
      const label = seg || "Outros";
      const prev = map.get(key);
      if (prev) prev.count++;
      else map.set(key, { key, label, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const est = i.establishment as { name: string; active: boolean; segment: string | null };
      if (q && !est.name.toLowerCase().includes(q)) return false;
      if (categoryFilter !== "all") {
        const seg = (est.segment ?? "").trim().toLowerCase();
        const key = seg || "__none__";
        if (key !== categoryFilter) return false;
      }
      const req = i.card ? (i.card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
      const stamps = i.card?.stamps ?? 0;
      const pct = stamps / req;
      const campActive = i.card ? (i.card.campaign as { active: boolean }).active : true;
      const isInactive = !est.active || !campActive;
      switch (statusFilter) {
        case "ready":
          return !isInactive && !!i.card && stamps >= req;
        case "close":
          return !isInactive && !!i.card && stamps < req && pct >= 0.6;
        case "inactive":
          return isInactive;
        default:
          return true;
      }
    });
  }, [items, q, statusFilter, categoryFilter]);

  const counts = useMemo(() => {
    let readyCount = 0;
    let closeCount = 0;
    let inactiveCount = 0;
    for (const i of items) {
      const est = i.establishment as { active: boolean };
      const req = i.card ? (i.card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
      const stamps = i.card?.stamps ?? 0;
      const campActive = i.card ? (i.card.campaign as { active: boolean }).active : true;
      const isInactive = !est.active || !campActive;
      if (isInactive) inactiveCount++;
      else if (i.card && stamps >= req) readyCount++;
      else if (i.card && stamps / req >= 0.6) closeCount++;
    }
    return { readyCount, closeCount, inactiveCount };
  }, [items]);

  const filterChips: Array<{
    key: typeof statusFilter;
    label: string;
    count?: number;
    highlight?: boolean;
  }> = [
    { key: "all", label: "Todos", count: items.length },
    { key: "ready", label: "Prontos", count: counts.readyCount, highlight: counts.readyCount > 0 },
    { key: "close", label: "Quase lá", count: counts.closeCount },
    { key: "inactive", label: "Inativos", count: counts.inactiveCount },
  ];


  return (
    <WithOfflineFallback
      onRetry={() => {
        qc.invalidateQueries({ queryKey: ["my-wallet"] });
        qc.invalidateQueries({ queryKey: ["my-rewards"] });
      }}
    >
      <div className="space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Meus cartões</h1>
          <p className="text-sm text-muted-foreground">
            Todos os seus cartões e as recompensas prontas para resgate.
          </p>
        </div>

        {/* Sub-tabs no topo */}
        <div
          role="tablist"
          aria-label="Filtrar cartões"
          className="relative flex gap-1 rounded-2xl border border-border/60 bg-card/40 p-1 backdrop-blur"
        >
          <SubTab
            active={tab === "cartoes"}
            onClick={() => navigate({ search: { tab: "cartoes" }, replace: true })}
            icon={<CreditCard className="h-3.5 w-3.5" />}
            label="Cartões"
            badge={items.length || undefined}
          />
          <SubTab
            active={tab === "recompensas"}
            onClick={() => navigate({ search: { tab: "recompensas" }, replace: true })}
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label="Recompensas"
            badge={ready.length || undefined}
            highlight={ready.length > 0}
          />
        </div>

        {items.length === 0 ? (
          <EmptyWalletState />
        ) : tab === "recompensas" ? (
          <div className="space-y-5">
            {ready.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
                  <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Prontas para resgatar
                </h2>
                <div className="space-y-3">
                  {ready.map((r) => (
                    <RewardRow key={r.cardId} r={r} highlight />
                  ))}
                </div>
              </section>
            )}
            {inProgress.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Em progresso
                </h2>
                <div className="space-y-3">
                  {inProgress.map((r) => (
                    <RewardRow key={r.cardId} r={r} />
                  ))}
                </div>
              </section>
            )}
            {rewards.length === 0 && (
              <p className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                Ainda não há campanhas ativas nos seus cartões.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.length >= 4 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar loja…"
                  aria-label="Buscar loja na minha carteira"
                  className="w-full rounded-2xl border border-border/60 bg-card/40 py-2.5 pl-9 pr-9 text-sm outline-none transition-colors focus:border-primary/50 focus:bg-card/60"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {items.length >= 4 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {filterChips.map((c) => {
                  const active = statusFilter === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setStatusFilter(c.key)}
                      className={
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all " +
                        (active
                          ? "border-primary/50 bg-primary/10 text-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                          : c.highlight
                            ? "border-primary/30 bg-primary/5 text-primary/80"
                            : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground")
                      }
                    >
                      {c.label}
                      {c.count != null && c.count > 0 && (
                        <span
                          className={
                            "grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black " +
                            (active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {c.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {categories.length >= 2 && (
              <div>
                <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Categoria</div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <CategoryChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")} label="Todas" count={items.length} />
                  {categories.map((c) => (
                    <CategoryChip key={c.key} active={categoryFilter === c.key} onClick={() => setCategoryFilter(c.key)} label={c.label} count={c.count} />
                  ))}
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
                Nenhum cartão encontrado com esse filtro.
              </div>
            ) : (
              filtered.map((i) => <WalletCard key={i.customer.id} item={i} />)
            )}
          </div>
        )}

      </div>
    </WithOfflineFallback>
  );
}

function SubTab({
  active,
  onClick,
  icon,
  label,
  badge,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all " +
        (active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {label}
      {badge != null && (
        <span
          className={
            "ml-1 grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-bold " +
            (highlight
              ? "bg-primary text-primary-foreground shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
              : active
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground")
          }
        >
          {badge}
        </span>
      )}
    </button>
  );
}

type Reward = Awaited<ReturnType<typeof getMyRewards>>[number];

function RewardRow({ r, highlight }: { r: Reward; highlight?: boolean }) {
  const est = r.establishment as {
    slug: string;
    name: string;
    logo_url: string | null;
    primary_color: string;
  };
  return (
    <Link
      to="/carteira/$slug"
      params={{ slug: est.slug }}
      className={
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 transition-all " +
        (highlight
          ? "border-primary/50 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
          : "border-border/60 bg-card/40 hover:border-primary/30")
      }
    >
      <div
        className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted text-sm font-bold uppercase"
        style={{ color: est.primary_color || undefined }}
      >
        {est.logo_url ? (
          <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          est.name.slice(0, 2)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs uppercase tracking-widest text-muted-foreground">
          {est.name}
        </div>
        <div className="flex items-center gap-1.5 truncate font-display text-sm font-semibold">
          <Gift className={"h-4 w-4 shrink-0 " + (highlight ? "text-primary" : "text-muted-foreground")} />
          {r.reward}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{
              width: `${r.pct}%`,
              background: est.primary_color || "hsl(var(--primary))",
            }}
          />
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          {r.ready ? "Pronta para resgate" : `${r.stamps}/${r.required} carimbos`}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
