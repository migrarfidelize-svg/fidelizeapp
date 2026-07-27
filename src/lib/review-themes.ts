/**
 * Temas da página pública de avaliações (/avaliar/:slug).
 * Salvos em review_settings.theme (jsonb).
 */

export type ReviewPresetId = "circuit" | "noir" | "cream" | "solar" | "rose" | "oceano";
export type ReviewPatternId = "none" | "grid" | "dots" | "aurora";

export type ReviewPreset = {
  id: ReviewPresetId;
  name: string;
  description: string;
  bg: string;        // cor de fundo base
  surface: string;   // cards
  border: string;
  ink: string;       // texto principal
  muted: string;     // texto secundário
  accent: string;
  accent2: string;   // cor do gradiente/realce secundário
  dark: boolean;
};

export const REVIEW_PRESETS: ReviewPreset[] = [
  {
    id: "circuit",
    name: "Circuit",
    description: "Escuro com cyan neon",
    bg: "#050505", surface: "#0b0b0e", border: "#ffffff14",
    ink: "#ffffff", muted: "#9ca3af", accent: "#00ffff", accent2: "#7c3aed", dark: true,
  },
  {
    id: "noir",
    name: "Noir & Gold",
    description: "Preto elegante com dourado",
    bg: "#0a0908", surface: "#141210", border: "#ffffff12",
    ink: "#faf7f0", muted: "#a8a29e", accent: "#d4af37", accent2: "#8b6f1f", dark: true,
  },
  {
    id: "cream",
    name: "Creme",
    description: "Claro, limpo e acolhedor",
    bg: "#faf7f2", surface: "#ffffff", border: "#00000012",
    ink: "#1c1917", muted: "#6b7280", accent: "#0f766e", accent2: "#f59e0b", dark: false,
  },
  {
    id: "solar",
    name: "Solar",
    description: "Claro com laranja vibrante",
    bg: "#fffaf3", surface: "#ffffff", border: "#00000010",
    ink: "#1f1300", muted: "#78716c", accent: "#ea580c", accent2: "#facc15", dark: false,
  },
  {
    id: "rose",
    name: "Rosé",
    description: "Suave, rosa e sofisticado",
    bg: "#fff5f7", surface: "#ffffff", border: "#00000010",
    ink: "#3f1d2b", muted: "#8b6b76", accent: "#be185d", accent2: "#f472b6", dark: false,
  },
  {
    id: "oceano",
    name: "Oceano",
    description: "Azul profundo e sereno",
    bg: "#061523", surface: "#0c2033", border: "#ffffff12",
    ink: "#eaf6ff", muted: "#9fb6c7", accent: "#38bdf8", accent2: "#22d3ee", dark: true,
  },
];

export const REVIEW_PATTERNS: { id: ReviewPatternId; name: string }[] = [
  { id: "none", name: "Nenhum" },
  { id: "grid", name: "Grade" },
  { id: "dots", name: "Pontilhado" },
  { id: "aurora", name: "Aurora" },
];

export type ReviewThemeConfig = {
  preset: ReviewPresetId;
  accent: string | null;
  bg_color: string | null;
  pattern: ReviewPatternId;
  headline: string | null;
  subheadline: string | null;
  show_reviews: boolean;
  show_powered_by: boolean;
};

export const DEFAULT_REVIEW_THEME: ReviewThemeConfig = {
  preset: "circuit",
  accent: null,
  bg_color: null,
  pattern: "grid",
  headline: null,
  subheadline: null,
  show_reviews: true,
  show_powered_by: true,
};

const isHex = (v: unknown): v is string => typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);

function isDarkHex(hex: string): boolean {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}

/** Normaliza o jsonb salvo e resolve as cores finais aplicadas na página pública. */
export function resolveReviewTheme(raw: unknown): ReviewThemeConfig & { colors: ReviewPreset } {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<ReviewThemeConfig>;
  const preset = REVIEW_PRESETS.some((p) => p.id === t.preset) ? (t.preset as ReviewPresetId) : DEFAULT_REVIEW_THEME.preset;
  const pattern = REVIEW_PATTERNS.some((p) => p.id === t.pattern) ? (t.pattern as ReviewPatternId) : DEFAULT_REVIEW_THEME.pattern;
  const accent = isHex(t.accent) ? t.accent : null;
  const bg_color = isHex(t.bg_color) ? t.bg_color : null;

  const base = REVIEW_PRESETS.find((p) => p.id === preset)!;
  let colors: ReviewPreset = { ...base };
  if (accent) colors = { ...colors, accent };
  if (bg_color) {
    const dark = isDarkHex(bg_color);
    colors = {
      ...colors,
      bg: bg_color,
      dark,
      surface: dark ? "#00000055" : "#ffffff",
      border: dark ? "#ffffff14" : "#00000012",
      ink: dark ? "#ffffff" : "#111111",
      muted: dark ? "#9ca3af" : "#6b7280",
    };
  }

  return {
    preset,
    pattern,
    accent,
    bg_color,
    headline: typeof t.headline === "string" && t.headline.trim() ? t.headline.trim().slice(0, 90) : null,
    subheadline: typeof t.subheadline === "string" && t.subheadline.trim() ? t.subheadline.trim().slice(0, 160) : null,
    show_reviews: t.show_reviews !== false,
    show_powered_by: t.show_powered_by !== false,
    colors,
  };
}

/** CSS de fundo decorativo conforme o padrão escolhido. */
export function reviewPatternStyle(pattern: ReviewPatternId, accent: string): React.CSSProperties | undefined {
  if (pattern === "none") return undefined;
  if (pattern === "dots") {
    return {
      backgroundImage: `radial-gradient(${accent}59 1px, transparent 1px)`,
      backgroundSize: "22px 22px",
      maskImage: "radial-gradient(ellipse at 50% 0%, black 40%, transparent 80%)",
    };
  }
  if (pattern === "aurora") {
    return {
      backgroundImage: `radial-gradient(600px 260px at 20% 0%, ${accent}55, transparent 65%), radial-gradient(500px 240px at 85% 20%, ${accent}33, transparent 65%)`,
    };
  }
  return {
    backgroundImage: `linear-gradient(${accent}59 1px, transparent 1px), linear-gradient(90deg, ${accent}59 1px, transparent 1px)`,
    backgroundSize: "56px 56px",
    maskImage: "radial-gradient(ellipse at 50% 0%, black 40%, transparent 80%)",
  };
}
