import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getMyWallet } from "@/lib/my-wallet.functions";
import { WalletCard } from "./carteira.index";
import { EmptyWalletState, WalletErrorState, WithOfflineFallback } from "@/components/wallet/WalletStates";

const opts = queryOptions({
  queryKey: ["my-wallet"],
  queryFn: () => getMyWallet(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/carteira/cartoes")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  head: () => ({ meta: [{ title: "Meus cartões — Carteira Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: WalletCards,
  errorComponent: ({ error, reset }) => <WalletErrorState error={error} onRetry={reset} />,
});

function WalletCards() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(opts);
  const items = data ?? [];
  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-wallet"] })}>
      <div className="space-y-4">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Meus cartões</h1>
          <p className="text-sm text-muted-foreground">
            Todos os estabelecimentos onde você acumula carimbos.
          </p>
        </div>
        {items.length === 0 ? (
          <EmptyWalletState />
        ) : (
          <div className="space-y-3">
            {items.map((i) => <WalletCard key={i.customer.id} item={i} />)}
          </div>
        )}
      </div>
    </WithOfflineFallback>
  );
}
