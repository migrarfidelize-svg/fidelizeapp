import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Home, LogOut, User, Gift, History, Compass, QrCode } from "lucide-react";
import { toast } from "sonner";
import { MyQrSheet } from "@/components/wallet/MyQrSheet";
import { countUnread } from "@/lib/inbox.functions";
import { getMyWallet, getMyRewards } from "@/lib/my-wallet.functions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AchievementUnlockListener } from "@/components/wallet/AchievementUnlockListener";
import { PostStampReviewSheet } from "@/components/wallet/PostStampReviewSheet";
import { CompleteProfileDialog } from "@/components/wallet/CompleteProfileDialog";
import { InboxBellBadge } from "@/components/wallet/InboxBellBadge";
import { haptic } from "@/lib/haptics";
import { setWalletHint } from "@/lib/wallet-hint";



export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { name: "theme-color", content: "#a78bfa" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Carteira" },
    ],
    links: [
      { rel: "manifest", href: "/carteira.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  component: WalletLayout,
});


/** Lê e consome uma flash message deixada por `l/$slug` ou pelo fluxo de auth. */
function useWalletFlash() {
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("wallet:flash");
      if (!raw) return;
      sessionStorage.removeItem("wallet:flash");
      const { kind, msg } = JSON.parse(raw) as { kind: "success" | "error" | "info"; msg: string };
      if (kind === "error") toast.error(msg);
      else if (kind === "info") toast.message(msg);
      else toast.success(msg);
    } catch { /* ignore */ }
  }, []);
}

/** 4 tabs laterais + slot central reservado ao FAB "Meu QR". */
const TABS = [
  { to: "/carteira", label: "Início", icon: Home, exact: true },
  { to: "/carteira/premios", label: "Prêmios", icon: Gift, exact: false },
  { to: "/carteira/historico", label: "Histórico", icon: History, exact: false },
  { to: "/carteira/descobrir", label: "Descobrir", icon: Compass, exact: false },
] as const;

function WalletLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [qrOpen, setQrOpen] = useState(false);
  const qc = useQueryClient();
  useWalletFlash();

  // Perfil vira obrigatório nas ações de valor: prêmios e cartão do estabelecimento.
  const profileRequired =
    pathname.startsWith("/carteira/premios") ||
    /^\/carteira\/(?!premios|historico|descobrir|perfil|conquistas|mensagens|retrospectiva|e\/)[^/]+/.test(pathname);


  // Piggyback no cache já hidratado pela home para descobrir os customer_ids.
  const { data: wallet } = useQuery({
    queryKey: ["my-wallet"],
    queryFn: () => getMyWallet(),
    staleTime: 15_000,
  });
  const customerIds = useMemo(
    () => Array.from(new Set((wallet ?? []).map((w) => w.customer?.id).filter(Boolean) as string[])),
    [wallet],
  );

  // Realtime global: qualquer carimbo em qualquer cartão do cliente dispara
  // haptic + toast + refresh, mesmo fora da tela `/c/$token`.
  useEffect(() => {
    if (!customerIds.length) return;
    const filter = `customer_id=in.(${customerIds.join(",")})`;
    const channel = supabase
      .channel("wallet-global-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stamps", filter }, () => {
        haptic("stamp");
        toast.success("Novo carimbo! 🎉");
        qc.invalidateQueries({ queryKey: ["my-wallet"] });
        qc.invalidateQueries({ queryKey: ["my-history"] });
        qc.invalidateQueries({ queryKey: ["my-rewards"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rewards", filter }, () => {
        haptic("success");
        toast.success("Recompensa desbloqueada! 🎁");
        qc.invalidateQueries({ queryKey: ["my-wallet"] });
        qc.invalidateQueries({ queryKey: ["my-rewards"] });
      });
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [customerIds.join(","), qc]);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Você saiu da sua carteira.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-dvh bg-background pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/carteira" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Minha</div>
              <div className="font-display text-base font-bold">Carteira Fidelize</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <InboxBell pathname={pathname} />
            <ThemeToggle />
            <Link
              to="/carteira/perfil"
              className={
                "grid h-9 w-9 place-items-center rounded-full border transition-colors " +
                (pathname.startsWith("/carteira/perfil")
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground")
              }
              aria-label="Meu perfil"
            >
              <User className="h-4 w-4" />
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-label="Sair"
            >
              <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <Outlet />
      </main>

      {/* Bottom nav com FAB central "Meu QR" */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal da carteira"
      >
        <div className="relative mx-auto grid max-w-3xl grid-cols-5 items-stretch">
          {TABS.slice(0, 2).map((t) => (
            <NavItem key={t.to} tab={t} pathname={pathname} />
          ))}

          {/* Slot central: FAB elevado */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => setQrOpen(true)}
              className="group -mt-6 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_10px_30px_-8px_color-mix(in_oklab,var(--primary)_60%,transparent)] ring-4 ring-background transition-transform hover:scale-[1.04] active:scale-95"
              aria-label="Mostrar meu QR"
            >
              <QrCode className="h-6 w-6 transition-transform group-hover:rotate-3" />
              <span className="pointer-events-none absolute -bottom-4 text-[9px] font-bold uppercase tracking-widest text-primary">
                Meu QR
              </span>
            </button>
          </div>

          {TABS.slice(2, 4).map((t) => (
            <NavItem key={t.to} tab={t} pathname={pathname} />
          ))}
        </div>
      </nav>

      <MyQrSheet open={qrOpen} onOpenChange={setQrOpen} />
      <AchievementUnlockListener />
      <PostStampReviewSheet />
      <CompleteProfileDialog required={profileRequired} />
    </div>
  );
}

function NavItem({ tab, pathname }: { tab: (typeof TABS)[number]; pathname: string }) {
  const active = tab.exact ? pathname === tab.to : pathname === tab.to || pathname.startsWith(tab.to + "/");
  const Icon = tab.icon;
  return (
    <Link
      to={tab.to}
      className={
        "relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors " +
        (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
      }
      aria-current={active ? "page" : undefined}
    >
      {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden />}
      <Icon className={"h-5 w-5 " + (active ? "text-primary" : "")} />
      <span className="leading-none">{tab.label}</span>
    </Link>
  );
}

function InboxBell({ pathname }: { pathname: string }) {
  const active = pathname.startsWith("/carteira/mensagens");
  const { data: unread = 0 } = useQuery({
    queryKey: ["inbox-unread"],
    queryFn: () => countUnread(),
    staleTime: 30_000,
    refetchInterval: 90_000,
  });
  const { data: rewards = [] } = useQuery({
    queryKey: ["my-rewards"],
    queryFn: () => getMyRewards(),
    staleTime: 30_000,
  });
  const readyRewards = rewards.filter((r) => r.ready).length;
  return <InboxBellBadge unread={unread} active={active} readyRewards={readyRewards} />;
}
