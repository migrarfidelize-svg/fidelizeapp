import { useEffect, useState } from "react";
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

const CENTER_SIZE = 340;
const SIDE_OFFSET = 260; // horizontal distance from center to neighbors

export function SegmentsCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % ITEMS.length), 2600);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="relative mx-auto w-full overflow-hidden"
      style={{ height: CENTER_SIZE + 240 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* edge fade */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-40 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-40 bg-gradient-to-l from-background to-transparent" />

      {/* Stage */}
      <div className="absolute inset-0">
        {ITEMS.map((it, i) => {
          // signed distance -N..+N with wrap-around for shortest path
          let d = i - active;
          const n = ITEMS.length;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;

          const abs = Math.abs(d);
          const isActive = abs === 0;
          const scale = isActive ? 1 : abs === 1 ? 0.55 : 0.4;
          const blur = isActive ? 0 : abs === 1 ? 4 : 10;
          const opacity = isActive ? 1 : abs === 1 ? 0.55 : abs === 2 ? 0.25 : 0;
          const x = d * SIDE_OFFSET;
          const z = 100 - abs;

          return (
            <button
              key={it.label}
              type="button"
              onClick={() => setActive(i)}
              aria-label={it.label}
              className="absolute left-1/2 top-1/2 focus:outline-none"
              style={{
                width: CENTER_SIZE,
                height: CENTER_SIZE,
                marginLeft: -CENTER_SIZE / 2,
                marginTop: -CENTER_SIZE / 2,
                transform: `translateX(${x}px) scale(${scale})`,
                opacity,
                filter: `blur(${blur}px)`,
                zIndex: z,
                transition:
                  "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), filter 700ms ease, opacity 700ms ease",
                pointerEvents: opacity < 0.05 ? "none" : "auto",
              }}
            >
              {/* halo */}
              <div
                aria-hidden
                className="absolute inset-0 rounded-[36px]"
                style={{
                  opacity: isActive ? 1 : 0,
                  transition: "opacity 500ms ease",
                  background:
                    "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 28%, transparent), transparent 72%)",
                }}
              />
              {/* glass frame with strong cyan border */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[36px]"
                style={{
                  opacity: isActive ? 1 : 0,
                  transition: "opacity 500ms ease",
                  border: "2px solid var(--primary)",
                  boxShadow:
                    "inset 0 0 0 1px color-mix(in oklab, var(--primary) 35%, transparent), inset 0 0 40px color-mix(in oklab, var(--primary) 15%, transparent), 0 30px 80px -20px color-mix(in oklab, var(--primary) 70%, transparent), 0 0 120px -10px color-mix(in oklab, var(--primary) 55%, transparent)",
                  background:
                    "linear-gradient(180deg, color-mix(in oklab, var(--card) 75%, transparent), color-mix(in oklab, var(--background) 45%, transparent))",
                  backdropFilter: "blur(6px)",
                }}
              />
              {/* rotating conic ring */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-2 rounded-[44px]"
                style={{
                  opacity: isActive ? 0.85 : 0,
                  transition: "opacity 500ms ease",
                  padding: 2,
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, var(--primary) 90deg, transparent 200deg, var(--primary) 300deg, transparent 360deg)",
                  WebkitMask:
                    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  animation: isActive ? "seg-ring 6s linear infinite" : undefined,
                }}
              />
              {/* HUD corners */}
              {isActive && (
                <>
                  <span className="absolute left-3 top-3 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-primary" />
                  <span className="absolute right-3 top-3 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-primary" />
                  <span className="absolute bottom-3 left-3 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-primary" />
                  <span className="absolute bottom-3 right-3 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-primary" />
                </>
              )}
              <img
                src={it.src}
                alt={it.label}
                width={CENTER_SIZE}
                height={CENTER_SIZE}
                loading="lazy"
                className="relative h-full w-full object-contain p-6"
                style={{
                  animation: isActive ? "seg-float 3.5s ease-in-out infinite" : undefined,
                  filter: isActive
                    ? "drop-shadow(0 18px 30px color-mix(in oklab, var(--primary) 45%, transparent))"
                    : undefined,
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Active label */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 text-center">
        <div
          key={active}
          className="inline-block font-display text-2xl font-bold text-foreground animate-fade-in md:text-3xl"
        >
          {ITEMS[active].label}
        </div>
      </div>

      {/* Dots */}
      <div className="absolute inset-x-0 bottom-2 z-30 flex justify-center gap-1.5">
        {ITEMS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Ir para ${ITEMS[i].label}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === active ? 22 : 6,
              background: i === active ? "var(--primary)" : "color-mix(in oklab, var(--muted-foreground) 35%, transparent)",
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
