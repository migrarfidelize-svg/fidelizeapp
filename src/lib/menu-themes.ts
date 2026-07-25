/**
 * Temas visuais do Cardápio Virtual.
 * Salvos em restaurant_menus.theme (jsonb) — { preset, layout, pattern, bg_image_url }.
 */

export type MenuLayoutId = "list" | "grid" | "magazine";
export type MenuPresetId = "papel" | "noir" | "fresh";
export type MenuPatternId = "none" | "grain" | "dots" | "grid" | "aurora";

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

export type MenuThemeConfig = {
  preset: MenuPresetId;
  layout: MenuLayoutId;
  pattern: MenuPatternId;
  bg_image_url: string | null;
};

export const DEFAULT_MENU_THEME: MenuThemeConfig = {
  preset: "papel",
  layout: "list",
  pattern: "grain",
  bg_image_url: null,
};

export function resolveMenuTheme(raw: unknown): MenuThemeConfig & { preset_def: MenuPreset } {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<MenuThemeConfig>;
  const preset = MENU_PRESETS.some((p) => p.id === t.preset) ? (t.preset as MenuPresetId) : DEFAULT_MENU_THEME.preset;
  const layout = MENU_LAYOUTS.some((l) => l.id === t.layout) ? (t.layout as MenuLayoutId) : DEFAULT_MENU_THEME.layout;
  const pattern = MENU_PATTERNS.some((p) => p.id === t.pattern) ? (t.pattern as MenuPatternId) : DEFAULT_MENU_THEME.pattern;
  return {
    preset,
    layout,
    pattern,
    bg_image_url: typeof t.bg_image_url === "string" && t.bg_image_url ? t.bg_image_url : null,
    preset_def: MENU_PRESETS.find((p) => p.id === preset)!,
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
