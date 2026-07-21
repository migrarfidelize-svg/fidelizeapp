import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { DollarSign as HeroIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetFinancial } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, DollarSign, Repeat, Users, AlertTriangle, Clock, ArrowUpRight } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { downloadCSV, downloadPDF } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  component: AdminFinanceiro,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

function AdminFinanceiro() {
  const getFin = useServerFn(adminGetFinancial);
  const { data, isLoading } = useQuery({ queryKey: ["admin-financial"], queryFn: () => getFin() });

  if (isLoading || !data) return <div className="text-muted-foreground">Carregando dados financeiros…</div>;
  const d = data;

  const maxMonthAbs = Math.max(1, ...d.months.map(m => Math.max(m.mrrNew, m.churn)));
  const planRows = Object.entries(d.revenueByPlan).sort((a, b) => b[1].mrr - a[1].mrr);

  function exportCSV() {
    const rows: (string | number)[][] = [
      ["MRR", formatBRL(d.mrr)],
      ["ARR", formatBRL(d.arr)],
      ["ARPU", formatBRL(d.arpu)],
      ["Empresas pagantes", d.activePaying],
      ["Empresas ativas", d.activeEst],
      ["Churn 30d (%)", d.churnRate.toFixed(2)],
      ["Cancelamentos 30d", d.cancels30],
      [],
      ["Plano", "Empresas", "MRR"],
      ...planRows.map(([, v]) => [v.name, v.count, formatBRL(v.mrr)]),
      [],
      ["Mês", "Novo MRR", "Churn MRR", "Líquido"],
      ...d.months.map(m => [m.month, formatBRL(m.mrrNew), formatBRL(m.churn), formatBRL(m.net)]),
    ];
    downloadCSV(`fidelize-financeiro-${new Date().toISOString().slice(0, 10)}.csv`, ["Métrica", "Valor"], rows);
  }
  function exportPDF() {
    downloadPDF(
      `fidelize-financeiro-${new Date().toISOString().slice(0, 10)}.pdf`,
      "Financeiro — Fidelize",
      ["Plano", "Empresas", "MRR"],
      planRows.map(([, v]) => [v.name, v.count, formatBRL(v.mrr)]),
      `MRR ${formatBRL(d.mrr)} · ARR ${formatBRL(d.arr)} · ARPU ${formatBRL(d.arpu)} · Churn 30d ${d.churnRate.toFixed(2)}% · gerado em ${new Date().toLocaleString("pt-BR")}`
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Financeiro"}
        title={"Receita & MRR"}
        subtitle={"Faturamento consolidado, MRR, churn e projeções reais."}
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
          <h1 className="font-display text-3xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">Receita recorrente, renovações e saúde financeira da plataforma.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="MRR" value={formatBRL(d.mrr)} hint="Receita mensal recorrente" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="ARR" value={formatBRL(d.arr)} hint="Projeção anual" />
        <Kpi icon={<Users className="h-4 w-4" />} label="ARPU" value={formatBRL(d.arpu)} hint={`${d.activePaying} empresas pagantes`} />
        <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Churn 30d" value={`${d.churnRate.toFixed(2)}%`} hint={`${d.cancels30} cancelamentos`} tone={d.churnRate > 5 ? "danger" : "default"} />
      </div>

      {/* MRR chart + Plans breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Evolução do MRR — 12 meses</h3>
              <div className="flex gap-3 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Novo</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/70" />Churn</span>
              </div>
            </div>
            <div className="mt-6 flex items-end gap-2 h-48">
              {d.months.map(m => {
                const upH = (m.mrrNew / maxMonthAbs) * 100;
                const dnH = (m.churn / maxMonthAbs) * 100;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="flex-1 w-full flex flex-col justify-end gap-0.5">
                      <div className="bg-primary rounded-t transition-all group-hover:opacity-80" style={{ height: `${upH}%` }} title={`Novo: ${formatBRL(m.mrrNew)}`} />
                      <div className="bg-destructive/70 rounded-b transition-all group-hover:opacity-80" style={{ height: `${dnH}%` }} title={`Churn: ${formatBRL(m.churn)}`} />
                    </div>
                    <div className="text-[9px] text-muted-foreground">{m.month.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-display font-semibold">Receita por plano</h3>
            <div className="mt-4 space-y-4">
              {planRows.length === 0 && <div className="text-sm text-muted-foreground">Sem dados.</div>}
              {planRows.map(([tier, v]) => {
                const pct = d.mrr ? Math.round((v.mrr / d.mrr) * 100) : 0;
                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-muted-foreground">{formatBRL(v.mrr)} · {pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full gradient-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{v.count} empresa(s)</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming renewals + Top revenue */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Repeat className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Renovações nos próximos 30 dias</h3>
              <Badge variant="secondary" className="ml-auto">{d.upcoming.length}</Badge>
            </div>
            {d.upcoming.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma renovação prevista.</div>
            ) : (
              <ul className="divide-y">
                {d.upcoming.slice(0, 10).map(u => {
                  const days = daysUntil(u.current_period_end);
                  return (
                    <li key={u.id} className="py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <Link to="/admin/empresa/$id" params={{ id: u.establishment_id }} className="text-sm font-medium hover:underline block truncate">{u.establishment_name}</Link>
                        <div className="text-xs text-muted-foreground">{u.tier} · {fmtDate(u.current_period_end)} · em {days}d</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{formatBRL(u.amount)}</div>
                        {u.cancel_at_period_end && <Badge variant="destructive" className="text-[9px]">Cancelará</Badge>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Top empresas por receita</h3>
            </div>
            {d.topRevenue.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ul className="divide-y">
                {d.topRevenue.map((e, i) => (
                  <li key={e.id} className="py-2.5 flex items-center gap-3">
                    <div className="w-6 text-center text-xs font-bold text-muted-foreground">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <Link to="/admin/empresa/$id" params={{ id: e.id }} className="text-sm font-medium hover:underline block truncate">{e.name}</Link>
                      <div className="text-xs text-muted-foreground uppercase">{e.plan}</div>
                    </div>
                    <div className="text-sm font-semibold">{formatBRL(e.mrr)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trials */}
      {d.trials.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Trials em andamento</h3>
              <Badge variant="secondary" className="ml-auto">{d.trials.length}</Badge>
            </div>
            <ul className="divide-y">
              {d.trials.map(t => {
                const days = daysUntil(t.trial_ends_at);
                return (
                  <li key={t.id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.establishment_name}</div>
                      <div className="text-xs text-muted-foreground">{t.tier} · termina em {fmtDate(t.trial_ends_at)}</div>
                    </div>
                    <Badge variant={days <= 3 ? "destructive" : "secondary"}>{days}d</Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {d.churnRate > 5 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Alerta de churn elevado</div>
              <div className="text-sm text-muted-foreground mt-0.5">Taxa de cancelamento em 30 dias está acima de 5%. Revise as empresas canceladas na aba de Alertas.</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, hint, tone = "default" }: { icon: React.ReactNode; label: string; value: string; hint?: string; tone?: "default" | "danger" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"}`}>{icon}</span>
          {label}
        </div>
        <div className={`mt-2 font-display text-3xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
