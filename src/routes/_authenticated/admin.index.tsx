import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { LayoutDashboard as HeroIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin.functions";
import {
  Building2, Users, Stamp, Gift, TrendingUp, Ban, CheckCircle2,
  DollarSign, Shield, Activity, Crown,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { formatBRL, formatDate } from "@/lib/format";



export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

const PLAN_LABEL: Record<string, string> = {
  free: "Gratuito", starter: "Starter", pro: "Pro", enterprise: "Enterprise",
};

function AdminOverview() {
  const getOverview = useServerFn(adminGetOverview);
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: () => getOverview() });
  if (!data) return <div className="text-muted-foreground">Carregando visão geral…</div>;

  const stats: Array<{
    label: string; value: string | number; icon: any; accent?: boolean; isText?: boolean;
  }> = [
    { label: "Empresas", value: data.estTotal, icon: Building2 },
    { label: "Ativas", value: data.estActive, icon: CheckCircle2, accent: true },
    { label: "Bloqueadas", value: data.estBlocked, icon: Ban },
    { label: "MRR", value: formatBRL(data.mrr), icon: DollarSign, accent: true, isText: true },
    { label: "Clientes", value: data.customersTotal, icon: Users },
    { label: "Carimbos", value: data.stampsTotal, icon: Stamp, accent: true },
    { label: "Recompensas", value: data.rewardsTotal, icon: Gift },
    { label: "Resgatadas", value: data.rewardsRedeemed, icon: TrendingUp, accent: true },
  ];

  return (
    <div className="space-y-8">
      <PageHero


        icon={HeroIcon}
        eyebrow={"Super Admin · Global"}
        liveLabel={"Ao vivo"}
        title={"Visão global da plataforma"}
        subtitle={"Métricas consolidadas de empresas, receita e operação em tempo real."}
      />
      {/* HERO */}
      <section className="dash-hero p-6 sm:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
              <Shield className="h-3.5 w-3.5" /> Super Administração
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Visão consolidada
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Métricas em tempo real de toda a plataforma Fidelize.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary/80">
            <Activity className="h-3.5 w-3.5 animate-pulse" /> Live
          </div>
        </div>
      </section>

      {/* KPI GRID */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`dash-card dash-rise ${s.accent ? "dash-card-accent" : ""} p-5`}
            style={{ animationDelay: `${i * 60}ms`, ["--sweep" as any]: `${i * 45}deg` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-2 metric-number text-2xl sm:text-3xl">
                  {s.isText ? s.value : (s.value as number).toLocaleString("pt-BR")}
                </div>
              </div>
              <span className={`card-icon ${s.accent ? "card-icon-accent" : ""}`} aria-hidden>
                <s.icon />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CHART + PLAN DISTRIBUTION */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="dash-card lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Últimos 30 dias</div>
              <h3 className="font-display text-lg font-semibold">Carimbos na plataforma</h3>
            </div>
            <span className="card-icon" aria-hidden><Activity /></span>
          </div>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series}>
                <defs>
                  <linearGradient id="admArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.5} />
                <Tooltip
                  contentStyle={{
                    background: "color-mix(in oklab, var(--card) 92%, transparent)",
                    border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                    borderRadius: 12,
                  }}
                />
                <Area type="monotone" dataKey="carimbos" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#admArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card dash-card-accent p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Distribuição</div>
              <h3 className="font-display text-lg font-semibold">Por plano</h3>
            </div>
            <span className="card-icon card-icon-accent" aria-hidden><Crown /></span>
          </div>
          <div className="mt-6 space-y-4">
            {Object.entries(data.planCounts).map(([tier, count]) => {
              const pct = data.estTotal ? Math.round((count / data.estTotal) * 100) : 0;
              return (
                <div key={tier}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{PLAN_LABEL[tier] ?? tier}</span>
                    <span className="text-muted-foreground text-xs">{count} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-muted/40 overflow-hidden border border-primary/10">
                    <div
                      className="h-full gradient-brand transition-all duration-700"
                      style={{ width: `${pct}%`, boxShadow: "0 0 12px -2px var(--primary)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RECENT */}
      <div className="dash-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Cadastros</div>
            <h3 className="font-display text-lg font-semibold">Empresas recentes</h3>
          </div>
          <Link to="/admin/empresas" className="text-xs text-primary font-medium hover:underline">
            Ver todas →
          </Link>
        </div>
        <div className="mt-4 divide-y divide-border/50">
          {data.recentEsts.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma empresa cadastrada.</div>
          )}
          {data.recentEsts.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-grid h-9 w-9 place-items-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">/{e.slug} · {formatDate(e.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary">
                  {PLAN_LABEL[e.plan] ?? e.plan}
                </span>
                {e.active ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success/10 border border-success/30 text-success">Ativa</span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 border border-destructive/30 text-destructive">Bloqueada</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
