/**
 * Temas visuais do Cardápio Virtual.
 * Salvos em restaurant_menus.theme (jsonb) — { preset, layout, pattern, bg_image_url }.
 */

export type MenuLayoutId = "list" | "grid" | "magazine";
export type MenuPresetId = "papel" | "noir" | "fresh" | "terracota" | "oceano" | "citrico" | "rose";
export type MenuPatternId = "none" | "grain" | "dots" | "grid" | "aurora";
export type MenuEntryId = "dishes" | "categories";

export type MenuPreset = {
  id: MenuPresetId;
  name: string;
  description: string;
  bg: string;        // fundo da página
  surface: string;   // cartões / barra
  ink: string;       // texto principal
  line: string;      // bordas
  bar: string;       // barras/pills ativos
  barInk: string;    // texto sobre bar
  fontHead: string;
  headHref: string;  // Google Fonts href
};

export const MENU_PRESETS: MenuPreset[] = [
  {
    id: "papel",
    name: "Papel & Tinta",
    description: "Bege quente com tinta escura. Clássico de bistrô, ótimo para fotos de comida.",
    bg: "#FBF7F0",
    surface: "#FFFFFF",
    ink: "#17130E",
    line: "rgba(23,19,14,0.14)",
    bar: "#17130E",
    barInk: "#FBF7F0",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
  {
    id: "noir",
    name: "Noir & Ouro",
    description: "Preto profundo com dourado. Ideal para jantar, bares e alta gastronomia.",
    bg: "#0D0D0D",
    surface: "#181818",
    ink: "#F3EFE6",
    line: "rgba(243,239,230,0.14)",
    bar: "#C9A84C",
    barInk: "#0D0D0D",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
  {
    id: "fresh",
    name: "Fresh Market",
    description: "Branco limpo com verde natural. Perfeito para saudáveis, cafés e lanchonetes.",
    bg: "#F6FAF6",
    surface: "#FFFFFF",
    ink: "#14261C",
    line: "rgba(20,38,28,0.12)",
    bar: "#2F6F4F",
    barInk: "#FFFFFF",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
  {
    id: "terracota",
    name: "Terracota & Sálvia",
    description: "Barro quente com verde sálvia. Ótimo para comida caseira, pizzarias e cantinas.",
    bg: "#FDF3EC",
    surface: "#FFFFFF",
    ink: "#2A1810",
    line: "rgba(42,24,16,0.14)",
    bar: "#C4654A",
    barInk: "#FFF7F2",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
  {
    id: "oceano",
    name: "Oceano Profundo",
    description: "Azul noite com turquesa. Combina com frutos do mar, sushi e drinks.",
    bg: "#0C2340",
    surface: "#123255",
    ink: "#EAF4FB",
    line: "rgba(234,244,251,0.16)",
    bar: "#5CBDB9",
    barInk: "#062033",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
  {
    id: "citrico",
    name: "Solar Cítrico",
    description: "Creme ensolarado com laranja vibrante. Perfeito para açaí, sucos, sorveterias e lanches rápidos.",
    bg: "#FFF8E8",
    surface: "#FFFFFF",
    ink: "#2B1B05",
    line: "rgba(43,27,5,0.13)",
    bar: "#E8720C",
    barInk: "#FFF8E8",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
  {
    id: "rose",
    name: "Rosé & Creme",
    description: "Rosa suave com bordô. Combina com confeitarias, docerias, cafés e brunch.",
    bg: "#FFF3F5",
    surface: "#FFFFFF",
    ink: "#2C0E18",
    line: "rgba(44,14,24,0.12)",
    bar: "#9E2A4B",
    barInk: "#FFF3F5",
    fontHead: "'Outfit', ui-sans-serif, system-ui, sans-serif",
    headHref: "https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
  },
];

export const MENU_LAYOUTS: { id: MenuLayoutId; name: string; description: string }[] = [
  { id: "list", name: "Lista com foto", description: "Foto à esquerda, nome, descrição e preço. Leitura rápida no celular." },
  { id: "grid", name: "Vitrine em grade", description: "Cartões grandes em 2 colunas, foto em destaque. Ótimo para fotos boas." },
  { id: "magazine", name: "Editorial", description: "Texto em primeiro plano com miniatura discreta. Elegante e enxuto." },
];

export const MENU_PATTERNS: { id: MenuPatternId; name: string }[] = [
  { id: "none", name: "Liso" },
  { id: "grain", name: "Textura de papel" },
  { id: "dots", name: "Poás" },
  { id: "grid", name: "Grade fina" },
  { id: "aurora", name: "Brilho suave" },
];

export const MENU_ENTRIES: { id: MenuEntryId; name: string; description: string }[] = [
  { id: "dishes", name: "Abrir nos pratos", description: "O cliente já vê os pratos direto, com as categorias como atalho no topo." },
  { id: "categories", name: "Abrir nas categorias", description: "O cliente escolhe primeiro a categoria e depois vê os pratos dela." },
];

export type MenuThemeConfig = {
  preset: MenuPresetId;
  layout: MenuLayoutId;
  pattern: MenuPatternId;
  entry: MenuEntryId;
  bg_color: string | null;
  bg_image_url: string | null;
};

export const DEFAULT_MENU_THEME: MenuThemeConfig = {
  preset: "papel",
  layout: "list",
  pattern: "grain",
  entry: "dishes",
  bg_color: null,
  bg_image_url: null,
};

/** Cores de fundo sugeridas (o lojista também pode escolher qualquer cor). */
export const MENU_BG_SWATCHES = [
  // Claros
  "#FFFFFF", "#FBF7F0", "#F5F3EE", "#FDF3EC", "#FFF4E8", "#FFF0F3",
  "#F6FAF6", "#EAF7F0", "#EAF2FB", "#F3F0FF", "#F2F5F7", "#FFFBEA",
  // Médios
  "#E8D9C5", "#D8E7DA", "#CBDCEB", "#E4D6E9",
  // Escuros
  "#2A1810", "#14261C", "#0C2340", "#1B1B1F", "#0D0D0D", "#101A2B",
  "#1E1B16", "#171F1A",
];

function hexLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return 1;
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function isValidHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());
}

/** Aplica uma cor de fundo customizada sobre o preset, ajustando texto/superfícies para manter contraste. */
export function applyBgColor(preset: MenuPreset, bgColor: string | null): MenuPreset {
  if (!bgColor || !isValidHex(bgColor)) return preset;
  const dark = hexLuminance(bgColor) < 0.4;
  return {
    ...preset,
    bg: bgColor,
    surface: dark ? "rgba(255,255,255,0.07)" : "#FFFFFF",
    ink: dark ? "#F5F3EE" : "#17130E",
    line: dark ? "rgba(245,243,238,0.16)" : "rgba(23,19,14,0.14)",
    bar: dark ? "#F5F3EE" : preset.bar,
    barInk: dark ? "#111111" : preset.barInk,
  };
}

export function resolveMenuTheme(raw: unknown): MenuThemeConfig & { preset_def: MenuPreset } {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<MenuThemeConfig>;
  const preset = MENU_PRESETS.some((p) => p.id === t.preset) ? (t.preset as MenuPresetId) : DEFAULT_MENU_THEME.preset;
  const layout = MENU_LAYOUTS.some((l) => l.id === t.layout) ? (t.layout as MenuLayoutId) : DEFAULT_MENU_THEME.layout;
  const pattern = MENU_PATTERNS.some((p) => p.id === t.pattern) ? (t.pattern as MenuPatternId) : DEFAULT_MENU_THEME.pattern;
  const entry = MENU_ENTRIES.some((e) => e.id === t.entry) ? (t.entry as MenuEntryId) : DEFAULT_MENU_THEME.entry;
  const bg_color = typeof t.bg_color === "string" && isValidHex(t.bg_color) ? t.bg_color : null;
  return {
    preset,
    layout,
    pattern,
    entry,
    bg_color,
    bg_image_url: typeof t.bg_image_url === "string" && t.bg_image_url ? t.bg_image_url : null,
    preset_def: applyBgColor(MENU_PRESETS.find((p) => p.id === preset)!, bg_color),
  };
}

/** CSS `background` do wrapper da vitrine. */
export function menuBackgroundCss(cfg: { pattern: MenuPatternId; bg_image_url: string | null }, p: MenuPreset, accent: string) {
  if (cfg.bg_image_url) {
    return `linear-gradient(${p.bg}E6, ${p.bg}F2), url(${cfg.bg_image_url}) center/cover fixed`;
  }
  switch (cfg.pattern) {
    case "dots":
      return `radial-gradient(${p.line} 1px, transparent 1px) 0 0/18px 18px, ${p.bg}`;
    case "grid":
      return `linear-gradient(${p.line} 1px, transparent 1px) 0 0/28px 28px, linear-gradient(90deg, ${p.line} 1px, transparent 1px) 0 0/28px 28px, ${p.bg}`;
    case "aurora":
      return `radial-gradient(60% 40% at 15% 0%, ${accent}22, transparent 60%), radial-gradient(50% 40% at 95% 10%, ${accent}18, transparent 60%), ${p.bg}`;
    case "grain":
      return `radial-gradient(${p.line} 0.6px, transparent 0.6px) 0 0/6px 6px, ${p.bg}`;
    default:
      return p.bg;
  }
}
