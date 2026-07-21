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

// Each item takes this fraction of viewport height in scroll distance.
const PER_ITEM_VH = 60;

export function SegmentsCarousel() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1 within active item

  useEffect(() => {
    const compute = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = el.offsetHeight - vh; // scroll distance available inside sticky
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      const p = total > 0 ? scrolled / total : 0;
      const raw = p * ITEMS.length;
      const idx = Math.min(ITEMS.length - 1, Math.floor(raw));
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

  const ActiveIcon = ITEMS[active].icon;

  return (
    <div
      ref={wrapperRef}
      className="relative mx-auto w-full"
      style={{ height: `${ITEMS.length * PER_ITEM_VH + 100}vh` }}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        {/* soft ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 45%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%)",
          }}
        />

        <div className="relative flex flex-col items-center justify-center gap-10">
          {/* Icon stage */}
          <div className="relative flex h-[min(46vh,420px)] w-[min(46vh,420px)] items-center justify-center">
            {ITEMS.map((it, i) => {
              const Icon = it.icon;
              const isActive = i === active;
              // enter: current progress (0->1), previous items already gone, future items waiting
              let opacity = 0;
              let scale = 0.6;
              let y = 40;
              let blur = 12;
              if (isActive) {
                // fade in during first 30%, fade out during last 20%
                const inP = Math.min(1, progress / 0.3);
                const outP = Math.max(0, (progress - 0.8) / 0.2);
                opacity = inP * (1 - outP);
                scale = 0.85 + 0.15 * inP - 0.05 * outP;
                y = (1 - inP) * 40 - outP * 30;
                blur = (1 - inP) * 10 + outP * 8;
              }
              return (
                <div
                  key={it.label}
                  aria-hidden={!isActive}
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    opacity,
                    transform: `translateY(${y}px) scale(${scale})`,
                    filter: `blur(${blur}px)`,
                    transition: "opacity 200ms linear, filter 200ms linear",
                    color: "var(--primary)",
                  }}
                >
                  <Icon
                    strokeWidth={1.25}
                    className="h-full w-full"
                    style={{
                      filter:
                        "drop-shadow(0 20px 40px color-mix(in oklab, var(--primary) 55%, transparent)) drop-shadow(0 0 30px color-mix(in oklab, var(--primary) 40%, transparent))",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Label */}
          <div className="relative h-14 overflow-hidden">
            <div
              key={active}
              className="animate-fade-in font-display text-3xl font-bold tracking-tight text-foreground md:text-5xl"
            >
              {ITEMS[active].label}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {ITEMS.map((_, i) => (
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

          {/* Active item progress bar */}
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
