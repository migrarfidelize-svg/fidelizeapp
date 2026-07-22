import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getMyHistory } from "@/lib/my-wallet.functions";
import { Stamp, RotateCcw, Trophy, Award } from "lucide-react";
import * as Icons from "lucide-react";
import { formatDate } from "@/lib/format";
import { EmptyWalletState, WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";
import { useState } from "react";

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

type Filter = "all" | "stamp" | "redeem" | "achievement";

function HistoryPage() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(opts);
  const items = data ?? [];
  const [filter, setFilter] = useState<Filter>("all");

  const stampCount = items.filter((i) => i.kind === "stamp").length;
  const redeemCount = items.filter((i) => i.kind === "redeem").length;
  const achCount = items.filter((i) => i.kind === "achievement").length;
  const visible = filter === "all" ? items : items.filter((i) => i.kind === filter);

  const chips: Array<{ key: Filter; label: string; count: number }> = [
    { key: "all", label: "Tudo", count: items.length },
    { key: "stamp", label: "Carimbos", count: stampCount },
    { key: "redeem", label: "Resgates", count: redeemCount },
    { key: "achievement", label: "Conquistas", count: achCount },
  ];

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-history"] })}>
      <div className="space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="text-sm text-muted-foreground">
            Seus carimbos e recompensas resgatadas em toda a rede Fidelize.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex gap-1.5 rounded-2xl border border-border/60 bg-card/40 p-1">
            {chips.map((c) => {
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  className={
                    "flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all " +
                    (active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {c.label}
                  {c.count > 0 && (
                    <span className={"ml-1.5 text-[10px] " + (active ? "text-primary" : "text-muted-foreground/70")}>
                      {c.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {items.length === 0 ? (
          <EmptyWalletState />
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-6 text-center text-sm text-muted-foreground">
            Nada aqui ainda neste filtro.
          </div>
        ) : (
          <ol className="relative space-y-2 rounded-3xl border border-border/60 bg-card/40 p-3">
            {visible.map((s) => {
              const est = s.establishment as {
                name: string;
                logo_url: string | null;
                primary_color: string;
              } | null;
              const isRedeem = s.kind === "redeem";
              return (
                <li
                  key={s.id}
                  className={
                    "flex items-center gap-3 rounded-2xl border p-3 " +
                    (isRedeem
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/40 bg-background/60")
                  }
                >
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/60 bg-muted text-xs font-bold uppercase"
                    style={{ color: est?.primary_color || undefined }}
                  >
                    {est?.logo_url ? (
                      <img src={est.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      est?.name.slice(0, 2) ?? "??"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {isRedeem && s.rewardTitle ? s.rewardTitle : est?.name ?? "Estabelecimento"}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {isRedeem
                        ? `${est?.name ?? "Loja"} · ${s.campaignName ?? "Campanha"}`
                        : `${s.campaignName ?? "Campanha"}`}
                      {" · "}
                      {formatDate(s.createdAt)}
                    </div>
                  </div>
                  <span
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest " +
                      (isRedeem
                        ? "bg-primary/15 text-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_35%,transparent)]"
                        : s.reverted
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary")
                    }
                  >
                    {isRedeem ? (
                      <>
                        <Trophy className="h-3 w-3" /> Resgate
                      </>
                    ) : s.reverted ? (
                      <>
                        <RotateCcw className="h-3 w-3" /> Estornado
                      </>
                    ) : (
                      <>
                        <Stamp className="h-3 w-3" /> Carimbo
                      </>
                    )}
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
