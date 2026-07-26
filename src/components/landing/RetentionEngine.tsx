import { useEffect, useState } from "react";
import { Bell, Cake, Crown, Gift, Stamp, UserPlus, Moon, type LucideIcon } from "lucide-react";
import { useInView, prefersReducedMotion } from "./use-in-view";

type Step = {
  day: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  push?: { title: string; body: string };
  automatic: boolean;
};

const STEPS: Step[] = [
  { day: "Dia 0", title: "Primeira visita", desc: "Cliente escaneia o QR e ganha o 1º carimbo.", icon: Stamp, automatic: false },
  { day: "Dia 7", title: "Silêncio", desc: "Ele não voltou. Antes, você nem ficaria sabendo.", icon: Moon, automatic: false },
  {
    day: "Dia 10",
    title: "Reengajamento automático",
    desc: "O sistema identifica a inatividade e dispara sozinho.",
    icon: Bell,
    push: { title: "Sentimos sua falta 👋", body: "Faltam 3 carimbos para o seu combo grátis." },
    automatic: true,
  },
  { day: "Dia 12", title: "Ele voltou", desc: "Visita recuperada sem você levantar um dedo.", icon: Stamp, automatic: true },
  {
    day: "Dia 20",
    title: "Aniversário",
    desc: "Mimo enviado na data certa, com prazo para usar.",
    icon: Cake,
    push: { title: "Feliz aniversário! 🎂", body: "Sua sobremesa é por nossa conta esta semana." },
    automatic: true,
  },
  { day: "Dia 25", title: "Subiu para Prata", desc: "Nível novo desbloqueia benefício e vira status.", icon: Crown, automatic: true },
  {
    day: "Dia 28",
    title: "Indicação",
    desc: "Ele traz um amigo e os dois ganham. Seu cliente virou canal.",
    icon: UserPlus,
    push: { title: "Indique e ganhe 🎁", body: "Você e seu amigo ganham 2 carimbos extras." },
    automatic: true,
  },
];

export function RetentionEngine() {
  const { ref, inView } = useInView<HTMLElement>(0.2);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused || prefersReducedMotion()) return;
    const id = setInterval(() => setActive((i) => (i + 1) % STEPS.length), 3200);
    return () => clearInterval(id);
  }, [inView, paused]);

  const step = STEPS[active];
  const progress = ((active + 1) / STEPS.length) * 100;

  return (
    <section
      ref={ref}
      id="retencao"
      className="relative overflow-hidden py-16 md:py-20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/3 h-64 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_70%)]" />
      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            <Gift className="h-3.5 w-3.5" /> Retenção automática
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
            <span className="block text-balance">Você dormindo.</span>
            <span className="block text-balance">
              O sistema <span className="text-primary">trabalhando</span>
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            30 dias reais de um cliente. Cada etapa acontece sozinha, no momento certo.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-5xl">
          <div className="relative">
            <div className="absolute left-0 right-0 top-5 h-px bg-border" />
            <div
              className="absolute left-0 top-5 h-px bg-gradient-to-r from-primary to-accent transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
            <div className="relative flex justify-between gap-1">
              {STEPS.map((s, i) => {
                const done = i <= active;
                return (
                  <button
                    key={s.day}
                    onClick={() => setActive(i)}
                    className="group flex flex-1 flex-col items-center gap-2"
                    aria-label={`${s.day} — ${s.title}`}
                  >
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-500 ${
                        done
                          ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_22px_-6px_color-mix(in_oklch,var(--primary)_90%,transparent)]"
                          : "border-border bg-card text-muted-foreground"
                      } ${i === active ? "scale-110" : ""}`}
                    >
                      <s.icon className="h-4.5 w-4.5" />
                    </span>
                    <span className={`text-[10px] font-semibold tracking-wide md:text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {s.day}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 grid items-center gap-8 md:grid-cols-2">
            <div key={step.day} className="animate-fade-in">
              {step.automatic && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> automático
                </span>
              )}
              <h3 className="mt-3 font-display text-2xl font-bold">{step.title}</h3>
              <p className="mt-2 max-w-md text-muted-foreground">{step.desc}</p>

              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3">
                  <p className="metric-number text-xl font-bold">3</p>
                  <p className="text-[11px] text-muted-foreground">clientes recuperados nesta semana</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/50 px-4 py-3">
                  <p className="metric-number text-xl font-bold">0</p>
                  <p className="text-[11px] text-muted-foreground">mensagens enviadas na mão</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="relative w-[260px] rounded-[2.2rem] border border-border/70 bg-card/60 p-3 shadow-2xl backdrop-blur-xl">
                <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-border" />
                <div className="relative h-[400px] overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-background to-card">
                  <div className="flex items-center justify-between px-4 pt-3 text-[10px] text-muted-foreground">
                    <span>9:41</span>
                    <span>▲ ▮▮</span>
                  </div>

                  {step.push ? (
                    <div key={`${step.day}-push`} className="animate-scale-in mx-3 mt-4 rounded-2xl border border-primary/30 bg-background/95 p-3 shadow-[0_0_30px_-10px_color-mix(in_oklch,var(--primary)_80%,transparent)]">
                      <div className="flex items-center gap-2">
                        <span className="card-icon flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                          <Bell className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fidelize · agora</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{step.push.title}</p>
                      <p className="text-xs text-muted-foreground">{step.push.body}</p>
                    </div>
                  ) : (
                    <div className="mx-3 mt-4 rounded-2xl border border-dashed border-border/70 p-3 text-center text-[11px] text-muted-foreground">
                      sem envio manual nesta etapa
                    </div>
                  )}

                  <div className="mx-3 mt-4 rounded-2xl border border-border/60 bg-card/70 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground">Meu cartão</p>
                    <div className="mt-2 grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const filled = i < Math.min(10, active + 2);
                        return (
                          <span
                            key={i}
                            className={`flex aspect-square items-center justify-center rounded-md border text-[9px] transition-all duration-500 ${
                              filled ? "border-primary/50 bg-primary/20 text-primary" : "border-border/60 text-muted-foreground/50"
                            }`}
                          >
                            {filled ? "★" : i + 1}
                          </span>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Nível atual: <span className="font-semibold text-foreground">{active >= 5 ? "Prata" : "Bronze"}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
