import { motion } from "framer-motion";

type BrandDef = {
  gradient: string; // tailwind gradient classes (from-... via-... to-...)
  ring: string; // ring color hex for glow
  glyph: React.ReactNode; // inner SVG glyph
};

const glyph = (paths: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
    {paths}
  </svg>
);

const BRANDS: Record<string, BrandDef> = {
  // ---------- Mapas ----------
  google_maps: {
    gradient: "from-emerald-400 via-green-600 to-teal-700",
    ring: "#0f9d58",
    glyph: glyph(
      <>
        <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.6" fill="white" />
      </>,
    ),
  },

  // ---------- AI ----------
  openai: {
    gradient: "from-emerald-400 via-teal-500 to-violet-600",
    ring: "#10b981",
    glyph: glyph(
      <path
        d="M12 3l7 4v10l-7 4-7-4V7l7-4zm0 3.2L7.5 8.6v6.8L12 17.8l4.5-2.4V8.6L12 6.2zm0 3.3l3 1.6v2l-3 1.6-3-1.6v-2l3-1.6z"
        stroke="white" strokeWidth="1.2" strokeLinejoin="round"
      />,
    ),
  },
  claude: {
    gradient: "from-orange-400 via-amber-500 to-rose-500",
    ring: "#f59e0b",
    glyph: glyph(
      <path d="M6 5l4 14M14 5l4 14M4 12h16" stroke="white" strokeWidth="2" strokeLinecap="round" />,
    ),
  },
  gemini: {
    gradient: "from-sky-400 via-indigo-500 to-violet-500",
    ring: "#6366f1",
    glyph: glyph(
      <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z" fill="white" />,
    ),
  },
  grok: {
    gradient: "from-zinc-700 via-zinc-900 to-black",
    ring: "#71717a",
    glyph: glyph(
      <path d="M5 5l14 14M19 5L5 19" stroke="white" strokeWidth="2.5" strokeLinecap="round" />,
    ),
  },
  deepseek: {
    gradient: "from-blue-500 via-indigo-600 to-violet-700",
    ring: "#3b82f6",
    glyph: glyph(
      <>
        <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.6" />
        <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </>,
    ),
  },
  openrouter: {
    gradient: "from-violet-500 via-purple-600 to-violet-700",
    ring: "#a855f7",
    glyph: glyph(
      <>
        <path d="M4 8h10a4 4 0 010 8H4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14 4l4 4-4 4M14 12l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </>,
    ),
  },
  // ---------- Payments ----------
  mercadopago: {
    gradient: "from-sky-400 via-blue-500 to-yellow-400",
    ring: "#38bdf8",
    glyph: glyph(
      <path d="M3 13c3-4 6-4 9 0s6 4 9 0" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />,
    ),
  },
  asaas: {
    gradient: "from-emerald-400 via-green-500 to-teal-600",
    ring: "#22c55e",
    glyph: glyph(
      <path d="M12 3l9 16H3L12 3zm0 5.5L7.5 17h9L12 8.5z" fill="white" />,
    ),
  },
  stripe: {
    gradient: "from-indigo-500 via-violet-600 to-purple-700",
    ring: "#8b5cf6",
    glyph: glyph(
      <path d="M15 7c-2-1-6-1-6 1.5 0 2 6 2 6 5 0 3-4 3-7 2" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />,
    ),
  },
  pagarme: {
    gradient: "from-lime-400 via-green-500 to-emerald-600",
    ring: "#84cc16",
    glyph: glyph(
      <>
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="white" strokeWidth="1.8" />
        <path d="M4 10h16" stroke="white" strokeWidth="1.8" />
        <circle cx="16.5" cy="14.5" r="1.2" fill="white" />
      </>,
    ),
  },
  pagseguro: {
    gradient: "from-orange-400 via-red-500 to-rose-600",
    ring: "#f97316",
    glyph: glyph(
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke="white" strokeWidth="1.8" fill="none" />,
    ),
  },
  // ---------- Marketing ----------
  meta_pixel: {
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
    ring: "#0866ff",
    glyph: glyph(
      <>
        <circle cx="12" cy="12" r="8.5" stroke="white" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.6" stroke="white" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="1.2" fill="white" />
      </>,
    ),
  },
};

const FALLBACK: BrandDef = {
  gradient: "from-slate-500 via-slate-600 to-slate-800",
  ring: "#64748b",
  glyph: glyph(
    <path d="M9 7v10M15 7v10M6 10h3M15 10h3M6 14h3M15 14h3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />,
  ),
};

export function ProviderBrand({
  providerId,
  size = "md",
  animate = true,
}: {
  providerId: string;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}) {
  const brand = BRANDS[providerId] ?? FALLBACK;
  const dim = size === "lg" ? "h-14 w-14" : size === "sm" ? "h-9 w-9" : "h-12 w-12";

  return (
    <motion.div
      whileHover={animate ? { scale: 1.06, rotate: -2 } : undefined}
      whileTap={animate ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", stiffness: 320, damping: 18 }}
      className={`relative ${dim} shrink-0`}
    >
      {/* animated outer glow */}
      {animate && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl blur-lg opacity-60"
          style={{ background: brand.ring }}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.9, 1.05, 0.9] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {/* tile */}
      <div
        className={`relative ${dim} rounded-2xl bg-gradient-to-br ${brand.gradient} grid place-items-center shadow-lg ring-1 ring-white/20 overflow-hidden`}
      >
        {/* shine sweep */}
        {animate && (
          <motion.span
            aria-hidden
            className="absolute -inset-y-4 -left-1/2 w-1/2 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{ x: ["0%", "260%"] }}
            transition={{ duration: 3.6, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" }}
          />
        )}
        <div className="relative">{brand.glyph}</div>
      </div>
    </motion.div>
  );
}

export function providerAccent(providerId: string): string {
  return (BRANDS[providerId] ?? FALLBACK).ring;
}
