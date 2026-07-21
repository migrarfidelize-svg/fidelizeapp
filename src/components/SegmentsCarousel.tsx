import { useEffect, useRef, useState } from "react";
import { Coffee, Scissors, Sparkles, Pizza, IceCream2, Croissant, PawPrint, Wrench, Store } from "lucide-react";

const ITEMS = [
  { icon: Coffee, label: "Cafeterias", tag: "+38% retorno" },
  { icon: Scissors, label: "Barbearias", tag: "Fila cheia" },
  { icon: Sparkles, label: "Salões", tag: "Clientes VIP" },
  { icon: Pizza, label: "Pizzarias", tag: "Delivery fiel" },
  { icon: IceCream2, label: "Sorveterias", tag: "Sabor + retorno" },
  { icon: Croissant, label: "Padarias", tag: "Café da manhã" },
  { icon: PawPrint, label: "Pet Shops", tag: "Tutor recorrente" },
  { icon: Wrench, label: "Oficinas", tag: "Manutenção" },
  { icon: Store, label: "Lojas", tag: "Ticket médio" },
];

const GROUPS = Array.from({ length: Math.ceil(ITEMS.length / 3) }, (_, i) => ITEMS.slice(i * 3, i * 3 + 3));

// Tighter scroll distance per group so the section doesn't feel empty between transitions
const PER_GROUP_VH = 45;

export function SegmentsCarousel() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const compute = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = el.offsetHeight - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      const raw = p * GROUPS.length;
      const idx = Math.min(GROUPS.length - 1, Math.floor(raw));
      setActive(idx);
      setProgress(raw - idx);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative mx-auto w-full"
      style={{ height: `${GROUPS.length * PER_GROUP_VH + 30}vh` }}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <linearGradient id="segIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7dfcff" />
              <stop offset="50%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
            <filter id="segIconGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Ambient wash */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 65%)",
          }}
        />

        <div className="relative flex w-full flex-col items-center justify-center gap-10 px-6">
          {/* Stage */}
          <div className="relative w-full max-w-5xl">
            {GROUPS.map((group, gi) => {
              const isActive = gi === active;
              const inP = Math.min(1, progress / 0.22);
              const outP = Math.max(0, (progress - 0.78) / 0.22);
              const opacity = isActive ? inP * (1 - outP) : 0;
              return (
                <div
                  key={gi}
                  aria-hidden={!isActive}
                  className="absolute inset-0 grid grid-cols-3 items-center justify-items-center gap-4 md:gap-8"
                  style={{
                    opacity,
                    transition: "opacity 220ms ease",
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  {group.map((it, i) => {
                    const Icon = it.icon;
                    const delay = i * 100;
                    const cardIn = Math.max(0, Math.min(1, (inP - i * 0.08) / 0.6));
                    return (
                      <div
                        key={it.label}
                        className="segment-card group relative flex w-full max-w-[220px] flex-col items-center gap-3 rounded-2xl border border-cyan-400/15 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-4 backdrop-blur-md md:p-6"
                        style={{
                          transform: `translateY(${(1 - cardIn) * 40}px) scale(${0.9 + cardIn * 0.1})`,
                          opacity: cardIn,
                          transition: `transform 520ms cubic-bezier(.2,.85,.2,1) ${delay}ms, opacity 520ms ease ${delay}ms`,
                          boxShadow:
                            "0 20px 50px -20px rgba(0,255,255,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
                        }}
                      >
                        {/* Conic halo ring */}
                        <span
                          aria-hidden
                          className="segment-ring pointer-events-none absolute inset-0 rounded-2xl"
                        />

                        {/* Icon stage */}
                        <div className="relative flex h-[min(16vh,140px)] w-[min(16vh,140px)] items-center justify-center">
                          {/* pedestal glow */}
                          <span
                            aria-hidden
                            className="absolute inset-4 rounded-full"
                            style={{
                              background:
                                "radial-gradient(circle, color-mix(in oklab, var(--primary) 45%, transparent) 0%, transparent 70%)",
                              filter: "blur(20px)",
                              opacity: 0.7,
                            }}
                          />
                          {/* inner disc */}
                          <span
                            aria-hidden
                            className="absolute inset-2 rounded-full border"
                            style={{
                              borderColor: "color-mix(in oklab, var(--primary) 30%, transparent)",
                              background:
                                "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06), transparent 60%), #050b12",
                              boxShadow:
                                "inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -20px 30px -10px rgba(0,255,255,0.15)",
                            }}
                          />
                          {/* Icon (SVG w/ gradient stroke) */}
                          <Icon
                            strokeWidth={1.15}
                            className="relative h-[60%] w-[60%]"
                            style={{
                              stroke: "url(#segIconGrad)",
                              color: "transparent",
                              filter:
                                "drop-shadow(0 8px 22px color-mix(in oklab, var(--primary) 55%, transparent)) drop-shadow(0 0 10px color-mix(in oklab, var(--accent) 35%, transparent))",
                            }}
                          />
                          {/* scan sweep on active */}
                          <span
                            aria-hidden
                            className="segment-sweep absolute inset-2 rounded-full"
                          />
                        </div>

                        <div className="font-display text-base font-bold tracking-tight text-foreground md:text-xl">
                          {it.label}
                        </div>
                        <span className="rounded-full border border-cyan-400/25 bg-cyan-400/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90 md:text-[11px]">
                          {it.tag}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* invisible spacer to reserve stage height */}
            <div className="invisible grid grid-cols-3 gap-4 md:gap-8">
              {GROUPS[0].map((it) => (
                <div key={it.label} className="flex w-full max-w-[220px] flex-col items-center gap-3 p-4 md:p-6">
                  <div className="h-[min(16vh,140px)] w-[min(16vh,140px)]" />
                  <div className="font-display text-base md:text-xl">{it.label}</div>
                  <div className="text-[10px] md:text-[11px]">{it.tag}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {GROUPS.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: i === active ? 32 : 8,
                  background:
                    i < active
                      ? "color-mix(in oklab, var(--primary) 80%, transparent)"
                      : i === active
                      ? "var(--primary)"
                      : "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
                  boxShadow: i === active ? "0 0 12px var(--primary)" : undefined,
                }}
              />
            ))}
          </div>

          <div className="h-[2px] w-40 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full origin-left"
              style={{
                width: `${progress * 100}%`,
                background: "var(--primary)",
                boxShadow: "0 0 10px var(--primary)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
