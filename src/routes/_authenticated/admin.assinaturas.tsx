import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/assinaturas")({
  component: AdminAssinaturas,
});

const PLAN_LABEL: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

function AdminAssinaturas() {
  const getOverview = useServerFn(adminGetOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => getOverview() });
  if (!data) return <div className="text-muted-foreground">Carregando…</div>;

  const total = data.estTotal || 1;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
        <h1 className="font-display text-3xl font-bold">Assinaturas</h1>
        <p className="text-sm text-muted-foreground mt-1">Distribuição de planos e receita recorrente.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">MRR estimado</div><div className="mt-2 font-display text-3xl font-bold">{formatBRL(data.mrr)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Empresas pagantes</div><div className="mt-2 font-display text-3xl font-bold">{(data.estTotal - (data.planCounts.free ?? 0)).toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Conversão pagos</div><div className="mt-2 font-display text-3xl font-bold">{Math.round(((data.estTotal - (data.planCounts.free ?? 0)) / total) * 100)}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-display font-semibold">Distribuição por plano</h3>
          <div className="mt-4 space-y-4">
            {Object.entries(data.planCounts).map(([tier, count]) => {
              const pct = data.estTotal ? Math.round((count / data.estTotal) * 100) : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{PLAN_LABEL[tier] ?? tier}</span>
                    <span className="text-muted-foreground">{count} empresas · {pct}%</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full gradient-brand" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
