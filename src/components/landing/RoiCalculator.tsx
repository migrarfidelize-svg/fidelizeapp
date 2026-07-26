import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calculator, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInView } from "./use-in-view";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function RoiCalculator() {
  const { ref, inView } = useInView<HTMLElement>(0.2);
  const [clients, setClients] = useState(400);
  const [ticket, setTicket] = useState(35);

  // Premissas conservadoras: +18% de frequência e 12% dos inativos recuperados.
  const extraVisits = Math.round(clients * 0.18);
  const recovered = Math.round(clients * 0.12);
  const extraRevenue = (extraVisits + recovered) * ticket;
  const planCost = 79;
  const payback = Math.max(1, Math.ceil(planCost / Math.max(1, ticket)));

  return (
    <section ref={ref} id="roi" className="relative overflow-hidden py-16 md:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_20%,hsl(var(--accent)/0.1),transparent_60%)]" />
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Calculator className="h-3.5 w-3.5" /> Calculadora de retorno
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
            <span className="block text-balance">Quanto você deixa</span>
            <span className="block text-balance">
              na mesa <span className="text-primary">todo mês?</span>
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground">Ajuste os dois números abaixo e veja o resultado na hora.</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
            <Field
              label="Clientes atendidos por mês"
              value={clients.toLocaleString("pt-BR")}
              min={50}
              max={3000}
              step={50}
              current={clients}
              onChange={setClients}
            />
            <div className="mt-7">
              <Field label="Ticket médio" value={BRL(ticket)} min={10} max={200} step={5} current={ticket} onChange={setTicket} />
            </div>
            <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
              Estimativa conservadora: +18% de frequência nos clientes cadastrados e 12% de inativos recuperados pelas
              automações de aniversário, reengajamento e níveis.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 to-card/60 p-6 backdrop-blur-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <TrendingUp className="h-3.5 w-3.5" /> projeção mensal
            </span>

            <p className="metric-number mt-4 text-4xl font-bold md:text-5xl">{inView ? BRL(extraRevenue) : BRL(0)}</p>
            <p className="text-sm text-muted-foreground">de faturamento adicional estimado</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Stat value={`+${extraVisits}`} label="visitas extras" />
              <Stat value={`${recovered}`} label="clientes recuperados" />
              <Stat value={BRL(planCost)} label="custo do plano" />
              <Stat value={`${payback} visita${payback > 1 ? "s" : ""}`} label="para o plano se pagar" />
            </div>

            <div className="mt-6 rounded-xl border border-border/60 bg-background/50 p-3 text-sm">
              Recuperando apenas <span className="font-semibold text-primary">{payback}</span> cliente
              {payback > 1 ? "s" : ""} no mês, a assinatura já se pagou.
            </div>

            <Button asChild size="lg" className="mt-5 w-full rounded-full font-semibold">
              <Link to="/auth">
                Começar grátis <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  min,
  max,
  step,
  current,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  step: number;
  current: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-sm text-muted-foreground">{label}</label>
        <span className="metric-number text-xl font-bold">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        aria-label={label}
      />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="metric-number text-lg font-bold">{value}</p>
      <p className="text-[11px] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}
