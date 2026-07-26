// ============================================================
// Imagens de MODELO (geradas por IA) para as coleções dos
// modelos prontos de CATÁLOGO DIGITAL. Servidas pelo CDN.
// Chave: template_key -> nome da coleção (lowercase) -> URL
// ============================================================

import modaFeminino from "@/assets/catalog-templates/moda-feminino.jpg.asset.json";
import modaMasculino from "@/assets/catalog-templates/moda-masculino.jpg.asset.json";
import modaCalcados from "@/assets/catalog-templates/moda-calcados.jpg.asset.json";
import modaAcessorios from "@/assets/catalog-templates/moda-acessorios.jpg.asset.json";
import petRacoes from "@/assets/catalog-templates/petshop-racoes.jpg.asset.json";
import petPetiscos from "@/assets/catalog-templates/petshop-petiscos.jpg.asset.json";
import petHigiene from "@/assets/catalog-templates/petshop-higiene.jpg.asset.json";
import petBrinquedos from "@/assets/catalog-templates/petshop-brinquedos.jpg.asset.json";
import cosSkincare from "@/assets/catalog-templates/cosmeticos-skincare.jpg.asset.json";
import cosMaquiagem from "@/assets/catalog-templates/cosmeticos-maquiagem.jpg.asset.json";
import cosCabelos from "@/assets/catalog-templates/cosmeticos-cabelos.jpg.asset.json";
import cosPerfumaria from "@/assets/catalog-templates/cosmeticos-perfumaria.jpg.asset.json";
import eleCelular from "@/assets/catalog-templates/eletronicos-acessorios-celular.jpg.asset.json";
import eleAudio from "@/assets/catalog-templates/eletronicos-audio.jpg.asset.json";
import eleInformatica from "@/assets/catalog-templates/eletronicos-informatica.jpg.asset.json";
import eleServicos from "@/assets/catalog-templates/eletronicos-servicos.jpg.asset.json";
import merHortifruti from "@/assets/catalog-templates/mercado-hortifruti.jpg.asset.json";
import merMercearia from "@/assets/catalog-templates/mercado-mercearia.jpg.asset.json";
import merAcougue from "@/assets/catalog-templates/mercado-acougue.jpg.asset.json";
import merBebidas from "@/assets/catalog-templates/mercado-bebidas.jpg.asset.json";
import floBuques from "@/assets/catalog-templates/floricultura-buques.jpg.asset.json";
import floArranjos from "@/assets/catalog-templates/floricultura-arranjos.jpg.asset.json";
import floPlantas from "@/assets/catalog-templates/floricultura-plantas.jpg.asset.json";
import floCestas from "@/assets/catalog-templates/floricultura-cestas.jpg.asset.json";
import papEscolar from "@/assets/catalog-templates/papelaria-escolar.jpg.asset.json";
import papEscritorio from "@/assets/catalog-templates/papelaria-escritorio.jpg.asset.json";
import papFesta from "@/assets/catalog-templates/papelaria-festa.jpg.asset.json";
import papPersonalizados from "@/assets/catalog-templates/papelaria-personalizados.jpg.asset.json";
import autoManutencao from "@/assets/catalog-templates/autopecas-manutencao.jpg.asset.json";
import autoEletrica from "@/assets/catalog-templates/autopecas-eletrica.jpg.asset.json";
import autoAcessorios from "@/assets/catalog-templates/autopecas-acessorios.jpg.asset.json";
import autoServicos from "@/assets/catalog-templates/autopecas-servicos.jpg.asset.json";
import artDecoracao from "@/assets/catalog-templates/artesanato-decoracao.jpg.asset.json";
import artCroche from "@/assets/catalog-templates/artesanato-croche.jpg.asset.json";
import artVelas from "@/assets/catalog-templates/artesanato-velas.jpg.asset.json";
import artEncomendas from "@/assets/catalog-templates/artesanato-encomendas.jpg.asset.json";
import otiArmacoes from "@/assets/catalog-templates/otica-armacoes.jpg.asset.json";
import otiSol from "@/assets/catalog-templates/otica-oculos-sol.jpg.asset.json";
import otiLentes from "@/assets/catalog-templates/otica-lentes.jpg.asset.json";
import otiServicos from "@/assets/catalog-templates/otica-servicos.jpg.asset.json";
import stbCabelo from "@/assets/catalog-templates/studio-beleza-cabelo.jpg.asset.json";
import stbUnhas from "@/assets/catalog-templates/studio-beleza-unhas.jpg.asset.json";
import stbMaquiagem from "@/assets/catalog-templates/studio-beleza-maquiagem.jpg.asset.json";
import stbSobrancelhas from "@/assets/catalog-templates/studio-beleza-sobrancelhas.jpg.asset.json";
import stbCombos from "@/assets/catalog-templates/studio-beleza-combos.jpg.asset.json";
import barCortes from "@/assets/catalog-templates/barbearia-cortes.jpg.asset.json";
import barBarba from "@/assets/catalog-templates/barbearia-barba.jpg.asset.json";
import barQuimica from "@/assets/catalog-templates/barbearia-quimica.jpg.asset.json";
import barPlanos from "@/assets/catalog-templates/barbearia-planos.jpg.asset.json";
import estFacial from "@/assets/catalog-templates/estetica-facial.jpg.asset.json";
import estCorporal from "@/assets/catalog-templates/estetica-corporal.jpg.asset.json";
import estDepilacao from "@/assets/catalog-templates/estetica-depilacao.jpg.asset.json";
import estMassagem from "@/assets/catalog-templates/estetica-massagem.jpg.asset.json";
import casEletrica from "@/assets/catalog-templates/casa-eletrica.jpg.asset.json";
import casHidraulica from "@/assets/catalog-templates/casa-hidraulica.jpg.asset.json";
import casPintura from "@/assets/catalog-templates/casa-pintura.jpg.asset.json";
import casMontagem from "@/assets/catalog-templates/casa-montagem.jpg.asset.json";
import fotEnsaios from "@/assets/catalog-templates/foto-ensaios.jpg.asset.json";
import fotEventos from "@/assets/catalog-templates/foto-eventos.jpg.asset.json";
import fotVideo from "@/assets/catalog-templates/foto-video.jpg.asset.json";
import fotProdutos from "@/assets/catalog-templates/foto-produtos.jpg.asset.json";

export const CATALOG_TEMPLATE_MEDIA: Record<string, Record<string, string>> = {
  moda: {
    feminino: modaFeminino.url,
    masculino: modaMasculino.url,
    "calçados": modaCalcados.url,
    "acessórios": modaAcessorios.url,
  },
  petshop: {
    "rações": petRacoes.url,
    "petiscos e snacks": petPetiscos.url,
    "higiene e beleza": petHigiene.url,
    "brinquedos e acessórios": petBrinquedos.url,
  },
  cosmeticos: {
    skincare: cosSkincare.url,
    maquiagem: cosMaquiagem.url,
    cabelos: cosCabelos.url,
    perfumaria: cosPerfumaria.url,
  },
  eletronicos: {
    "acessórios para celular": eleCelular.url,
    "áudio": eleAudio.url,
    "informática": eleInformatica.url,
    "serviços": eleServicos.url,
  },
  mercado: {
    hortifruti: merHortifruti.url,
    mercearia: merMercearia.url,
    "açougue": merAcougue.url,
    bebidas: merBebidas.url,
  },
  floricultura: {
    "buquês": floBuques.url,
    arranjos: floArranjos.url,
    plantas: floPlantas.url,
    "cestas e presentes": floCestas.url,
  },
  papelaria: {
    "material escolar": papEscolar.url,
    "escritório": papEscritorio.url,
    festa: papFesta.url,
    personalizados: papPersonalizados.url,
  },
  autopecas: {
    "manutenção": autoManutencao.url,
    "elétrica": autoEletrica.url,
    "acessórios": autoAcessorios.url,
    "serviços": autoServicos.url,
  },
  artesanato: {
    "decoração": artDecoracao.url,
    "crochê e tricô": artCroche.url,
    "velas e aromas": artVelas.url,
    encomendas: artEncomendas.url,
  },
  otica: {
    "armações de grau": otiArmacoes.url,
    "óculos de sol": otiSol.url,
    lentes: otiLentes.url,
    "serviços": otiServicos.url,
  },
  studio_beleza: {
    cabelo: stbCabelo.url,
    unhas: stbUnhas.url,
    maquiagem: stbMaquiagem.url,
    "sobrancelhas e cílios": stbSobrancelhas.url,
    "combos e pacotes": stbCombos.url,
  },
  barbearia: {
    cortes: barCortes.url,
    "barba e rosto": barBarba.url,
    "química e coloração": barQuimica.url,
    "planos e produtos": barPlanos.url,
  },
  estetica: {
    "estética facial": estFacial.url,
    "estética corporal": estCorporal.url,
    "depilação": estDepilacao.url,
    "massagens e relax": estMassagem.url,
  },
  servicos_casa: {
    "elétrica": casEletrica.url,
    "hidráulica": casHidraulica.url,
    "pintura e reformas": casPintura.url,
    "montagem e limpeza": casMontagem.url,
  },
  fotografia: {
    ensaios: fotEnsaios.url,
    eventos: fotEventos.url,
    "vídeo": fotVideo.url,
    "produtos e extras": fotProdutos.url,
  },
};

/** Imagem de modelo para uma coleção de um template de catálogo (ou null). */
export function catalogCategoryImage(templateKey: string, categoryName: string): string | null {
  const group = CATALOG_TEMPLATE_MEDIA[templateKey];
  if (!group) return null;
  return group[categoryName.trim().toLowerCase()] ?? null;
}

/** Capa do template de catálogo (primeira imagem disponível). */
export function catalogCoverImage(templateKey: string): string | null {
  const group = CATALOG_TEMPLATE_MEDIA[templateKey];
  if (!group) return null;
  return Object.values(group)[0] ?? null;
}
