import { useEffect, useRef, useState } from "react";
import coffee from "@/assets/segments/coffee.png";
import barber from "@/assets/segments/barber.png";
import salon from "@/assets/segments/salon.png";
import pizza from "@/assets/segments/pizza.png";
import icecream from "@/assets/segments/icecream.png";
import bakery from "@/assets/segments/bakery.png";
import petshop from "@/assets/segments/petshop.png";
import workshop from "@/assets/segments/workshop.png";
import store from "@/assets/segments/store.png";

const ITEMS = [
  { src: coffee, label: "Cafeterias" },
  { src: barber, label: "Barbearias" },
  { src: salon, label: "Salões" },
  { src: pizza, label: "Pizzarias" },
  { src: icecream, label: "Sorveterias" },
  { src: bakery, label: "Padarias" },
  { src: petshop, label: "Pet Shops" },
  { src: workshop, label: "Oficinas" },
  { src: store, label: "Lojas" },
];

// Slot geometry (px). Center is big; neighbors shrink and blur progressively.
const SLOT = 260; // horizontal spacing between item centers
const CENTER_SIZE = 340;

export function SegmentsCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % ITEMS.length), 2200);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto w-full overflow-hidden"
      style={{ height: CENTER_SIZE + 100 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* edge fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-40 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-40 bg-gradient-to-l from-background to-transparent" />

      <div
        className="absolute top-1/2 left-1/2 flex items-center"
        style={{
          transform: `translate(${-(active * SLOT + SLOT / 2)}px, -50%)`,
          transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          gap: 0,
        }}
      >
        {ITEMS.map((it, i) => {
          const dist = Math.abs(i - active);
          const isActive = dist === 0;
          const scale = isActive ? 1 : dist === 1 ? 0.55 : 0.4;
          const blur = isActive ? 0 : dist === 1 ? 4 : 10;
          const opacity = isActive ? 1 : dist === 1 ? 0.55 : 0.25;
          return (
            <button
              key={it.label}
              type="button"
              onClick={() => setActive(i)}
              className="group relative flex shrink-0 flex-col items-center justify-center focus:outline-none"
              style={{ width: SLOT, height: CENTER_SIZE }}
              aria-label={it.label}
            >
              <div
                className="relative"
                style={{
                  width: CENTER_SIZE,
                  height: CENTER_SIZE,
                  transform: `scale(${scale})`,
                  filter: `blur(${blur}px)`,
                  opacity,
                  transition:
                    "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), filter 700ms ease, opacity 700ms ease",
                }}
              >
                {/* Active stage — glow halo */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-[36px]"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 500ms ease",
                    background:
                      "radial-gradient(closest-side, color-mix(in oklab, hsl(var(--primary)) 22%, transparent), transparent 72%)",
                  }}
                />
                {/* Glass frame with primary border */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-[36px]"
                  style={{
                    opacity: isActive ? 1 : 0,
                    transition: "opacity 500ms ease",
                    border: "1px solid color-mix(in oklab, hsl(var(--primary)) 55%, transparent)",
                    boxShadow:
                      "inset 0 0 0 1px color-mix(in oklab, hsl(var(--primary)) 22%, transparent), 0 20px 60px -20px color-mix(in oklab, hsl(var(--primary)) 55%, transparent), 0 0 80px -10px color-mix(in oklab, hsl(var(--primary)) 40%, transparent)",
                    background:
                      "linear-gradient(180deg, color-mix(in oklab, hsl(var(--card)) 55%, transparent), color-mix(in oklab, hsl(var(--background)) 25%, transparent))",
                    backdropFilter: "blur(8px)",
                  }}
                />
                {/* Rotating conic ring */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-2 rounded-[44px]"
                  style={{
                    opacity: isActive ? 0.9 : 0,
                    transition: "opacity 500ms ease",
                    padding: 2,
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)) 90deg, transparent 200deg, hsl(var(--primary)) 300deg, transparent 360deg)",
                    WebkitMask:
                      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                    WebkitMaskComposite: "xor",
                    maskComposite: "exclude",
                    animation: isActive ? "seg-ring 6s linear infinite" : undefined,
                  }}
                />
                {/* HUD corner ticks */}
                {isActive && (
                  <>
                    <span className="absolute left-2 top-2 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-primary" />
                    <span className="absolute right-2 top-2 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-primary" />
                    <span className="absolute bottom-2 left-2 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-primary" />
                    <span className="absolute bottom-2 right-2 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-primary" />
                  </>
                )}
                <img
                  src={it.src}
                  alt={it.label}
                  width={CENTER_SIZE}
                  height={CENTER_SIZE}
                  loading="lazy"
                  className="relative h-full w-full object-contain"
                  style={{
                    animation: isActive ? "seg-float 3.5s ease-in-out infinite" : undefined,
                    filter: isActive
                      ? "drop-shadow(0 18px 30px color-mix(in oklab, hsl(var(--primary)) 45%, transparent))"
                      : undefined,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active label */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 text-center">
        <div
          key={active}
          className="inline-block font-display text-2xl font-bold text-foreground animate-fade-in md:text-3xl"
        >
          {ITEMS[active].label}
        </div>
      </div>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-[-2rem] z-20 flex justify-center gap-1.5">
        {ITEMS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Ir para ${ITEMS[i].label}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === active ? 22 : 6,
              background: i === active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.35)",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes seg-float {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-10px) rotate(1deg); }
        }
        @keyframes seg-ring {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
