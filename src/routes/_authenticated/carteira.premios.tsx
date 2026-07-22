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
            {items.map((i) => (
              <WalletCard key={i.customer.id} item={i} />
            ))}
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
