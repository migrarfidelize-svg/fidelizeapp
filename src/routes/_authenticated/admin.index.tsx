import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, Stamp, Gift, TrendingUp, Ban, CheckCircle2, DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

const PLAN_LABEL: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };

function AdminOverview() {
  const getOverview = useServerFn(adminGetOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => getOverview() });
  if (!data) return <div className="text-muted-foreground">Carregando visão geral…</div>;

  const stats = [
    { label: "Empresas", value: data.estTotal, icon: Building2, color: "text-primary" },
    { label: "Ativas", value: data.estActive, icon: CheckCircle2, color: "text-success" },
    { label: "Bloqueadas", value: data.estBlocked, icon: Ban, color: "text-destructive" },
    { label: "MRR estimado", value: formatBRL(data.mrr), icon: DollarSign, color: "text-accent", isText: true },
    { label: "Clientes", value: data.customersTotal, icon: Users, color: "text-primary" },
    { label: "Carimbos", value: data.stampsTotal, icon: Stamp, color: "text-accent" },
    { label: "Recompensas", value: data.rewardsTotal, icon: Gift, color: "text-success" },
    { label: "Resgatadas", value: data.rewardsRedeemed, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
        <h1 className="font-display text-3xl font-bold">Visão consolidada</h1>
        <p className="text-sm text-muted-foreground mt-1">Métricas de toda a plataforma Fidelize.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="mt-2 font-display text-2xl font-bold">{s.isText ? s.value : (s.value as number).toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-display font-semibold">Carimbos nos últimos 30 dias</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="carimbos" stroke="var(--color-primary)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-display font-semibold">Distribuição por plano</h3>
            <div className="mt-4 space-y-3">
              {Object.entries(data.planCounts).map(([tier, count]) => {
                const pct = data.estTotal ? Math.round((count / data.estTotal) * 100) : 0;
                return (
                  <div key={tier}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{PLAN_LABEL[tier] ?? tier}</span>
                      <span className="text-muted-foreground">{count} · {pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full gradient-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Empresas recentes</h3>
            <Link to="/admin/empresas" className="text-xs text-primary font-medium">Ver todas →</Link>
          </div>
          <div className="mt-4 divide-y">
            {data.recentEsts.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma empresa cadastrada.</div>}
            {data.recentEsts.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">/{e.slug} · {formatDate(e.created_at)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">{PLAN_LABEL[e.plan] ?? e.plan}</span>
                  {e.active
                    ? <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success/10 text-success">Ativa</span>
                    : <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 text-destructive">Bloqueada</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
