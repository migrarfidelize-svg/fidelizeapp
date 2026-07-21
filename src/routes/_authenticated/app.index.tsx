import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, getDashboardData } from "@/lib/loyalty.functions";
import {
  Users, Stamp, Gift, ArrowRight, Sparkles,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Crown, Activity,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { GoalsCard } from "@/components/GoalsCard";
import { ErrorState, LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const getEsts = useServerFn(getMyEstablishments);
  const getData = useServerFn(getDashboardData);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;
  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: !!est,
    queryKey: ["dashboard", est?.id],
    queryFn: () => getData({ data: { establishment_id: est!.id } }),
  });

  if (!est || isLoading || !data) {
    if (isError) return <ErrorState title="Não foi possível carregar o painel" error={error} onRetry={() => refetch()} />;
    return <LoadingSkeleton variant="page" />;
  }

  const stats = [
    { label: "Clientes", value: data.customersCount, icon: Users, accent: false },
    { label: "Carimbos", value: data.stampsCount, icon: Stamp, accent: true },
    { label: "Recompensas", value: data.rewardsCount, icon: Gift, accent: false },
    { label: "Resgatadas", value: data.redeemedCount, icon: Crown, accent: true },
  ];

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="dash-hero p-6 sm:p-8">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary/80">
              <Activity className="h-3.5 w-3.5" /> Painel Fidelize
            </div>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight">
              {est.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Métricas em tempo real do seu programa de fidelidade.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-primary/30 hover:border-primary/60">
              <Link to="/l/$slug" params={{ slug: est.slug }}>Ver página pública</Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-6px_var(--primary)]">
              <Link to="/app/carimbar">
                <Zap className="mr-1 h-4 w-4" /> Carimbar cliente
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPI GRID */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`dash-card dash-rise ${s.accent ? "dash-card-accent" : ""} p-5`}
            style={{ animationDelay: `${i * 80}ms`, ["--sweep" as any]: `${i * 90}deg` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-2 metric-solid text-3xl sm:text-4xl">{s.value.toLocaleString("pt-BR")}</div>
              </div>
              <span className={`card-icon ${s.accent ? "card-icon-accent" : ""}`} aria-hidden>
                <s.icon />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* MoM */}
      <div className="grid gap-4 lg:grid-cols-3">
        <MoMCard label="Novos clientes este mês" current={data.mom.customers.current} previous={data.mom.customers.previous} delay={0} />
        <MoMCard label="Carimbos este mês" current={data.mom.stamps.current} previous={data.mom.stamps.previous} delay={80} accent />
        <MoMCard label="Recompensas resgatadas" current={data.mom.rewards.current} previous={data.mom.rewards.previous} delay={160} />
      </div>

      <GoalsCard
        establishmentId={est.id}
        month={data.goalMonth}
        goals={data.goals}
        current={{
          customers: data.mom.customers.current,
          stamps: data.mom.stamps.current,
          rewards: data.mom.rewards.current,
        }}
      />

      {/* CHART */}
      <div className="dash-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Últimos 30 dias</div>
            <h3 className="font-display text-lg font-semibold">Carimbos aplicados</h3>
          </div>
          <span className="card-icon" aria-hidden><Sparkles /></span>
        </div>
        <div className="mt-6 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="currentColor" opacity={0.5} />
              <Tooltip
                contentStyle={{
                  background: "color-mix(in oklab, var(--card) 92%, transparent)",
                  border: "1px solid color-mix(in oklab, var(--primary) 40%, transparent)",
                  borderRadius: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="carimbos"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "var(--color-primary)", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TOP CUSTOMERS */}
      <div className="dash-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Fidelidade</div>
            <h3 className="font-display text-lg font-semibold">Top clientes</h3>
          </div>
          <span className="card-icon card-icon-accent" aria-hidden><Crown /></span>
        </div>
        <div className="mt-4 divide-y divide-border/50">
          {data.topCustomers.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhum cliente ainda. Compartilhe seu QR Code!
            </div>
          )}
          {data.topCustomers.map((c, i) => (
            <div key={c.id} className="flex items-center justify-between py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-grid h-9 w-9 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary font-semibold text-sm">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Última visita: {formatDate(c.last_visit_at)}</div>
                </div>
              </div>
              <div className="text-sm font-mono text-primary">{c.visits_count} visitas</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MoMCard({
  label, current, previous, delay = 0, accent = false,
}: { label: string; current: number; previous: number; delay?: number; accent?: boolean }) {
  const delta = current - previous;
  const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  const up = delta > 0, down = delta < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
  return (
    <div
      className={`dash-card dash-rise ${accent ? "dash-card-accent" : ""} p-5`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <div className="metric-number text-3xl">{current.toLocaleString("pt-BR")}</div>
        <span className={`dash-delta ${cls}`}>
          <Icon className="h-3.5 w-3.5" />
          {previous === 0 && current === 0 ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Mês anterior: {previous.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}
