import { useEffect, useRef, useState } from "react";
import { Coffee, Scissors, Sparkles, Pizza, IceCream2, Croissant, PawPrint, Wrench, Store } from "lucide-react";

const ITEMS = [
  { icon: Coffee, label: "Cafeterias" },
  { icon: Scissors, label: "Barbearias" },
  { icon: Sparkles, label: "Salões" },
  { icon: Pizza, label: "Pizzarias" },
  { icon: IceCream2, label: "Sorveterias" },
  { icon: Croissant, label: "Padarias" },
  { icon: PawPrint, label: "Pet Shops" },
  { icon: Wrench, label: "Oficinas" },
  { icon: Store, label: "Lojas" },
];

// chunk in groups of 3
const GROUPS = Array.from({ length: Math.ceil(ITEMS.length / 3) }, (_, i) => ITEMS.slice(i * 3, i * 3 + 3));

// Each group takes this fraction of viewport height in scroll distance.
const PER_GROUP_VH = 70;

export function SegmentsCarousel() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 within active group

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
      style={{ height: `${GROUPS.length * PER_GROUP_VH + 60}vh` }}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <linearGradient id="segStrokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="55%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
        </svg>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 60%)",
          }}
        />

        <div className="relative flex w-full flex-col items-center justify-center gap-12 px-6">
          {/* Row of 3 icons */}
          <div className="relative w-full max-w-5xl">
            {GROUPS.map((group, gi) => {
              const isActive = gi === active;
              const inP = Math.min(1, progress / 0.25);
              const outP = Math.max(0, (progress - 0.75) / 0.25);
              const opacity = isActive ? inP * (1 - outP) : 0;
              const y = isActive ? (1 - inP) * 30 - outP * 20 : 0;
              return (
                <div
                  key={gi}
                  aria-hidden={!isActive}
                  className="absolute inset-0 grid grid-cols-3 items-center justify-items-center gap-6 md:gap-10"
                  style={{
                    opacity,
                    transform: `translateY(${y}px)`,
                    transition: "opacity 180ms linear",
                    pointerEvents: isActive ? "auto" : "none",
                  }}
                >
                  {group.map((it, i) => {
                    const Icon = it.icon;
                    const delay = i * 80;
                    return (
                      <div key={it.label} className="flex flex-col items-center gap-4">
                        <div
                          className="relative flex h-[min(22vh,200px)] w-[min(22vh,200px)] items-center justify-center"
                          style={{
                            transform: `translateY(${(1 - inP) * 20}px)`,
                            transition: `transform 350ms cubic-bezier(.2,.8,.2,1) ${delay}ms`,
                          }}
                        >
                          <Icon
                            strokeWidth={1.1}
                            aria-hidden
                            className="absolute h-[70%] w-[70%]"
                            style={{ color: "var(--primary)", opacity: 0.5, filter: "blur(14px)" }}
                          />
                          <Icon
                            strokeWidth={1.1}
                            className="relative h-[78%] w-[78%]"
                            style={{
                              stroke: "url(#segStrokeGrad)",
                              color: "transparent",
                              filter:
                                "drop-shadow(0 18px 32px color-mix(in oklab, var(--primary) 45%, transparent)) drop-shadow(0 0 18px color-mix(in oklab, var(--accent) 35%, transparent))",
                            }}
                          />
                        </div>
                        <div className="font-display text-lg font-bold tracking-tight text-foreground md:text-2xl">
                          {it.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* spacer to reserve height */}
            <div className="invisible grid grid-cols-3 gap-6 md:gap-10">
              {GROUPS[0].map((it) => (
                <div key={it.label} className="flex flex-col items-center gap-4">
                  <div className="h-[min(22vh,200px)] w-[min(22vh,200px)]" />
                  <div className="font-display text-lg font-bold md:text-2xl">{it.label}</div>
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
