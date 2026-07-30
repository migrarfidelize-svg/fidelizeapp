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

export type LandingHeroContent = {
  menu: { title: string; dishes: MenuDish[] };
  catalog: { title: string; products: CatalogProduct[] };
};

export type LandingBrandsContent = {
  title: string;
  subtitle: string;
  brands: BrandItem[];
};

export const DEFAULT_HERO: LandingHeroContent = {
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
  return {
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
