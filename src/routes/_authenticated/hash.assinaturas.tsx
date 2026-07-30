import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { ScrollText as HeroIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { downloadCSV, downloadPDF } from "@/lib/export";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/hash/assinaturas")({
  component: AdminAssinaturas,
});

const PLAN_LABEL: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

function AdminAssinaturas() {
  const getOverview = useServerFn(adminGetOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => getOverview() });
  if (!data) return <LoadingSkeleton variant="page" />;
  const d = data;


  const total = d.estTotal || 1;
  const planRows = Object.entries(d.planCounts).map(([tier, count]) => {
    const pct = d.estTotal ? Math.round((count / d.estTotal) * 100) : 0;
    return [PLAN_LABEL[tier] ?? tier, count, `${pct}%`];
  });

  function exportCSV() {
    downloadCSV(`fidelize-assinaturas-${new Date().toISOString().slice(0,10)}.csv`,
      ["Métrica","Valor"],
      [["MRR", formatBRL(d.mrr)], ["Empresas totais", d.estTotal], ["Ativas", d.estActive], ["Bloqueadas", d.estBlocked], ["Pagantes", d.estTotal - (d.planCounts.free ?? 0)], ["Clientes", d.customersTotal], ["Carimbos", d.stampsTotal], ["Recompensas resgatadas", d.rewardsRedeemed], ...planRows.map(r => [`Plano ${r[0]}`, `${r[1]} (${r[2]})`])]);
  }
  function exportPDF() {
    downloadPDF(`fidelize-assinaturas-${new Date().toISOString().slice(0,10)}.pdf`, "Assinaturas & Métricas — Fidelize",
      ["Plano","Empresas","Participação"], planRows,
      `MRR: ${formatBRL(d.mrr)} · ${d.estTotal} empresas · gerado em ${new Date().toLocaleString("pt-BR")}`);
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Assinaturas"}
        title={"Assinaturas ativas"}
        subtitle={"Controle de ciclos, upgrades, downgrades e cancelamentos."}
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
          <h1 className="font-display text-3xl font-bold">Assinaturas</h1>
          <p className="text-sm text-muted-foreground mt-1">Distribuição de planos e receita recorrente.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">MRR</div><div className="mt-2 font-display text-3xl font-bold">{formatBRL(d.mrr)}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Empresas pagantes</div><div className="mt-2 font-display text-3xl font-bold">{(d.estTotal - (d.planCounts.free ?? 0)).toLocaleString("pt-BR")}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Conversão pagos</div><div className="mt-2 font-display text-3xl font-bold">{Math.round(((d.estTotal - (d.planCounts.free ?? 0)) / total) * 100)}%</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-display font-semibold">Distribuição por plano</h3>
          <div className="mt-4 space-y-4">
            {Object.entries(d.planCounts).map(([tier, count]) => {
              const pct = d.estTotal ? Math.round((count / d.estTotal) * 100) : 0;
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

      <PlanFunnelCard />
    </div>
  );
}

const STAGE_LABEL: Record<string, string> = {
  landing_select: "Escolha na landing",
  auth_intent: "Chegou no cadastro",
  checkout_open: "Checkout aberto",
  checkout_mismatch: "Divergências",
};

function PlanFunnelCard() {
  const getFunnel = useServerFn(adminPlanFunnelSummary);
  const { data } = useQuery({
    queryKey: ["admin-plan-funnel", 7],
    queryFn: () => getFunnel({ data: { days: 7 } }),
  });

  const byStage = data?.byStage ?? {};
  const mismatches = data?.mismatches ?? [];

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-display font-semibold">Funil de planos (7 dias)</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Compara o plano escolhido na landing com o plano que abriu no checkout.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {Object.keys(STAGE_LABEL).map((k) => (
            <div key={k} className="rounded-xl border p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{STAGE_LABEL[k]}</div>
              <div className={`mt-1 font-display text-2xl font-bold ${k === "checkout_mismatch" && (byStage[k] ?? 0) > 0 ? "text-destructive" : ""}`}>
                {(byStage[k] ?? 0).toLocaleString("pt-BR")}
              </div>
            </div>
          ))}
        </div>

        {mismatches.length > 0 && (
          <div className="mt-5 space-y-2">
            <div className="text-sm font-medium text-destructive">Últimas divergências</div>
            {mismatches.slice(0, 10).map((m: any) => (
              <div key={m.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <span className="text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")} · </span>
                esperado <strong>{(m.meta as any)?.expected_slug ?? "—"}</strong> · abriu <strong>{m.plan_slug ?? "—"}</strong>
                {m.source ? <span className="text-muted-foreground"> · {m.source}</span> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
