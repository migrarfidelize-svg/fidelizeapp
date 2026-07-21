import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getMyHistory } from "@/lib/my-wallet.functions";
import { Stamp, RotateCcw } from "lucide-react";
import { formatDate } from "@/lib/format";
import { EmptyWalletState, WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";

const opts = queryOptions({
  queryKey: ["my-history"],
  queryFn: () => getMyHistory(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/carteira/historico")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  head: () => ({ meta: [{ title: "Histórico — Carteira Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: HistoryPage,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

function HistoryPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(opts);
  const items = data ?? [];

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-history"] })}>
      <div className="space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="text-sm text-muted-foreground">
            Seus últimos carimbos em toda a rede Fidelize.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyWalletState />
        ) : (
          <ol className="relative space-y-2 rounded-3xl border border-border/60 bg-card/40 p-3">
            {items.map((s) => {
              const est = s.establishment as { name: string; logo_url: string | null; primary_color: string } | null;
              return (
                <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/60 p-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted text-xs font-bold uppercase"
                    style={{ color: est?.primary_color || undefined }}
                  >
                    {est?.logo_url ? <img src={est.logo_url} alt="" className="h-full w-full object-cover" /> : (est?.name.slice(0, 2) ?? "??")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{est?.name ?? "Estabelecimento"}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {s.campaignName ?? "Campanha"} · {formatDate(s.createdAt)}
                    </div>
                  </div>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest " +
                      (s.reverted
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary")
                    }
                  >
                    {s.reverted ? (<><RotateCcw className="h-3 w-3" /> Estornado</>) : (<><Stamp className="h-3 w-3" /> Carimbo</>)}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </WithOfflineFallback>
  );
}
