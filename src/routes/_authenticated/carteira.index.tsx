import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getMyWallet, getMyHistory, getMyRewards } from "@/lib/my-wallet.functions";
import { listAchievementsCatalog, listMyAchievements } from "@/lib/achievements.functions";
import { ChevronRight, Sparkles, Gift, Stamp, RotateCcw, Bell, Flame, Trophy, Calendar } from "lucide-react";
import { formatDate } from "@/lib/format";
import { saveWalletCache, readWalletCache } from "@/lib/offline-wallet-cache";
import {
  EmptyWalletState,
  WalletErrorState,
  WithOfflineFallback,
} from "@/components/wallet/WalletStates";
import { WalletStack } from "@/components/wallet/WalletStack";
import { WalletHomeSkeleton } from "@/components/wallet/WalletCardSkeleton";
import { InstallAppCard } from "@/components/wallet/InstallAppCard";
import { EnableNotificationsCard } from "@/components/wallet/EnableNotificationsCard";


type WalletItem = Awaited<ReturnType<typeof getMyWallet>>[number];

const walletOpts = queryOptions({
  queryKey: ["my-wallet"],
  queryFn: () => getMyWallet(),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/carteira/")({
  ssr: false,
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(walletOpts);
    } catch (err) {
      // Offline-first: usa último snapshot em cache local se a rede falhar.
      const cache = readWalletCache<WalletItem>();
      if (cache?.items?.length) {
        context.queryClient.setQueryData(walletOpts.queryKey, cache.items);
        return cache.items;
      }
      throw err;
    }
  },
  head: () => ({ meta: [{ title: "Início — Carteira Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: WalletHome,
  pendingComponent: () => <WalletHomeSkeleton />,
  errorComponent: ({ error, reset }) => {
    return <WalletErrorState error={error} onRetry={reset} />;
  },
});

function WalletHome() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(walletOpts);
  const items = data ?? [];
  const totalStamps = items.reduce((sum, i) => sum + (i.card?.stamps ?? 0), 0);
  const readyRewards = items.filter((i) => {
    if (!i.card) return false;
    const req = (i.card.campaign as { stamps_required: number }).stamps_required || 1;
    return i.card.stamps >= req;
  }).length;

  // Offline-first: persiste último estado da carteira para renderizar sem internet.
  useEffect(() => {
    if (items.length) saveWalletCache(items);
  }, [items]);



  const { data: history } = useQuery({
    queryKey: ["my-history"],
    queryFn: () => getMyHistory(),
    staleTime: 15_000,
  });
  const { data: rewards } = useQuery({
    queryKey: ["my-rewards"],
    queryFn: () => getMyRewards(),
    staleTime: 15_000,
  });

  // Feed unificado: recompensas prontas (topo) + carimbos + "faltam X" (aviso).
  const feed = buildFeed(items, history ?? [], rewards ?? []);
  const streak = computeWeeklyStreak(history ?? []);

  return (
    <WithOfflineFallback onRetry={() => qc.invalidateQueries({ queryKey: ["my-wallet"] })}>
      <div className="space-y-5">
        <div className="pt-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Bem-vindo(a) de volta</h1>
          <p className="text-sm text-muted-foreground">
            Um resumo dos seus cartões e recompensas Fidelize.
          </p>
        </div>

        <InstallAppCard />
        <EnableNotificationsCard />



        {items.length === 0 ? (
          <EmptyWalletState />
        ) : (
          <>
            {readyRewards > 0 && (
              <Link
                to="/carteira/premios"
                search={{ tab: "recompensas" }}
                className="group relative flex items-center gap-3 overflow-hidden rounded-3xl border border-primary/50 bg-gradient-to-br from-primary/15 to-primary/5 p-4 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)] transition-all hover:from-primary/20"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Pronto para resgatar</div>
                  <div className="font-display text-sm font-bold">
                    Você tem {readyRewards} {readyRewards === 1 ? "recompensa disponível" : "recompensas disponíveis"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Toque no botão <b>Meu QR</b> abaixo para retirar.</div>
                </div>
                <ChevronRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}

            {streak.weeks >= 2 && <StreakCard weeks={streak.weeks} lastVisit={streak.lastVisit} />}

            <div className="grid grid-cols-3 gap-3">
              <KpiTile label="Cartões" value={items.length} />
              <KpiTile label="Carimbos" value={totalStamps} icon={<Stamp className="h-3.5 w-3.5" />} />
              <KpiTile label="Prontas" value={readyRewards} accent={readyRewards > 0 ? "primary" : undefined} icon={<Gift className="h-3.5 w-3.5" />} />
            </div>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Em destaque</h2>
                <Link to="/carteira/premios" search={{ tab: "cartoes" }} className="text-xs font-medium text-primary hover:underline">
                  Ver todos →
                </Link>
              </div>
              <WalletStack items={items.slice(0, 5)} />
            </section>

            {feed.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <Bell className="mr-1 inline h-3.5 w-3.5" /> Atividade recente
                  </h2>
                  <Link to="/carteira/historico" className="text-xs font-medium text-primary hover:underline">
                    Ver tudo →
                  </Link>
                </div>
                <ol className="space-y-2 rounded-3xl border border-border/60 bg-card/30 p-2">
                  {feed.map((f) => <FeedRow key={f.id} f={f} />)}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </WithOfflineFallback>
  );
}

type FeedItem = {
  id: string;
  kind: "stamp" | "reverted" | "ready" | "close";
  when: string | null;
  primary: string;
  secondary: string;
  color: string | null;
  logo: string | null;
  slug: string | null;
};

function buildFeed(
  items: Awaited<ReturnType<typeof getMyWallet>>,
  history: Awaited<ReturnType<typeof getMyHistory>>,
  rewards: Awaited<ReturnType<typeof getMyRewards>>,
): FeedItem[] {
  const out: FeedItem[] = [];

  // Recompensas prontas (topo do feed).
  for (const r of rewards.filter((r) => r.ready)) {
    const est = r.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string };
    out.push({
      id: `ready-${r.cardId}`,
      kind: "ready",
      when: null,
      primary: `${r.reward} liberado`,
      secondary: est.name,
      color: est.primary_color,
      logo: est.logo_url,
      slug: est.slug,
    });
  }

  // "Faltam X carimbos para..." em cartões próximos (70%+ mas não prontos).
  for (const it of items) {
    if (!it.card) continue;
    const req = (it.card.campaign as { stamps_required: number }).stamps_required || 1;
    const pct = it.card.stamps / req;
    const missing = req - it.card.stamps;
    if (pct >= 0.7 && missing > 0 && missing <= 2) {
      const est = it.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string };
      const reward = (it.card.campaign as { reward_title: string }).reward_title;
      out.push({
        id: `close-${it.customer.id}`,
        kind: "close",
        when: null,
        primary: `Faltam ${missing} para ${reward}`,
        secondary: est.name,
        color: est.primary_color,
        logo: est.logo_url,
        slug: est.slug,
      });
    }
  }

  // Últimos carimbos (limitado a 5).
  for (const s of history.slice(0, 5)) {
    const est = s.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string } | null;
    out.push({
      id: `stamp-${s.id}`,
      kind: s.reverted ? "reverted" : "stamp",
      when: s.createdAt,
      primary: s.reverted ? "Carimbo estornado" : "Novo carimbo",
      secondary: `${est?.name ?? "Estabelecimento"} · ${s.campaignName ?? "Campanha"}`,
      color: est?.primary_color ?? null,
      logo: est?.logo_url ?? null,
      slug: est?.slug ?? null,
    });
  }

  return out.slice(0, 8);
}

function FeedRow({ f }: { f: FeedItem }) {
  const Icon =
    f.kind === "ready" ? Sparkles :
    f.kind === "close" ? Gift :
    f.kind === "reverted" ? RotateCcw : Stamp;
  const tone =
    f.kind === "ready" ? "bg-primary/15 text-primary border-primary/40" :
    f.kind === "close" ? "bg-amber-500/10 text-amber-600 border-amber-500/40 dark:text-amber-300" :
    f.kind === "reverted" ? "bg-destructive/10 text-destructive border-destructive/30" :
    "bg-muted text-muted-foreground border-border/60";
  const inner = (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-background/60 p-2.5">
      <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-xl border " + tone}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{f.primary}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {f.secondary}{f.when ? ` · ${formatDate(f.when)}` : ""}
        </div>
      </div>
      {f.slug && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
    </div>
  );
  return (
    <li>
      {f.slug ? (
        <Link to="/carteira/$slug" params={{ slug: f.slug }} className="block transition-colors hover:brightness-105">
          {inner}
        </Link>
      ) : inner}
    </li>
  );
}

function KpiTile({ label, value, accent, icon }: { label: string; value: number; accent?: "primary"; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3 backdrop-blur">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}{label}
      </div>
      <div className={"mt-1 font-display text-2xl font-bold " + (accent === "primary" ? "text-primary" : "")}>
        {value}
      </div>
    </div>
  );
}

/**
 * Streak semanal: quantas semanas ISO consecutivas (contando esta semana)
 * o usuário registrou ao menos um carimbo não estornado.
 */
function computeWeeklyStreak(
  history: Awaited<ReturnType<typeof getMyHistory>>,
): { weeks: number; lastVisit: string | null } {
  const valid = history.filter((h) => !h.reverted && h.createdAt);
  if (!valid.length) return { weeks: 0, lastVisit: null };
  const weekKeys = new Set(valid.map((h) => isoWeekKey(new Date(h.createdAt))));
  const now = new Date();
  let cursor = now;
  let weeks = 0;
  // Só conta se a semana atual OU a anterior tem visita (não desqualifica logo).
  if (!weekKeys.has(isoWeekKey(cursor))) {
    cursor = addDays(cursor, -7);
    if (!weekKeys.has(isoWeekKey(cursor))) return { weeks: 0, lastVisit: valid[0].createdAt };
  }
  while (weekKeys.has(isoWeekKey(cursor))) {
    weeks++;
    cursor = addDays(cursor, -7);
  }
  return { weeks, lastVisit: valid[0].createdAt };
}

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((+t - +yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function addDays(d: Date, days: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return c;
}

function StreakCard({ weeks, lastVisit }: { weeks: number; lastVisit: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-primary/10 p-4">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-500/20 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <Flame className="wallet-streak-flame h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
            Sequência semanal
          </div>
          <div className="font-display text-base font-bold">
            Você visitou <span className="text-orange-600 dark:text-orange-400">{weeks} semanas seguidas</span> 🔥
          </div>
          {lastVisit && (
            <div className="text-[11px] text-muted-foreground">
              Última visita em {formatDate(lastVisit)} — não perca o ritmo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function WalletCard({ item }: { item: WalletItem }) {
  const est = item.establishment as { slug: string; name: string; logo_url: string | null; primary_color: string; active: boolean };
  const card = item.card;
  const req = card ? (card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
  const stamps = card?.stamps ?? 0;
  const pct = Math.min(100, Math.round((stamps / req) * 100));
  const missing = Math.max(0, req - stamps);
  const reward = card ? (card.campaign as { reward_title: string }).reward_title : null;
  const campaignActive = card ? (card.campaign as { active: boolean }).active : true;

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
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold">{est.name}</h3>
            {!est.active && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                inativo
              </span>
            )}
            {!campaignActive && (
              <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-amber-600 dark:text-amber-300">
                expirado
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
