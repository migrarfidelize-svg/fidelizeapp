/**
 * Vitrines digitais (showcase) — o Cardápio Virtual e o Catálogo Digital
 * compartilham a MESMA base (tabelas restaurant_menus / menu_categories /
 * menu_items) e diferem apenas por `kind` e pelos rótulos exibidos.
 */

export type ShowcaseKind = "menu" | "catalog";

export type ShowcaseLabels = {
  kind: ShowcaseKind;
  /** Nome do módulo ("Cardápio Virtual") */
  module: string;
  /** Eyebrow curto usado nos heros */
  eyebrow: string;
  /** Item no singular / plural ("Prato" / "Pratos") */
  item: string;
  items: string;
  itemLower: string;
  itemsLower: string;
  /** Categoria no singular / plural */
  category: string;
  categories: string;
  /** Base das rotas do painel */
  base: "/app/cardapio" | "/app/catalogo";
  itemsPath: string;
  categoriesPath: string;
  appearancePath: string;
  /** Base da rota pública */
  publicBase: "/cardapio" | "/catalogo";
  /** Recurso de plano exigido para publicar */
  feature: "digital_menu" | "digital_catalog";
  /** Canal usado no rastreio de acessos */
  channel: "menu" | "catalog";
};

export const SHOWCASE: Record<ShowcaseKind, ShowcaseLabels> = {
  menu: {
    kind: "menu",
    module: "Cardápio Virtual",
    eyebrow: "Cardápio virtual",
    item: "Prato",
    items: "Pratos",
    itemLower: "prato",
    itemsLower: "pratos",
    category: "Categoria",
    categories: "Categorias",
    base: "/app/cardapio",
    itemsPath: "/app/cardapio/pratos",
    categoriesPath: "/app/cardapio/categorias",
    appearancePath: "/app/cardapio/aparencia",
    publicBase: "/cardapio",
    feature: "digital_menu",
    channel: "menu",
  },
  catalog: {
    kind: "catalog",
    module: "Catálogo Digital",
    eyebrow: "Catálogo digital",
    item: "Produto",
    items: "Produtos",
    itemLower: "produto",
    itemsLower: "produtos",
    category: "Coleção",
    categories: "Coleções",
    base: "/app/catalogo",
    itemsPath: "/app/catalogo/produtos",
    categoriesPath: "/app/catalogo/colecoes",
    appearancePath: "/app/catalogo/aparencia",
    publicBase: "/catalogo",
    feature: "digital_catalog",
    channel: "catalog",
  },
};

export function showcase(kind: ShowcaseKind = "menu"): ShowcaseLabels {
  return SHOWCASE[kind];
}

/** Situação de estoque de um produto de catálogo. */
export const STOCK_STATUS: { id: string; label: string; tone: string }[] = [
  { id: "in_stock", label: "Disponível", tone: "#15803d" },
  { id: "made_to_order", label: "Sob encomenda", tone: "#b45309" },
  { id: "out_of_stock", label: "Esgotado", tone: "#b91c1c" },
];

export function stockLabel(id?: string | null): string | null {
  if (!id) return null;
  return STOCK_STATUS.find((s) => s.id === id)?.label ?? null;
}
