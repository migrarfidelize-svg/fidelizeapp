/**
 * Taxonomia de categorias do canal "Descobrir" da carteira.
 *
 * Nem todo estabelecimento preenche `segment`, então inferimos a categoria a
 * partir de segmento → nome → descrição, com fallback "outros".
 */

export type DiscoverCategoryId =
  | "alimentacao"
  | "beleza"
  | "saude"
  | "moda"
  | "fitness"
  | "pet"
  | "servicos"
  | "lazer"
  | "outros";

export type DiscoverCategory = {
  id: DiscoverCategoryId;
  label: string;
  emoji: string;
  /** Termos (sem acento, minúsculos) usados para inferência. */
  keywords: string[];
};

export const DISCOVER_CATEGORIES: DiscoverCategory[] = [
  {
    id: "alimentacao",
    label: "Alimentação",
    emoji: "🍽️",
    keywords: [
      "restaurante", "lanchonete", "hamburgueria", "burger", "pizza", "pizzaria", "food",
      "cafe", "cafeteria", "padaria", "confeitaria", "doceria", "sorvete", "gelato",
      "acai", "sushi", "japones", "bar", "pub", "cervejaria", "bistro", "churrasc",
      "marmita", "delivery", "esfiha", "pastel", "espetinho", "comida", "gastronomia",
      "adega", "empor", "chocolat", "salgad", "bebida",
    ],
  },
  {
    id: "beleza",
    label: "Beleza",
    emoji: "💇",
    keywords: [
      "beleza", "salao", "cabelo", "cabeleire", "barbe", "barbearia", "estetica",
      "manicure", "unha", "nail", "maquiagem", "make", "sobrancelha", "cilios",
      "depilacao", "spa", "studio de beleza", "bronze",
    ],
  },
  {
    id: "saude",
    label: "Saúde",
    emoji: "🩺",
    keywords: [
      "saude", "clinica", "odonto", "dentista", "consultorio", "farmacia", "drogaria",
      "nutri", "psico", "fisio", "terapia", "massagem", "laborator", "otica", "medic",
    ],
  },
  {
    id: "moda",
    label: "Moda",
    emoji: "👗",
    keywords: [
      "moda", "roupa", "boutique", "vestuario", "loja de roupas", "calcado", "sapat",
      "tenis", "acessorio", "joia", "semijoia", "bijuteria", "bolsa", "brecho", "fashion",
    ],
  },
  {
    id: "fitness",
    label: "Fitness",
    emoji: "🏋️",
    keywords: [
      "academia", "gym", "fitness", "crossfit", "pilates", "yoga", "muay", "jiu",
      "luta", "danca", "personal", "treino", "esporte",
    ],
  },
  {
    id: "pet",
    label: "Pet",
    emoji: "🐾",
    keywords: ["pet", "petshop", "veterin", "banho e tosa", "animal", "racao"],
  },
  {
    id: "servicos",
    label: "Serviços",
    emoji: "🛠️",
    keywords: [
      "servico", "assistencia", "conserto", "oficina", "mecanic", "lava", "auto",
      "chavei", "grafica", "contabil", "advoc", "imobil", "reforma", "eletric",
      "informatica", "celular", "tecnologia", "limpeza", "costura", "borracharia",
    ],
  },
  {
    id: "lazer",
    label: "Lazer",
    emoji: "🎉",
    keywords: [
      "lazer", "festa", "evento", "buffet", "balada", "clube", "cinema", "jogo",
      "game", "hotel", "pousada", "turismo", "viagem", "artesan", "presente", "flor",
    ],
  },
  { id: "outros", label: "Outros", emoji: "✨", keywords: [] },
];

export const CATEGORY_BY_ID = new Map(DISCOVER_CATEGORIES.map((c) => [c.id, c]));

function norm(s: string | null | undefined) {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Infere a categoria a partir de segmento, nome e descrição. */
export function categorizeEstablishment(e: {
  segment?: string | null;
  name?: string | null;
  description?: string | null;
}): DiscoverCategoryId {
  const fields = [norm(e.segment), norm(e.name), norm(e.description)];
  for (const field of fields) {
    if (!field) continue;
    for (const cat of DISCOVER_CATEGORIES) {
      if (cat.keywords.some((k) => field.includes(k))) return cat.id;
    }
  }
  return "outros";
}
