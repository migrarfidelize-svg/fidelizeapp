import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Home, LogOut, User, Gift, History, CreditCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/carteira")({
  component: WalletLayout,
});

const TABS = [
  { to: "/carteira", label: "Início", icon: Home, exact: true },
  { to: "/carteira/cartoes", label: "Cartões", icon: CreditCard, exact: false },
  { to: "/carteira/recompensas", label: "Recompensas", icon: Gift, exact: false },
  { to: "/carteira/historico", label: "Histórico", icon: History, exact: false },
  { to: "/carteira/perfil", label: "Perfil", icon: User, exact: false },
] as const;

function WalletLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <Outlet />
      </main>

      {/* Mobile-first bottom nav (5 tabs — sem opções administrativas) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegação principal da carteira"
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-around">
          {TABS.map((t) => {
            const active = t.exact ? pathname === t.to : pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={
                  "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors " +
                  (active ? "text-primary" : "text-muted-foreground hover:text-foreground")
                }
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" aria-hidden />
                )}
                <Icon className={"h-5 w-5 " + (active ? "text-primary" : "")} />
                <span className="leading-none">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
