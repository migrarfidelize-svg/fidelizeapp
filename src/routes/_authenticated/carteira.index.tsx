import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMyWallet } from "@/lib/my-wallet.functions";
import { QrCode, ChevronRight, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/format";

const walletOpts = queryOptions({
  queryKey: ["my-wallet"],
  queryFn: () => getMyWallet(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/carteira/")({
  ssr: false,
  loader: ({ context }) => context.queryClient.ensureQueryData(walletOpts),
  head: () => ({ meta: [{ title: "Minha carteira — Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: WalletHome,
  errorComponent: ({ error }) => (
    <div className="mt-10 rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
      Não foi possível carregar sua carteira. {error.message}
    </div>
  ),
});

function WalletHome() {
  const { data } = useSuspenseQuery(walletOpts);
  const items = data ?? [];
  const totalStamps = items.reduce((sum, i) => sum + (i.card?.stamps ?? 0), 0);
  const closeToComplete = items.filter((i) => {
    if (!i.card) return false;
    const req = (i.card.campaign as { stamps_required: number }).stamps_required || 1;
    return i.card.stamps / req >= 0.6;
  }).length;

  return (
    <div className="space-y-5">
      <div className="pt-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Seus cartões fidelidade</h1>
        <p className="text-sm text-muted-foreground">
          Todos os estabelecimentos onde você acumula carimbos, em um só lugar.
        </p>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <KpiTile label="Cartões ativos" value={items.length} />
          <KpiTile label="Carimbos totais" value={totalStamps} accent={closeToComplete > 0 ? "primary" : undefined} />
        </div>
      )}

      {items.length === 0 ? <EmptyWallet /> : (
        <div className="space-y-3">
          {items.map((i) => (
            <WalletCard key={i.customer.id} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value, accent }: { label: string; value: number; accent?: "primary" }) {
  return (
    <div className={"rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur"}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={"mt-1 font-display text-3xl font-bold " + (accent === "primary" ? "text-primary" : "")}>
        {value}
      </div>
    </div>
  );
}

function EmptyWallet() {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-border/70 bg-card/30 p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <QrCode className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-lg font-semibold">Você ainda não possui cartões fidelidade</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Leia o QR Code de um estabelecimento Fidelize para começar a acumular carimbos.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Já tem o link do seu cartão? Abra-o e toque em "Salvar na minha carteira".
      </p>
    </div>
  );
}

type WalletItem = Awaited<ReturnType<typeof getMyWallet>>[number];

function WalletCard({ item }: { item: WalletItem }) {
  const est = item.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string; active: boolean };
  const card = item.card;
  const req = card ? (card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
  const stamps = card?.stamps ?? 0;
  const pct = Math.min(100, Math.round((stamps / req) * 100));
  const missing = Math.max(0, req - stamps);
  const reward = card ? (card.campaign as { reward_title: string }).reward_title : null;

  return (
    <Link
      to="/carteira/$slug"
      params={{ slug: est.slug }}
      className="group relative block overflow-hidden rounded-3xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: est.primary_color || "hsl(var(--primary))" }}
      />
      <div className="flex items-start gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted text-lg font-bold uppercase"
          style={{ color: est.primary_color || undefined }}
        >
          {est.logo_url ? (
            <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" />
          ) : (
            est.name.slice(0, 2)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold">{est.name}</h3>
            {!est.active && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                inativo
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {card ? (
              <>
                <span className="font-semibold text-foreground">{stamps}</span>
                <span> de {req} carimbos · </span>
                {missing > 0 ? (
                  <>faltam <span className="font-medium text-foreground">{missing}</span> para <span className="text-foreground">{reward}</span></>
                ) : (
                  <span className="font-semibold text-primary inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Recompensa liberada
                  </span>
                )}
              </>
            ) : (
              "Cartão aguardando primeiro carimbo"
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: est.primary_color || "hsl(var(--primary))",
              }}
            />
          </div>
          {item.customer.lastVisitAt && (
            <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Última visita: {formatDate(item.customer.lastVisitAt)}
            </div>
          )}
        </div>
        <ChevronRight className="mt-4 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
