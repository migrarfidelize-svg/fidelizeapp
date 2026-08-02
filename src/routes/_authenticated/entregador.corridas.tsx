import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { listMyDeliveries } from "@/lib/courier-app.functions";

export const Route = createFileRoute("/_authenticated/entregador/corridas")({
  head: () => ({
    meta: [
      { title: "Minhas Corridas — Fidelize" },
      { name: "description", content: "Histórico completo das entregas realizadas pelo entregador Fidelize." },
      { property: "og:title", content: "Minhas Corridas — Fidelize" },
      { property: "og:description", content: "Veja todas as suas entregas, valores e status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierRides,
});

const money = (c?: number | null) => `R$ ${((c ?? 0) / 100).toFixed(2).replace(".", ",")}`;

function CourierRides() {
  const { data, isLoading } = useQuery({ queryKey: ["courier", "rides"], queryFn: () => listMyDeliveries() });

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>;
  const rows = (data ?? []) as any[];
  const done = rows.filter((r) => r.status === "delivered");
  const total = done.reduce((s, r) => s + Number(r.courier_net_cents ?? 0), 0);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="metric-number text-2xl">{done.length}</p>
          <p className="text-[11px] text-muted-foreground">Entregas concluídas</p>
        </div>
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="metric-number text-2xl">{money(total)}</p>
          <p className="text-[11px] text-muted-foreground">Total recebido</p>
        </div>
      </section>

      {rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          Você ainda não fez corridas. Fique online para receber as primeiras.
        </p>
      )}

      <section className="space-y-2">
        {rows.map((r) => {
          const Icon = r.status === "delivered" ? CheckCircle2 : r.status === "cancelled" ? XCircle : Clock;
          return (
            <div key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <Icon
                className={
                  "h-5 w-5 shrink-0 " +
                  (r.status === "delivered" ? "text-primary" : r.status === "cancelled" ? "text-destructive" : "text-muted-foreground")
                }
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{r.establishments?.name ?? "Entrega"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {r.dropoff_address ? ` · ${r.dropoff_address}` : ""}
                </p>
              </div>
              <span className="metric-number shrink-0 text-sm">{money(r.courier_net_cents)}</span>
            </div>
          );
        })}
      </section>
    </div>
  );
}
