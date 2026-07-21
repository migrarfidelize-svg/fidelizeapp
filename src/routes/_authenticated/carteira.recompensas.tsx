import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getMyRewards } from "@/lib/my-wallet.functions";
import { Gift, Sparkles, ChevronRight } from "lucide-react";
import { EmptyWalletState, WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";

const opts = queryOptions({
  queryKey: ["my-rewards"],
  queryFn: () => getMyRewards(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/carteira/recompensas")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  head: () => ({ meta: [{ title: "Recompensas — Carteira Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: RewardsPage,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

function RewardsPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(opts);
  const items = data ?? [];
  const ready = items.filter((i) => i.ready);
  const inProgress = items.filter((i) => !i.ready);

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-rewards"] })}>
      <div className="space-y-5">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Recompensas</h1>
          <p className="text-sm text-muted-foreground">
            Prêmios prontos para resgate e progresso das próximas.
          </p>
        </div>

        {items.length === 0 && <EmptyWalletState />}

        {ready.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Prontas para resgatar
            </h2>
            <div className="space-y-3">
              {ready.map((r) => <RewardRow key={r.cardId} r={r} highlight />)}
            </div>
          </section>
        )}

        {inProgress.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Em progresso</h2>
            <div className="space-y-3">
              {inProgress.map((r) => <RewardRow key={r.cardId} r={r} />)}
            </div>
          </section>
        )}
      </div>
    </WithOfflineFallback>
  );
}

type Reward = Awaited<ReturnType<typeof getMyRewards>>[number];

function RewardRow({ r, highlight }: { r: Reward; highlight?: boolean }) {
  const est = r.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string };
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
        {est.logo_url ? <img src={est.logo_url} alt="" className="h-full w-full object-cover" /> : est.name.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs uppercase tracking-widest text-muted-foreground">{est.name}</div>
        <div className="flex items-center gap-1.5 truncate font-display text-sm font-semibold">
          <Gift className={"h-4 w-4 shrink-0 " + (highlight ? "text-primary" : "text-muted-foreground")} />
          {r.reward}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${r.pct}%`, background: est.primary_color || "hsl(var(--primary))" }}
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
