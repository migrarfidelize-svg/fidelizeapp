import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEstablishments, getDashboardData } from "@/lib/loyalty.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Stamp, Gift, TrendingUp, ArrowRight, Sparkles, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { GoalsCard } from "@/components/GoalsCard";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

function Dashboard() {
  const getEsts = useServerFn(getMyEstablishments);
  const getData = useServerFn(getDashboardData);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;
  const { data } = useQuery({
    enabled: !!est,
    queryKey: ["dashboard", est?.id],
    queryFn: () => getData({ data: { establishment_id: est!.id } }),
  });

  if (!est || !data) return <div className="text-muted-foreground">Carregando painel…</div>;

  const stats = [
    { label: "Clientes", value: data.customersCount, icon: Users, color: "text-primary" },
    { label: "Carimbos", value: data.stampsCount, icon: Stamp, color: "text-accent" },
    { label: "Recompensas", value: data.rewardsCount, icon: Gift, color: "text-success" },
    { label: "Resgatadas", value: data.redeemedCount, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Painel</div>
          <h1 className="font-display text-3xl font-bold">{est.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/l/$slug" params={{ slug: est.slug }}>Ver página pública</Link></Button>
          <Button asChild className="gradient-brand text-primary-foreground"><Link to="/app/carimbar">Carimbar cliente <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div className="mt-2 font-display text-3xl font-bold">{s.value.toLocaleString("pt-BR")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MoMCard label="Novos clientes este mês" current={data.mom.customers.current} previous={data.mom.customers.previous} />
        <MoMCard label="Carimbos este mês" current={data.mom.stamps.current} previous={data.mom.stamps.previous} />
        <MoMCard label="Recompensas resgatadas" current={data.mom.rewards.current} previous={data.mom.rewards.previous} />
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


      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Carimbos nos últimos 30 dias</h3>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
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
          <h3 className="font-display font-semibold">Top clientes</h3>
          <div className="mt-4 divide-y">
            {data.topCustomers.length === 0 && <div className="text-sm text-muted-foreground py-6 text-center">Nenhum cliente ainda. Compartilhe seu QR Code!</div>}
            {data.topCustomers.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Última visita: {formatDate(c.last_visit_at)}</div>
                </div>
                <div className="text-sm font-mono">{c.visits_count} visitas</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MoMCard({ label, current, previous }: { label: string; current: number; previous: number }) {
  const delta = current - previous;
  const pct = previous > 0 ? (delta / previous) * 100 : current > 0 ? 100 : 0;
  const up = delta > 0, down = delta < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const cls = up ? "text-success" : down ? "text-destructive" : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <div className="font-display text-3xl font-bold">{current.toLocaleString("pt-BR")}</div>
          <div className={`flex items-center gap-1 text-sm font-medium ${cls}`}>
            <Icon className="h-4 w-4" />
            {previous === 0 && current === 0 ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Mês anterior: {previous.toLocaleString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}
