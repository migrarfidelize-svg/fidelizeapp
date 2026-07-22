import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Home, LogOut, User, Gift, History, Compass, QrCode, Bell } from "lucide-react";
import { toast } from "sonner";
import { MyQrSheet } from "@/components/wallet/MyQrSheet";
import { countUnread } from "@/lib/inbox.functions";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/_authenticated/carteira")({
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
  { to: "/carteira/premios", label: "Cartões", icon: Gift, exact: false },
  { to: "/carteira/historico", label: "Histórico", icon: History, exact: false },
  { to: "/carteira/descobrir", label: "Descobrir", icon: Compass, exact: false },
] as const;

function WalletLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [qrOpen, setQrOpen] = useState(false);
  useWalletFlash();

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
  return (
    <Link
      to="/carteira/mensagens"
      className={
        "relative grid h-9 w-9 place-items-center rounded-full border transition-colors " +
        (active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/60 text-muted-foreground hover:text-foreground")
      }
      aria-label={unread > 0 ? `${unread} mensagens não lidas` : "Mensagens"}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span
          className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-[18px] text-primary-foreground shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_55%,transparent)]"
          aria-hidden
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
