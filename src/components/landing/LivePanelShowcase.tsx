import { useEffect, useState } from "react";
import { BarChart3, Users, Megaphone, LayoutDashboard, ArrowUpRight, type LucideIcon } from "lucide-react";
import { useInView, useCountUp, prefersReducedMotion } from "./use-in-view";

type Metric = { label: string; value: number; suffix?: string; prefix?: string; decimals?: number };

type Tab = {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  metrics: Metric[];
  rows: Array<[string, string, string]>;
};

const TABS: Tab[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    headline: "Visão do dia",
    metrics: [
      { label: "Clientes ativos", value: 1284 },
      { label: "Carimbos hoje", value: 87 },
      { label: "Recompensas resgatadas", value: 19 },
      { label: "Taxa de retorno", value: 62, suffix: "%" },
    ],
    rows: [
      ["Mariana S.", "7º carimbo", "há 2 min"],
      ["Rodrigo A.", "Resgatou combo", "há 11 min"],
      ["Bianca L.", "Novo cliente", "há 24 min"],
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: Users,
    headline: "Base viva",
    metrics: [
      { label: "Cadastrados", value: 3140 },
      { label: "Voltaram no mês", value: 1946 },
      { label: "Nível Ouro", value: 212 },
      { label: "Inativos recuperados", value: 138 },
    ],
    rows: [
      ["Ana P. · Ouro", "12 visitas", "última: ontem"],
      ["Caio M. · Prata", "6 visitas", "última: 3 dias"],
      ["Júlia R. · Bronze", "2 visitas", "última: 9 dias"],
    ],
  },
  {
    id: "campanhas",
    label: "Campanhas",
    icon: Megaphone,
    headline: "Disparos ativos",
    metrics: [
      { label: "Campanhas ativas", value: 5 },
      { label: "Mensagens entregues", value: 8420 },
      { label: "Abertura", value: 71, suffix: "%" },
      { label: "Visitas geradas", value: 604 },
    ],
    rows: [
      ["Aniversariantes", "automática", "312 envios"],
      ["Reengajamento 15 dias", "automática", "188 envios"],
      ["Terça do combo", "agendada", "104 envios"],
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    headline: "Resultado real",
    metrics: [
      { label: "Faturamento influenciado", value: 42.7, prefix: "R$ ", suffix: "k", decimals: 1 },
      { label: "Ticket médio", value: 38, prefix: "R$ " },
      { label: "Frequência mensal", value: 2.4, decimals: 1, suffix: "x" },
      { label: "Acessos ao cardápio", value: 9310 },
    ],
    rows: [
      ["Cardápio digital", "4.108 acessos", "+18%"],
      ["Árvore de links", "2.640 cliques", "+9%"],
      ["Página de avaliações", "1.512 visitas", "+27%"],
    ],
  },
];

function MetricValue({ metric, active }: { metric: Metric; active: boolean }) {
  const v = useCountUp(metric.value, active);
  const formatted = v.toLocaleString("pt-BR", {
    minimumFractionDigits: metric.decimals ?? 0,
    maximumFractionDigits: metric.decimals ?? 0,
  });
  return (
    <span className="metric-number text-2xl font-bold md:text-3xl">
      {metric.prefix}
      {formatted}
      {metric.suffix}
    </span>
  );
}

export function LivePanelShowcase() {
  const { ref, inView } = useInView<HTMLElement>(0.2);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const tab = TABS[index];

  useEffect(() => {
    if (!inView || paused || prefersReducedMotion()) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % TABS.length), 5200);
    return () => clearInterval(id);
  }, [inView, paused]);

  return (
    <section
      ref={ref}
      id="painel"
      className="relative overflow-hidden border-y bg-gradient-to-b from-background via-card/25 to-background py-16 md:py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <LayoutDashboard className="h-3.5 w-3.5" /> Painel do lojista
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
            <span className="block text-balance">O cliente vê o cartão.</span>
            <span className="block text-balance">
              Você vê <span className="text-primary">o negócio inteiro</span>
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Tudo que acontece na loja vira número aqui dentro — em tempo real, sem planilha.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setIndex(i)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all ${
                i === index
                  ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_20px_-6px_hsl(var(--primary)/0.7)]"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-5xl rounded-3xl border border-border/70 bg-card/50 p-3 backdrop-blur-xl md:p-5">
          <div className="mb-3 flex items-center gap-2 px-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            <span className="ml-3 truncate text-xs text-muted-foreground">app.fidelize.com/{tab.id}</span>
          </div>

          <div key={tab.id} className="animate-fade-in rounded-2xl border border-border/60 bg-background/60 p-4 md:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{tab.headline}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> ao vivo
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {tab.metrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-border/60 bg-card/60 p-3">
                  <MetricValue metric={m} active={inView} />
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-border/60">
              {tab.rows.map((row, i) => (
                <div
                  key={row[0]}
                  className="flex animate-fade-in items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-sm last:border-0"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <span className="truncate font-medium">{row[0]}</span>
                  <span className="hidden truncate text-muted-foreground sm:block">{row[1]}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {row[2]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
