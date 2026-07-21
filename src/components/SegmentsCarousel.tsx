import { useEffect, useRef, useState } from "react";
import {
  Coffee,
  Scissors,
  Sparkles,
  Pizza,
  IceCream2,
  Croissant,
  PawPrint,
  Wrench,
  Store,
} from "lucide-react";

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

export function SegmentsCarousel() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  // Reveal on scroll into view
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Auto-rotate spotlight when nothing is hovered
  useEffect(() => {
    if (hovered !== null) return;
    const id = setInterval(() => {
      setActive((a) => (a + 1) % ITEMS.length);
    }, 2200);
    return () => clearInterval(id);
  }, [hovered]);

  const focused = hovered ?? active;
  const focusedItem = ITEMS[focused];

  return (
    <div
      ref={wrapperRef}
      className="relative mx-auto flex w-full items-center justify-center px-4 py-12 md:py-16"
    >
      {/* Ambient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 65%)",
        }}
      />

      {/* Shared SVG defs for gradient/glow */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="orbIconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary)" />
          </linearGradient>
          <filter id="orbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Desktop / tablet: orbital constellation */}
      <div className="relative hidden md:block">
        <Constellation
          items={ITEMS}
          focused={focused}
          visible={visible}
          onHover={setHovered}
          focusedItem={focusedItem}
        />
      </div>

      {/* Mobile: 3x3 grid (no orbit) for readability */}
      <div className="grid w-full max-w-md grid-cols-3 gap-3 md:hidden">
        {ITEMS.map((it, i) => {
          const Icon = it.icon;
          const isActive = i === focused;
          return (
            <button
              key={it.label}
              onClick={() => setActive(i)}
              className="group relative flex flex-col items-center gap-2 rounded-2xl border border-cyan-400/15 bg-white/[0.03] p-3 backdrop-blur-md transition"
              style={{
                boxShadow: isActive
                  ? "0 12px 40px -12px color-mix(in oklab, var(--primary) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 6px 20px -12px color-mix(in oklab, var(--primary) 20%, transparent)",
                borderColor: isActive
                  ? "color-mix(in oklab, var(--primary) 55%, transparent)"
                  : undefined,
                transform: visible ? "translateY(0)" : "translateY(20px)",
                opacity: visible ? 1 : 0,
                transition: `transform 500ms cubic-bezier(.2,.85,.2,1) ${i * 60}ms, opacity 500ms ease ${i * 60}ms, box-shadow 300ms ease, border-color 300ms ease`,
              }}
            >
              <div className="relative flex h-14 w-14 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in oklab, var(--primary) 40%, transparent) 0%, transparent 70%)",
                    filter: "blur(10px)",
                    opacity: isActive ? 0.9 : 0.4,
                  }}
                />
                <Icon
                  strokeWidth={1.2}
                  className="relative h-8 w-8"
                  style={{
                    stroke: "url(#orbIconGrad)",
                    color: "transparent",
                    filter:
                      "drop-shadow(0 6px 14px color-mix(in oklab, var(--primary) 55%, transparent))",
                  }}
                />
              </div>
              <div className="text-center text-[11px] font-semibold text-foreground">
                {it.label}
              </div>
            </button>
          );
        })}
        <div className="col-span-3 mt-2 flex flex-col items-center gap-1">
          <div className="font-display text-lg font-bold text-foreground">
            {focusedItem.label}
          </div>
          <span
            className="rounded-full border px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 40%, transparent)",
              background: "color-mix(in oklab, var(--primary) 8%, transparent)",
              color: "color-mix(in oklab, var(--primary) 80%, white)",
            }}
          >
            {focusedItem.tag}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Constellation (desktop)                                            */
/* ------------------------------------------------------------------ */

function Constellation({
  items,
  focused,
  visible,
  onHover,
  focusedItem,
}: {
  items: typeof ITEMS;
  focused: number;
  visible: boolean;
  onHover: (i: number | null) => void;
  focusedItem: (typeof ITEMS)[number];
}) {
  const SIZE = 820; // svg canvas
  const R = 320; // orbit radius
  const CENTER = SIZE / 2;
  const N = items.length;

  // Precompute positions
  const nodes = items.map((it, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    return {
      ...it,
      i,
      x: CENTER + Math.cos(angle) * R,
      y: CENTER + Math.sin(angle) * R,
      angle,
    };
  });

  return (
    <div
      className="relative"
      style={{ width: SIZE, height: SIZE }}
      onMouseLeave={() => onHover(null)}
    >
      {/* Rotating orbit ring (slow) */}
      <div
        aria-hidden
        className="absolute inset-0 orbit-spin"
        style={{
          borderRadius: "50%",
        }}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full">
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            fill="none"
            stroke="url(#orbIconGrad)"
            strokeOpacity="0.25"
            strokeDasharray="2 8"
            strokeWidth="1"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R - 28}
            fill="none"
            stroke="color-mix(in oklab, var(--primary) 25%, transparent)"
            strokeOpacity="0.15"
            strokeWidth="1"
          />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R + 32}
            fill="none"
            stroke="color-mix(in oklab, var(--primary) 20%, transparent)"
            strokeOpacity="0.12"
            strokeDasharray="1 6"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* AI connectors from center to focused node + neighbors */}
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {nodes.map((n) => {
          const isFocus = n.i === focused;
          const isNeighbor =
            n.i === (focused + 1) % N || n.i === (focused - 1 + N) % N;
          if (!isFocus && !isNeighbor) return null;
          return (
            <line
              key={n.i}
              x1={CENTER}
              y1={CENTER}
              x2={n.x}
              y2={n.y}
              stroke={
                isFocus
                  ? "url(#orbIconGrad)"
                  : "color-mix(in oklab, var(--primary) 35%, transparent)"
              }
              strokeWidth={isFocus ? 1.8 : 1}
              strokeOpacity={isFocus ? 0.9 : 0.35}
              filter="url(#orbGlow)"
              style={{
                transition: "all 400ms ease",
              }}
            />
          );
        })}
        {/* Traveling pulse along focused line */}
        {(() => {
          const n = nodes[focused];
          return (
            <circle r="3.5" fill="var(--primary)" filter="url(#orbGlow)">
              <animateMotion
                key={focused}
                dur="1.4s"
                repeatCount="indefinite"
                path={`M ${CENTER} ${CENTER} L ${n.x} ${n.y}`}
              />
            </circle>
          );
        })()}
      </svg>

      {/* Central hub — Fidelize mark */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.85})`,
          opacity: visible ? 1 : 0,
          transition: "all 700ms cubic-bezier(.2,.85,.2,1)",
        }}
      >
        <div className="relative flex h-64 w-64 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--primary) 55%, transparent) 0%, transparent 70%)",
              filter: "blur(24px)",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-3 rounded-full border"
            style={{
              borderColor:
                "color-mix(in oklab, var(--primary) 45%, transparent)",
              background:
                "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08), transparent 60%), #050b12",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -25px 40px -10px color-mix(in oklab, var(--primary) 30%, transparent)",
            }}
          />
          <div className="relative z-10 flex w-full flex-col items-center justify-center gap-2 px-5 text-center">
            <div
              className="font-display text-3xl font-black leading-none tracking-tight"
              style={{ color: "var(--primary)" }}
            >
              Fidelize
            </div>
            <div className="text-xs font-semibold uppercase leading-tight tracking-widest text-cyan-300/80">
              {focusedItem.label}
            </div>
            <span
              key={focused}
              className="mt-1 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider animate-fade-in"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--primary) 40%, transparent)",
                background:
                  "color-mix(in oklab, var(--primary) 10%, transparent)",
                color: "color-mix(in oklab, var(--primary) 80%, white)",
              }}
            >
              {focusedItem.tag}
            </span>
          </div>
        </div>
      </div>

      {/* Orbiting nodes */}
      {nodes.map((n) => {
        const Icon = n.icon;
        const isFocus = n.i === focused;
        const delay = 200 + n.i * 70;
        return (
          <button
            key={n.label}
            onMouseEnter={() => onHover(n.i)}
            onFocus={() => onHover(n.i)}
            onClick={() => onHover(n.i)}
            className="group absolute flex flex-col items-center gap-1 outline-none"
            style={{
              left: n.x,
              top: n.y,
              transform: `translate(-50%, -50%) scale(${
                visible ? (isFocus ? 1.12 : 1) : 0.6
              })`,
              opacity: visible ? 1 : 0,
              transition: `transform 600ms cubic-bezier(.2,.85,.2,1) ${delay}ms, opacity 600ms ease ${delay}ms`,
              zIndex: isFocus ? 20 : 10,
            }}
          >
            <div
              className="relative flex h-24 w-24 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300"
              style={{
                borderColor: isFocus
                  ? "color-mix(in oklab, var(--primary) 65%, transparent)"
                  : "color-mix(in oklab, var(--primary) 22%, transparent)",
                background:
                  "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.08), transparent 60%), rgba(5,11,18,0.85)",
                boxShadow: isFocus
                  ? "0 0 0 5px color-mix(in oklab, var(--primary) 18%, transparent), 0 26px 55px -18px color-mix(in oklab, var(--primary) 55%, transparent)"
                  : "0 12px 30px -14px color-mix(in oklab, var(--primary) 35%, transparent)",
              }}
            >
              <Icon
                strokeWidth={1.2}
                className="h-12 w-12 transition-transform duration-300 group-hover:scale-110"
                style={{
                  stroke: "url(#orbIconGrad)",
                  color: "transparent",
                  filter:
                    "drop-shadow(0 8px 18px color-mix(in oklab, var(--primary) 60%, transparent))",
                }}
              />
              {isFocus && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-full"
                  style={{
                    background:
                      "conic-gradient(from 0deg, transparent 0%, color-mix(in oklab, var(--primary) 65%, transparent) 25%, transparent 50%, color-mix(in oklab, var(--primary) 65%, transparent) 75%, transparent 100%)",
                    filter: "blur(6px)",
                    animation: "orbit-conic 3.6s linear infinite",
                    opacity: 0.55,
                  }}
                />
              )}
            </div>
            <span
              className="mt-1 whitespace-nowrap text-sm font-semibold tracking-tight transition-colors duration-300"
              style={{
                color: isFocus
                  ? "color-mix(in oklab, var(--primary) 85%, var(--foreground))"
                  : "color-mix(in oklab, var(--foreground) 78%, transparent)",
                textShadow: isFocus
                  ? "0 0 12px color-mix(in oklab, var(--primary) 60%, transparent)"
                  : undefined,
              }}
            >
              {n.label}
            </span>

          </button>
        );
      })}

      <style>{`
        @keyframes orbit-spin-kf {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .orbit-spin {
          animation: orbit-spin-kf 60s linear infinite;
        }
        @keyframes orbit-conic {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
