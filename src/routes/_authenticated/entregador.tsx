import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bike, Home, ListChecks, User, Wallet } from "lucide-react";
import { getMyCourier } from "@/lib/courier-app.functions";

export const Route = createFileRoute("/_authenticated/entregador")({
  component: CourierLayout,
});

const NAV = [
  { to: "/entregador", label: "Início", icon: Home, exact: true },
  { to: "/entregador/corridas", label: "Corridas", icon: ListChecks },
  { to: "/entregador/carteira", label: "Carteira", icon: Wallet },
  { to: "/entregador/perfil", label: "Perfil", icon: User },
] as const;

function CourierLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data } = useQuery({ queryKey: ["courier", "me"], queryFn: () => getMyCourier(), staleTime: 15_000 });
  const courier = data?.courier ?? null;

  return (
    <div className="min-h-[100dvh] bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="card-icon grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
            <Bike className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black leading-tight">
              {courier?.full_name ?? "Entregador Fidelize"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {courier
                ? courier.status === "approved"
                  ? courier.is_online
                    ? "Online — recebendo corridas"
                    : "Offline"
                  : courier.status === "pending"
                    ? "Cadastro em análise"
                    : courier.status === "rejected"
                      ? "Cadastro recusado"
                      : "Conta suspensa"
                : "Complete seu cadastro"}
            </p>
          </div>
          {courier?.level_code && (
            <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              {courier.level_code}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-3xl grid-cols-4">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex min-h-[60px] flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors " +
                  (active ? "text-primary" : "text-muted-foreground")
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
