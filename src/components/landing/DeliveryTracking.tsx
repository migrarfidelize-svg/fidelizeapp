import { Bike, Clock, MapPin, PackageCheck, Route as RouteIcon, ShieldCheck, Store, Wallet } from "lucide-react";
import { useInView } from "./use-in-view";

/**
 * Seção "Entregas rastreadas" — mostra o módulo de entregadores da Fidelize.
 * Mapa estilizado com rota animada (loja → cliente), moto percorrendo o trajeto
 * e timeline de status sincronizada. Tudo em CSS/SVG (SSR-safe, sem estado).
 * Contraste: fundo claro do tema, textos em foreground/muted-foreground.
 */

const PATH =
  "M46,232 C110,232 128,186 176,178 C232,168 246,120 300,112 C352,104 366,66 424,60";

const STEPS = [
  { icon: Store, title: "Pedido aceito", desc: "Chegou no painel e no WhatsApp do lojista." },
  { icon: Bike, title: "Entregador a caminho", desc: "Rota real pelas ruas, sem contramão." },
  { icon: MapPin, title: "Cliente acompanha", desc: "Link de rastreio com posição ao vivo." },
  { icon: PackageCheck, title: "Entregue e pago", desc: "Baixa automática e repasse no financeiro." },
];

const PERKS = [
  { icon: RouteIcon, label: "Rotas otimizadas", value: "Trânsito em tempo real" },
  { icon: Clock, label: "Previsão de chegada", value: "Atualizada a cada minuto" },
  { icon: Wallet, label: "Financeiro do entregador", value: "Saques e taxas por plano" },
  { icon: ShieldCheck, label: "Entregadores aprovados", value: "Validação de documentos" },
];

export function DeliveryTracking() {
  const { ref, inView } = useInView<HTMLElement>(0.15);

  return (
    <section ref={ref} id="entregas" className="relative overflow-hidden border-y border-border bg-background py-16 md:py-20">
      <style>{`
        @keyframes fz-dash { to { stroke-dashoffset: 0 } }
        @keyframes fz-ride { to { offset-distance: 100% } }
        @keyframes fz-ping-soft { 0% { transform:scale(.6); opacity:.55 } 100% { transform:scale(2.1); opacity:0 } }
        @keyframes fz-step { 0%,8% { opacity:.45 } 16%,30% { opacity:1 } 38%,100% { opacity:.45 } }
        .fz-route { stroke-dasharray: 620; stroke-dashoffset: 620; animation: fz-dash 6s ease-in-out infinite alternate; }
        .fz-rider { offset-path: path("${PATH}"); offset-rotate: 0deg; animation: fz-ride 6s ease-in-out infinite alternate; }
        .fz-ping { animation: fz-ping-soft 2.4s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .fz-route { stroke-dashoffset: 0; animation: none }
          .fz-rider, .fz-ping { animation: none }
        }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_65%)]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Bike className="h-3.5 w-3.5" /> Novo · Entregas
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
            Seu pedido sai da loja e o cliente <span className="text-primary">vê chegando</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Chame um entregador da plataforma ou use a sua própria equipe. A rota, o tempo e o pagamento
            ficam registrados no mesmo painel da fidelidade.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-center">
          {/* Mapa animado */}
          <div
            className={`relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-xl ${inView ? "animate-fade-in" : "opacity-0"}`}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                <span className="truncate text-sm font-semibold text-card-foreground">Entrega #2841 em andamento</span>
              </div>
              <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-semibold text-primary">
                12 min
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-muted">
              <svg viewBox="0 0 470 290" className="block h-auto w-full">
                {/* malha viária */}
                <g stroke="currentColor" className="text-foreground/10" strokeWidth="10" strokeLinecap="round">
                  <path d="M-10,232 H480" />
                  <path d="M-10,112 H480" />
                  <path d="M176,-10 V300" />
                  <path d="M300,-10 V300" />
                  <path d="M424,-10 V300" />
                </g>
                <g stroke="currentColor" className="text-foreground/[0.06]" strokeWidth="4">
                  <path d="M-10,60 H480" />
                  <path d="M-10,178 H480" />
                  <path d="M46,-10 V300" />
                  <path d="M362,-10 V300" />
                </g>

                {/* rota */}
                <path d={PATH} fill="none" stroke="currentColor" className="text-primary/20" strokeWidth="6" strokeLinecap="round" />
                <path
                  d={PATH}
                  fill="none"
                  stroke="currentColor"
                  className="fz-route text-primary"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                {/* origem */}
                <circle cx="46" cy="232" r="9" className="fill-card" stroke="currentColor" strokeWidth="3" style={{ color: "var(--primary)" }} />
                {/* destino */}
                <circle cx="424" cy="60" r="16" className="fz-ping fill-primary/30" style={{ transformOrigin: "424px 60px" }} />
                <circle cx="424" cy="60" r="9" className="fill-primary" />
              </svg>

              {/* moto percorrendo a rota */}
              <div className="pointer-events-none absolute inset-0">
                <div className="relative h-full w-full" style={{ aspectRatio: "470 / 290" }}>
                  <span
                    className="fz-rider absolute left-0 top-0 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20"
                    style={{ scale: "calc(1 / 1)" }}
                  >
                    <Bike className="h-4 w-4" />
                  </span>
                </div>
              </div>

              {/* etiquetas */}
              <span className="absolute bottom-3 left-3 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-card-foreground shadow-sm">
                Loja
              </span>
              <span className="absolute right-3 top-3 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-[11px] font-semibold text-card-foreground shadow-sm">
                Cliente · 2,4 km
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["Entregador", "Lucas M."],
                ["Distância", "2,4 km"],
                ["Taxa", "R$ 8,50"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border/70 bg-background/60 p-2.5">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
                  <div className="truncate text-sm font-semibold text-foreground">{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline + vantagens */}
          <div className="min-w-0">
            <ol className="relative space-y-4 border-l border-border pl-6">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="relative"
                  style={{ animation: "fz-step 6s ease-in-out infinite", animationDelay: `${i * 1.5}s` }}
                >
                  <span className="absolute -left-[34px] grid h-7 w-7 place-items-center rounded-full border border-primary/30 bg-primary/12 text-primary">
                    <s.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="text-sm font-semibold text-foreground">{s.title}</div>
                  <div className="text-sm text-muted-foreground">{s.desc}</div>
                </li>
              ))}
            </ol>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {PERKS.map((p) => (
                <div key={p.label} className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-3">
                  <span className="card-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                    <p.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-card-foreground">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{p.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.07] p-4 text-sm text-foreground">
              <strong className="font-semibold">Entrega própria ou da plataforma:</strong> você escolhe por pedido.
              Sem entregador disponível, o painel libera a entrega com a sua equipe automaticamente.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
