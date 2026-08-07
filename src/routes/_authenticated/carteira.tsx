import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { 
  Home, 
  Compass, 
  Wallet, 
  User, 
  QrCode,
  Search,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/LogoMark";

export const Route = createFileRoute("/_authenticated/carteira")({
  component: WalletLayout,
});

function WalletLayout() {
  const location = useLocation();
  const activeTab = location.pathname;

  const tabs = [
    { icon: Home, label: "Início", path: "/carteira" },
    { icon: Compass, label: "Descobrir", path: "/carteira/descobrir" },
    { icon: QrCode, label: "QR", path: "/qr", isFab: true },
    { icon: Wallet, label: "Vouchers", path: "/carteira/vouchers" },
    { icon: User, label: "Perfil", path: "/carteira/perfil" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[oklch(0.985_0.006_285)] dark:bg-[oklch(0.14_0.018_288)]">
      {/* Header Premium Clean */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <LogoMark size={32} className="rounded-xl shadow-sm" />
            <span className="font-display text-lg font-black tracking-tight text-primary">Fidelize</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Search className="h-5 w-5" />
            </button>
            <button className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-24">
        <Outlet />
      </main>

      {/* Bottom Nav Premium Clean */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
        <div className="flex w-full max-w-md items-center justify-around gap-1 rounded-3xl border border-white/20 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-2xl pointer-events-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.path || (tab.path === "/carteira" && activeTab === "/carteira/");
            const Icon = tab.icon;

            if (tab.isFab) {
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="group relative -top-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg transition-transform active:scale-95 hover:scale-105"
                >
                  <Icon className="h-7 w-7" />
                  <div className="absolute -inset-1 rounded-2xl bg-primary/20 blur-lg group-hover:bg-primary/30 transition-colors" />
                </Link>
              );
            }

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition-all active:scale-95",
                  isActive ? "text-primary" : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                <span className={cn("transition-opacity", isActive ? "opacity-100" : "opacity-60")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
