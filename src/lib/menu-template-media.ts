// ============================================================
// Imagens de MODELO (geradas por IA) para categorias/pratos dos
// modelos prontos de cardápio. Servidas pelo CDN de assets.
// Chave: template_key -> nome da categoria (lowercase) -> URL
// ============================================================

import acaiEspecial from "@/assets/menu-templates/acai-especial.jpg.asset.json";
import acaiTradicional from "@/assets/menu-templates/acai-tradicional.jpg.asset.json";
import acompanhamentos from "@/assets/menu-templates/acompanhamentos.jpg.asset.json";
import bebidasJaponesas from "@/assets/menu-templates/bebidas-japonesas.jpg.asset.json";
import bebidas from "@/assets/menu-templates/bebidas.jpg.asset.json";
import bolosFatia from "@/assets/menu-templates/bolos-fatia.jpg.asset.json";
import brunch from "@/assets/menu-templates/brunch.jpg.asset.json";
import burgersClassicos from "@/assets/menu-templates/burgers-classicos.jpg.asset.json";
import burgersEspeciais from "@/assets/menu-templates/burgers-especiais.jpg.asset.json";
import cafes from "@/assets/menu-templates/cafes.jpg.asset.json";
import calzones from "@/assets/menu-templates/calzones.jpg.asset.json";
import chopps from "@/assets/menu-templates/chopps.jpg.asset.json";
import combinados from "@/assets/menu-templates/combinados.jpg.asset.json";
import docesBolos from "@/assets/menu-templates/doces-bolos.jpg.asset.json";
import docinhos from "@/assets/menu-templates/docinhos.jpg.asset.json";
import drinks from "@/assets/menu-templates/drinks.jpg.asset.json";
import executivos from "@/assets/menu-templates/executivos.jpg.asset.json";
import marmitex from "@/assets/menu-templates/marmitex.jpg.asset.json";
import milkshakes from "@/assets/menu-templates/milkshakes.jpg.asset.json";
import petiscos from "@/assets/menu-templates/petiscos.jpg.asset.json";
import pizzasDoces from "@/assets/menu-templates/pizzas-doces.jpg.asset.json";
import pizzasSalgadas from "@/assets/menu-templates/pizzas-salgadas.jpg.asset.json";
import porcoes from "@/assets/menu-templates/porcoes.jpg.asset.json";
import sashimis from "@/assets/menu-templates/sashimis.jpg.asset.json";
import sobremesas from "@/assets/menu-templates/sobremesas.jpg.asset.json";
import sorvetes from "@/assets/menu-templates/sorvetes.jpg.asset.json";
import churrascoAcompanhamentos from "@/assets/menu-templates/churrasco-acompanhamentos.jpg";
import churrascoBebidas from "@/assets/menu-templates/churrasco-bebidas.jpg";
import churrascoCarnes from "@/assets/menu-templates/churrasco-carnes.jpg";
import churrascoEspetos from "@/assets/menu-templates/churrasco-espetos.jpg";
import italianoBebidas from "@/assets/menu-templates/italiano-bebidas.jpg";
import italianoEntradas from "@/assets/menu-templates/italiano-entradas.jpg";
import italianoMassas from "@/assets/menu-templates/italiano-massas.jpg";
import italianoRisotos from "@/assets/menu-templates/italiano-risotos.jpg";
import marisqueiraBebidas from "@/assets/menu-templates/marisqueira-bebidas.jpg";
import marisqueiraCamaroes from "@/assets/menu-templates/marisqueira-camaroes.jpg";
import marisqueiraFrutos from "@/assets/menu-templates/marisqueira-frutos.jpg";
import marisqueiraPeixes from "@/assets/menu-templates/marisqueira-peixes.jpg";
import mexicanoBebidas from "@/assets/menu-templates/mexicano-bebidas.jpg";
import mexicanoBurritos from "@/assets/menu-templates/mexicano-burritos.jpg";
import mexicanoNachos from "@/assets/menu-templates/mexicano-nachos.jpg";
import mexicanoTacos from "@/assets/menu-templates/mexicano-tacos.jpg";
import padariaBolos from "@/assets/menu-templates/padaria-bolos.jpg";
import padariaCafes from "@/assets/menu-templates/padaria-cafes.jpg";
import padariaPaes from "@/assets/menu-templates/padaria-paes.jpg";
import padariaSalgados from "@/assets/menu-templates/padaria-salgados.jpg";
import saudavelBowls from "@/assets/menu-templates/saudavel-bowls.jpg";
import saudavelSaladas from "@/assets/menu-templates/saudavel-saladas.jpg";
import saudavelSucos from "@/assets/menu-templates/saudavel-sucos.jpg";
import saudavelWraps from "@/assets/menu-templates/saudavel-wraps.jpg";
import temaki from "@/assets/menu-templates/temaki.jpg.asset.json";
import tortas from "@/assets/menu-templates/tortas.jpg.asset.json";
import uramaki from "@/assets/menu-templates/uramaki.jpg.asset.json";

export const MENU_TEMPLATE_MEDIA: Record<string, Record<string, string>> = {
  pizzaria: {
    "pizzas salgadas": pizzasSalgadas.url,
    "pizzas doces": pizzasDoces.url,
    "calzones & esfihas": calzones.url,
    bebidas: bebidas.url,
  },
  hamburgueria: {
    "burgers clássicos": burgersClassicos.url,
    "burgers especiais": burgersEspeciais.url,
    acompanhamentos: acompanhamentos.url,
    "milkshakes & bebidas": milkshakes.url,
  },
  cafeteria: {
    cafés: cafes.url,
    "doces & bolos": docesBolos.url,
    "brunch & salgados": brunch.url,
  },
  acai: {
    "açaí tradicional": acaiTradicional.url,
    "açaí especial": acaiEspecial.url,
    sorvetes: sorvetes.url,
  },
  japones: {
    combinados: combinados.url,
    sashimis: sashimis.url,
    "uramaki & hot": uramaki.url,
    temaki: temaki.url,
    bebidas: bebidasJaponesas.url,
  },
  brasileira: {
    executivos: executivos.url,
    marmitex: marmitex.url,
    porções: porcoes.url,
    sobremesas: sobremesas.url,
  },
  bar: {
    "chopps & cervejas": chopps.url,
    drinks: drinks.url,
    petiscos: petiscos.url,
  },
  doceria: {
    "bolos fatia": bolosFatia.url,
    tortas: tortas.url,
    "docinhos (100g)": docinhos.url,
  },
};

/** Imagem de modelo para uma categoria de um template (ou null). */
export function templateCategoryImage(templateKey: string, categoryName: string): string | null {
  const group = MENU_TEMPLATE_MEDIA[templateKey];
  if (!group) return null;
  return group[categoryName.trim().toLowerCase()] ?? null;
}

/** Capa do template (primeira imagem disponível). */
export function templateCoverImage(templateKey: string): string | null {
  const group = MENU_TEMPLATE_MEDIA[templateKey];
  if (!group) return null;
  const first = Object.values(group)[0];
  return first ?? null;
}
