/**
 * Conteúdo editável da landing (mockup do celular + carrossel de marcas).
 * Este módulo é browser-safe: apenas tipos e valores padrão.
 */
import burgerImg from "@/assets/menu-templates/burgers-especiais.jpg.asset.json";
import pizzaImg from "@/assets/menu-templates/pizzas-salgadas.jpg.asset.json";
import acaiImg from "@/assets/menu-templates/acai-especial.jpg.asset.json";
import fone from "@/assets/catalog-templates/eletronicos-audio.jpg.asset.json";
import skincare from "@/assets/catalog-templates/cosmeticos-skincare.jpg.asset.json";
import tenis from "@/assets/catalog-templates/moda-calcados.jpg.asset.json";
import oculos from "@/assets/catalog-templates/otica-oculos-sol.jpg.asset.json";

export type MenuDish = { name: string; desc: string; price: string; img: string };
export type CatalogProduct = { name: string; price: string; img: string };
export type BrandItem = { name: string; img?: string | null };

/** Prova social exibida abaixo dos selos da hero. */
export type LandingSocialProof = {
  enabled: boolean;
  /** Texto do avatar final, ex.: "+2k" */
  avatarLabel: string;
  /** Trecho em destaque, ex.: "2.000 lojistas" */
  highlight: string;
  /** Texto completo — use {destaque} para posicionar o trecho em destaque. */
  text: string;
};

/** Textos e botões do bloco principal da hero (lado esquerdo). */
export type LandingHeroCopy = {
  badge: string;
  titlePrefix: string;
  titleHighlight: string;
  subtitle: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  /** Selos abaixo dos botões. Use {preco} para inserir o menor preço ativo. */
  bullets: string[];
  socialProof: LandingSocialProof;
};


export type LandingHeroContent = {
  copy: LandingHeroCopy;
  menu: { title: string; dishes: MenuDish[] };
  catalog: { title: string; products: CatalogProduct[] };
};

export type LandingBrandsContent = {
  title: string;
  subtitle: string;
  brands: BrandItem[];
};

export const DEFAULT_HERO_COPY: LandingHeroCopy = {
  badge: "1 plataforma · 10 ferramentas de retenção",
  titlePrefix: "Tudo que seu negócio precisa para o",
  titleHighlight: "cliente voltar",
  subtitle:
    "Fidelidade digital, cardápio, catálogo, avaliações, QR Code, push e CRM — num só painel. Sem app, sem cartão de papel.",
  primaryCta: { label: "Escolher meu plano", href: "#precos" },
  secondaryCta: { label: "Ver como funciona", href: "#ecossistema" },
  bullets: ["Sem cartão de crédito", "Configure em 5 minutos", "Planos a partir de {preco}/mês"],
};

export const DEFAULT_HERO: LandingHeroContent = {
  copy: DEFAULT_HERO_COPY,
  menu: {
    title: "Cardápio em stories",
    dishes: [
      { name: "Burger Trufado", desc: "Blend 180g, cheddar e trufa", price: "R$ 38,90", img: burgerImg.url },
      { name: "Pizza Nduja", desc: "Mussarela de búfala e nduja", price: "R$ 64,00", img: pizzaImg.url },
      { name: "Açaí 500g", desc: "Banana, granola e leite ninho", price: "R$ 24,50", img: acaiImg.url },
    ],
  },
  catalog: {
    title: "Catálogo digital",
    products: [
      { name: "Fone Bluetooth", price: "R$ 189", img: fone.url },
      { name: "Kit Skincare", price: "R$ 129", img: skincare.url },
      { name: "Tênis Runner", price: "R$ 299", img: tenis.url },
      { name: "Óculos Solar", price: "R$ 459", img: oculos.url },
    ],
  },
};

export const DEFAULT_BRANDS: LandingBrandsContent = {
  title: "As marcas que mais crescem no mundo já descobriram o poder da fidelização.",
  subtitle: "Agora, é a sua vez.",
  brands: [
    { name: "Cimed" },
    { name: "Mansão Maromba" },
    { name: "Renner" },
    { name: "Nike" },
    { name: "Adidas" },
    { name: "WePink" },
    { name: "Ray-Ban" },
    { name: "Apple" },
  ],
};

/** Normaliza o payload vindo do banco, preenchendo o que faltar com os padrões. */
export function normalizeHero(raw: unknown): LandingHeroContent {
  const d = (raw ?? {}) as Partial<LandingHeroContent>;
  const dishes = Array.isArray(d.menu?.dishes) && d.menu!.dishes.length ? d.menu!.dishes : DEFAULT_HERO.menu.dishes;
  const products =
    Array.isArray(d.catalog?.products) && d.catalog!.products.length ? d.catalog!.products : DEFAULT_HERO.catalog.products;
  const c = (d.copy ?? {}) as Partial<LandingHeroCopy>;
  const copy: LandingHeroCopy = {
    badge: c.badge ?? DEFAULT_HERO_COPY.badge,
    titlePrefix: c.titlePrefix ?? DEFAULT_HERO_COPY.titlePrefix,
    titleHighlight: c.titleHighlight ?? DEFAULT_HERO_COPY.titleHighlight,
    subtitle: c.subtitle ?? DEFAULT_HERO_COPY.subtitle,
    primaryCta: {
      label: c.primaryCta?.label || DEFAULT_HERO_COPY.primaryCta.label,
      href: c.primaryCta?.href || DEFAULT_HERO_COPY.primaryCta.href,
    },
    secondaryCta: {
      label: c.secondaryCta?.label || DEFAULT_HERO_COPY.secondaryCta.label,
      href: c.secondaryCta?.href || DEFAULT_HERO_COPY.secondaryCta.href,
    },
    bullets: Array.isArray(c.bullets) ? c.bullets.filter((b) => typeof b === "string") : DEFAULT_HERO_COPY.bullets,
  };
  return {
    copy,
    menu: { title: d.menu?.title || DEFAULT_HERO.menu.title, dishes },
    catalog: { title: d.catalog?.title || DEFAULT_HERO.catalog.title, products },
  };
}

export function normalizeBrands(raw: unknown): LandingBrandsContent {
  const d = (raw ?? {}) as Partial<LandingBrandsContent>;
  return {
    title: d.title || DEFAULT_BRANDS.title,
    subtitle: d.subtitle || DEFAULT_BRANDS.subtitle,
    brands: Array.isArray(d.brands) && d.brands.length ? d.brands : DEFAULT_BRANDS.brands,
  };
}

export type PublicPlan = {
  slug: string;
  name: string;
  price_monthly: number | null;
  description: string | null;
  display_order: number;
  is_featured: boolean;
  button_text: string | null;
};
