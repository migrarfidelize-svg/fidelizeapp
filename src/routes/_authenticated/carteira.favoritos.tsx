import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyWallet } from "@/lib/my-wallet.functions";
import { toggleCustomerPin } from "@/lib/wallet-prefs.functions";
import { Heart, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/carteira/favoritos")({ component: FavoritesPage });

function FavoritesPage() {
  const queryClient = useQueryClient();
  const wallet = useQuery({ queryKey: ["my-wallet"], queryFn: () => getMyWallet() });
  const toggle = useMutation({ mutationFn: (customerId: string) => toggleCustomerPin({ data: { customer_id: customerId, pinned: false } }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-wallet"] }) });
  const favorites = (wallet.data || []).filter((item) => item.customer.pinned);
  return <div className="space-y-4"><header><h1 className="font-display text-2xl font-bold">Favoritos</h1><p className="text-sm text-muted-foreground">Estabelecimentos fixados na sua carteira.</p></header>{wallet.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : favorites.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Você ainda não favoritou nenhum estabelecimento.</p> : <div className="grid gap-3 sm:grid-cols-2">{favorites.map((item) => { const est = item.establishment as { slug: string; name: string; logo_url: string | null }; return <article key={item.customer.id} className="flex items-center gap-3 rounded-2xl border bg-card/50 p-4"><div className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-muted font-bold">{est.logo_url ? <img src={est.logo_url} alt="" className="h-full w-full object-cover" /> : est.name.slice(0, 2)}</div><div className="min-w-0 flex-1"><strong className="block truncate">{est.name}</strong><Link to="/carteira/$slug" params={{ slug: est.slug }} className="inline-flex items-center gap-1 text-xs text-primary">Abrir <ExternalLink className="h-3 w-3" /></Link></div><button disabled={toggle.isPending} onClick={() => toggle.mutate(item.customer.id)} aria-label={`Remover ${est.name} dos favoritos`} className="rounded-xl p-2 text-red-500 hover:bg-red-500/10"><Heart className="h-5 w-5 fill-current" /></button></article>; })}</div>}</div>;
}
