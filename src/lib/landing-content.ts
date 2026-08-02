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


/** Conteúdo do celular da hero (mockup mobile) — 100% editável no super admin. */
export type LandingHeroDevice = {
  /** Rótulo pequeno acima do nome (ex.: "Cliente") */
  eyebrow: string;
  /** Nome da loja exibido no topo do app */
  storeName: string;
  /** Tela 1 — cartão fidelidade */
  cardTitle: string;
  stamps: number;
  stampsFilled: number;
  cardFooter: string;
  rewardLabel: string;
  rewardValue: string;
  /** Tela 2 — cardápio story */
  storyTitle: string;
  storySubtitle: string;
  /** Tela 3 — catálogo */
  catalogTitle: string;
  /** Cartões flutuantes ao redor do celular */
  crmTitle: string;
  crmValue: string;
  crmCaption: string;
  chatTitle: string;
  reviewsTitle: string;
  reviewsCaption: string;
  deliveryTitle: string;
  deliveryCaption: string;
};

export const DEFAULT_HERO_DEVICE: LandingHeroDevice = {
  eyebrow: "Cliente",
  storeName: "Café da Serra",
  cardTitle: "Cartão fidelidade",
  stamps: 10,
  stampsFilled: 8,
  cardFooter: "Faltam 2 carimbos para o prêmio",
  rewardLabel: "Próximo prêmio",
  rewardValue: "Café grátis + cookie",
  storyTitle: "Cardápio em stories",
  storySubtitle: "Burger Trufado · R$ 38,90",
  catalogTitle: "Catálogo digital",
  crmTitle: "CRM",
  crmValue: "+48%",
  crmCaption: "retenção de clientes",
  chatTitle: "Atendimento",
  reviewsTitle: "Avaliações",
  reviewsCaption: "4,9 de média no Google",
  deliveryTitle: "Entrega ativa",
  deliveryCaption: "Entregador a caminho",
};

export type LandingHeroContent = {
  copy: LandingHeroCopy;
  device: LandingHeroDevice;
  menu: { title: string; dishes: MenuDish[] };
  catalog: { title: string; products: CatalogProduct[] };
};

export type LandingBrandsContent = {
  title: string;
  subtitle: string;
  brands: BrandItem[];
};

export const DEFAULT_HERO_COPY: LandingHeroCopy = {
  badge: "1 plataforma · 13 ferramentas de retenção",
  titlePrefix: "Fidelize, venda e entregue no",
  titleHighlight: "mesmo painel",
  subtitle:
    "Cartão fidelidade, cardápio, catálogo, pedidos, entregas rastreadas, WhatsApp, avaliações e CRM. Tudo conectado — sem app, sem cartão de papel, sem dez assinaturas.",
  primaryCta: { label: "Escolher meu plano", href: "#precos" },
  secondaryCta: { label: "Ver o ecossistema", href: "#ecossistema" },
  bullets: ["Sem cartão de crédito", "Configure em 5 minutos", "Planos a partir de {preco}/mês"],

  socialProof: {
    enabled: true,
    avatarLabel: "+2k",
    highlight: "2.000 lojistas",
    text: "Mais de {destaque} usando a Fidelize.",
  },
};


export const DEFAULT_HERO: LandingHeroContent = {
  copy: DEFAULT_HERO_COPY,
  device: DEFAULT_HERO_DEVICE,
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
    socialProof: {
      enabled: c.socialProof?.enabled ?? DEFAULT_HERO_COPY.socialProof.enabled,
      avatarLabel: c.socialProof?.avatarLabel ?? DEFAULT_HERO_COPY.socialProof.avatarLabel,
      highlight: c.socialProof?.highlight ?? DEFAULT_HERO_COPY.socialProof.highlight,
      text: c.socialProof?.text ?? DEFAULT_HERO_COPY.socialProof.text,
    },
  };

  const dev = (d.device ?? {}) as Partial<LandingHeroDevice>;
  const device: LandingHeroDevice = { ...DEFAULT_HERO_DEVICE };
  for (const k of Object.keys(DEFAULT_HERO_DEVICE) as (keyof LandingHeroDevice)[]) {
    const v = dev[k];
    if (typeof v === "number" && typeof DEFAULT_HERO_DEVICE[k] === "number") (device as any)[k] = v;
    else if (typeof v === "string" && v.trim() && typeof DEFAULT_HERO_DEVICE[k] === "string") (device as any)[k] = v;
  }
  device.stamps = Math.min(20, Math.max(4, Math.round(device.stamps)));
  device.stampsFilled = Math.min(device.stamps, Math.max(0, Math.round(device.stampsFilled)));

  return {
    copy,
    device,
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
