import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyEstablishments, getDashboardData } from "@/lib/loyalty.functions";
import {
  Users, Stamp, Gift, ArrowRight, Sparkles,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Crown,
  QrCode, TrendingUp, Trophy, Clock, LayoutDashboard,
  Activity, Percent, Gauge,
} from "lucide-react";
import {
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart,
} from "recharts";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { GoalsCard } from "@/components/GoalsCard";
import { PageHero } from "@/components/PageHero";
import { DashboardHeroVisual } from "@/components/DashboardHeroVisual";
import { ErrorState, LoadingSkeleton } from "@/components/states";
import { GreetingVoice } from "@/components/GreetingVoice";


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

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!est || isLoading || !data) {
    if (isError) return <ErrorState title="Não foi possível carregar o painel" error={error} onRetry={() => refetch()} />;
    return <LoadingSkeleton variant="page" />;
  }

  const last7 = data.series.slice(-7);
  const last7Total = last7.reduce((a, d) => a + (d.carimbos || 0), 0);
  const today = data.series[data.series.length - 1]?.carimbos ?? 0;
  const avgPerCustomer = data.customersCount > 0
    ? (data.stampsCount / data.customersCount)
    : 0;
  const conversionPct = data.rewardsCount > 0
    ? Math.round((data.redeemedCount / data.rewardsCount) * 100)
    : 0;
  const monthStampsCurrent = data.mom.stamps.current;
  const daysElapsed = Math.max(1, now.getDate());
  const dailyPace = monthStampsCurrent / daysElapsed;

  const stats = [
    { label: "Carimbos hoje", value: today.toLocaleString("pt-BR"), hint: "atualiza a cada 30s", icon: Activity, accent: true },
    { label: "Média por cliente", value: avgPerCustomer.toFixed(1), hint: "carimbos por cliente ativo", icon: TrendingUp, accent: false },
    { label: "Conversão recompensas", value: `${conversionPct}%`, hint: `${data.redeemedCount}/${data.rewardsCount} resgatadas`, icon: Percent, accent: true },
    { label: "Ritmo diário do mês", value: dailyPace.toFixed(1), hint: `média em ${daysElapsed} dias`, icon: Gauge, accent: false },
  ];

  const dayLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const timeLabel = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-8">
      <PageHero
        icon={LayoutDashboard}
        liveLabel="Ao vivo"
        eyebrow={`${dayLabel} · ${timeLabel}`}
        title={est.name}
        subtitle="Comando de operações do seu programa de fidelidade."
        actions={
          <>
            <Button asChild variant="outline" className="border-primary/30 hover:border-primary/60">
              <Link to="/l/$slug" params={{ slug: est.slug }}>
                <QrCode className="mr-1 h-4 w-4" /> Página pública
              </Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-6px_var(--primary)]">
              <Link to="/app/carimbar">
                <Zap className="mr-1 h-4 w-4" /> Carimbar cliente
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
        ticker={[
          { label: "Últimos 7 dias", value: `${last7Total} carimbos`, icon: TrendingUp },
          { label: "Base ativa", value: `${data.customersCount} clientes`, icon: Users },
          { label: "Recompensas", value: `${data.redeemedCount} resgatadas`, icon: Trophy },
          { label: "Meta do mês", value: data.goalMonth, icon: Clock },
        ]}
        visual={
          <DashboardHeroVisual
            series={data.series}
            todayStamps={today}
            customers={data.customersCount}
            redeemed={data.redeemedCount}
          />
        }
      />



      {/* KPI STRIP */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`dash-card dash-rise ${s.accent ? "dash-card-accent" : ""} p-5`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-2 metric-solid text-3xl sm:text-4xl">{s.value}</div>
                {s.hint && <div className="mt-1 text-[11px] text-muted-foreground truncate">{s.hint}</div>}
              </div>
              <span className={`card-icon ${s.accent ? "card-icon-accent" : ""}`} aria-hidden>
                <s.icon />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN GRID — Chart (2 cols) + Top clients rail */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="dash-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Últimos 30 dias</div>
              <h3 className="sec-title mt-1 text-lg">Fluxo de carimbos</h3>
            </div>
            <span className="card-icon" aria-hidden><Sparkles /></span>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="stampFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="carimbos"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fill="url(#stampFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Fidelidade</div>
              <h3 className="sec-title mt-1 text-lg">Top clientes</h3>
            </div>
            <span className="card-icon card-icon-accent" aria-hidden><Crown /></span>
          </div>
          <div className="mt-4 space-y-4">
            {data.topCustomers.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Nenhum cliente ainda. Compartilhe seu QR Code!
              </div>
            )}
            {data.topCustomers.slice(0, 6).map((c, i) => {
              const max = data.topCustomers[0]?.visits_count || 1;
              const pct = Math.max(6, Math.round((c.visits_count / max) * 100));
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="inline-grid h-7 w-7 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary font-semibold text-xs shrink-0">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDate(c.last_visit_at)}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-primary shrink-0">{c.visits_count}</span>
                  </div>
                  <div className="rank-bar"><span style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
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
        <div className="metric-solid text-3xl">{current.toLocaleString("pt-BR")}</div>
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
