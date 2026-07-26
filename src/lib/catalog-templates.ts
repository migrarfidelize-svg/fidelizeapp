// ============================================================
// Modelos prontos de CATÁLOGO DIGITAL (produtos, não pratos).
// Cada modelo cria coleções + produtos com preço sugerido,
// marca, SKU e status de estoque. Tudo editável depois.
// ============================================================

export type CatalogTemplateItem = {
  name: string;
  short_desc?: string;
  price?: number;
  promo_price?: number;
  brand?: string;
  sku?: string;
};

export type CatalogTemplateCategory = {
  name: string;
  description?: string;
  featured?: boolean;
  items: CatalogTemplateItem[];
};

export type CatalogTemplate = {
  key: string;
  label: string;
  emoji: string;
  tagline: string;
  categories: CatalogTemplateCategory[];
};

export const CATALOG_TEMPLATES: CatalogTemplate[] = [
  {
    key: "moda",
    label: "Moda & Vestuário",
    emoji: "👗",
    tagline: "Roupas femininas e masculinas, calçados e acessórios.",
    categories: [
      {
        name: "Feminino",
        description: "Peças do dia a dia e ocasiões especiais.",
        featured: true,
        items: [
          { name: "Vestido midi floral", short_desc: "Tecido leve com forro. Tamanhos P ao GG.", price: 189.9, sku: "FEM-001" },
          { name: "Blusa cropped canelada", short_desc: "Malha canelada com toque macio.", price: 79.9, sku: "FEM-002" },
          { name: "Calça wide leg alfaiataria", short_desc: "Cintura alta com passantes e bolsos.", price: 229.9, promo_price: 189.9, sku: "FEM-003" },
          { name: "Conjunto tricot", short_desc: "Blusa + saia em tricot canelado.", price: 259.9, sku: "FEM-004" },
        ],
      },
      {
        name: "Masculino",
        items: [
          { name: "Camiseta pima algodão", short_desc: "Algodão premium, corte regular.", price: 99.9, sku: "MAS-001" },
          { name: "Bermuda sarja", short_desc: "Sarja com elastano e bolsos laterais.", price: 139.9, sku: "MAS-002" },
          { name: "Camisa social slim", short_desc: "Tecido antiamassado, manga longa.", price: 179.9, sku: "MAS-003" },
        ],
      },
      {
        name: "Calçados",
        items: [
          { name: "Tênis casual branco", short_desc: "Solado emborrachado, numeração 34 ao 44.", price: 249.9, sku: "CAL-001" },
          { name: "Sandália rasteira couro", short_desc: "Couro legítimo com palmilha acolchoada.", price: 149.9, sku: "CAL-002" },
        ],
      },
      {
        name: "Acessórios",
        items: [
          { name: "Bolsa transversal", short_desc: "Alça regulável e fecho magnético.", price: 159.9, sku: "ACE-001" },
          { name: "Cinto couro fivela clássica", price: 89.9, sku: "ACE-002" },
          { name: "Óculos de sol UV400", price: 129.9, sku: "ACE-003" },
        ],
      },
    ],
  },

  {
    key: "petshop",
    label: "Pet Shop",
    emoji: "🐾",
    tagline: "Rações, petiscos, higiene, brinquedos e acessórios.",
    categories: [
      {
        name: "Rações",
        featured: true,
        items: [
          { name: "Ração premium cães adultos 15kg", short_desc: "Sabor frango e arroz, todas as raças.", price: 219.9, sku: "RAC-001" },
          { name: "Ração filhotes 10,1kg", short_desc: "Alta digestibilidade e ômega 3.", price: 189.9, sku: "RAC-002" },
          { name: "Ração gatos castrados 3kg", price: 89.9, sku: "RAC-003" },
        ],
      },
      {
        name: "Petiscos e Snacks",
        items: [
          { name: "Bifinho de carne 60g", price: 12.9, sku: "PET-001" },
          { name: "Osso natural defumado", price: 24.9, sku: "PET-002" },
          { name: "Sachê gato 85g", price: 4.9, sku: "PET-003" },
        ],
      },
      {
        name: "Higiene e Beleza",
        items: [
          { name: "Shampoo neutro 500ml", short_desc: "Para pelos claros e escuros.", price: 39.9, sku: "HIG-001" },
          { name: "Tapete higiênico 30un", price: 59.9, sku: "HIG-002" },
          { name: "Kit escova + cortador de unhas", price: 44.9, sku: "HIG-003" },
        ],
      },
      {
        name: "Brinquedos e Acessórios",
        items: [
          { name: "Coleira peitoral ajustável", price: 69.9, sku: "ACS-001" },
          { name: "Mordedor corda", price: 19.9, sku: "ACS-002" },
          { name: "Comedouro inox duplo", price: 54.9, sku: "ACS-003" },
        ],
      },
    ],
  },

  {
    key: "cosmeticos",
    label: "Cosméticos & Beleza",
    emoji: "💄",
    tagline: "Skincare, maquiagem, cabelos e perfumaria.",
    categories: [
      {
        name: "Skincare",
        featured: true,
        items: [
          { name: "Sérum vitamina C 30ml", short_desc: "Uniformiza o tom e ilumina a pele.", price: 129.9, sku: "SKN-001" },
          { name: "Protetor solar FPS 60", short_desc: "Toque seco, com cor.", price: 89.9, sku: "SKN-002" },
          { name: "Gel de limpeza facial 150ml", price: 59.9, sku: "SKN-003" },
          { name: "Hidratante ácido hialurônico", price: 79.9, promo_price: 64.9, sku: "SKN-004" },
        ],
      },
      {
        name: "Maquiagem",
        items: [
          { name: "Base líquida alta cobertura", short_desc: "12 tons disponíveis.", price: 99.9, sku: "MAK-001" },
          { name: "Paleta de sombras 12 cores", price: 89.9, sku: "MAK-002" },
          { name: "Batom matte longa duração", price: 44.9, sku: "MAK-003" },
        ],
      },
      {
        name: "Cabelos",
        items: [
          { name: "Kit shampoo + condicionador nutrição", price: 119.9, sku: "CAB-001" },
          { name: "Máscara de reconstrução 300g", price: 69.9, sku: "CAB-002" },
          { name: "Óleo finalizador 60ml", price: 49.9, sku: "CAB-003" },
        ],
      },
      {
        name: "Perfumaria",
        items: [
          { name: "Eau de parfum feminino 100ml", price: 249.9, sku: "PRF-001" },
          { name: "Body splash 200ml", price: 59.9, sku: "PRF-002" },
        ],
      },
    ],
  },

  {
    key: "eletronicos",
    label: "Eletrônicos & Celulares",
    emoji: "📱",
    tagline: "Acessórios, áudio, informática e assistência.",
    categories: [
      {
        name: "Acessórios para celular",
        featured: true,
        items: [
          { name: "Capa antishock transparente", short_desc: "Modelos para os principais aparelhos.", price: 49.9, sku: "CEL-001" },
          { name: "Película 3D vidro temperado", short_desc: "Aplicação inclusa na loja.", price: 39.9, sku: "CEL-002" },
          { name: "Carregador turbo 30W USB-C", price: 89.9, sku: "CEL-003" },
          { name: "Power bank 10.000mAh", price: 149.9, promo_price: 129.9, sku: "CEL-004" },
        ],
      },
      {
        name: "Áudio",
        items: [
          { name: "Fone bluetooth TWS", short_desc: "Até 20h de bateria com o case.", price: 199.9, sku: "AUD-001" },
          { name: "Caixa de som portátil 20W", price: 299.9, sku: "AUD-002" },
        ],
      },
      {
        name: "Informática",
        items: [
          { name: "Mouse sem fio silencioso", price: 69.9, sku: "INF-001" },
          { name: "Teclado mecânico compacto", price: 249.9, sku: "INF-002" },
          { name: "Hub USB-C 5 em 1", price: 159.9, sku: "INF-003" },
        ],
      },
      {
        name: "Serviços",
        description: "Orçamento sem compromisso.",
        items: [
          { name: "Troca de tela", short_desc: "Valor varia conforme o modelo. Consulte.", sku: "SRV-001" },
          { name: "Troca de bateria", short_desc: "Serviço com garantia de 90 dias.", price: 189.9, sku: "SRV-002" },
        ],
      },
    ],
  },

  {
    key: "mercado",
    label: "Mercado & Hortifruti",
    emoji: "🛒",
    tagline: "Cesta básica, hortifruti, açougue e bebidas.",
    categories: [
      {
        name: "Hortifruti",
        featured: true,
        items: [
          { name: "Banana prata (kg)", price: 7.99, sku: "HRT-001" },
          { name: "Tomate italiano (kg)", price: 9.49, sku: "HRT-002" },
          { name: "Alface crespa (un)", price: 3.99, sku: "HRT-003" },
          { name: "Batata lavada (kg)", price: 6.49, sku: "HRT-004" },
        ],
      },
      {
        name: "Mercearia",
        items: [
          { name: "Arroz tipo 1 - 5kg", price: 27.9, sku: "MER-001" },
          { name: "Feijão carioca 1kg", price: 8.49, sku: "MER-002" },
          { name: "Óleo de soja 900ml", price: 7.29, sku: "MER-003" },
          { name: "Café torrado 500g", price: 18.9, sku: "MER-004" },
        ],
      },
      {
        name: "Açougue",
        items: [
          { name: "Picanha bovina (kg)", price: 79.9, sku: "ACO-001" },
          { name: "Coxa e sobrecoxa (kg)", price: 12.9, sku: "ACO-002" },
          { name: "Linguiça toscana (kg)", price: 22.9, sku: "ACO-003" },
        ],
      },
      {
        name: "Bebidas",
        items: [
          { name: "Refrigerante 2L", price: 9.99, sku: "BEB-001" },
          { name: "Cerveja lata 350ml", price: 4.29, sku: "BEB-002" },
          { name: "Água mineral 1,5L", price: 3.49, sku: "BEB-003" },
        ],
      },
    ],
  },

  {
    key: "floricultura",
    label: "Floricultura & Presentes",
    emoji: "💐",
    tagline: "Buquês, arranjos, plantas e cestas.",
    categories: [
      {
        name: "Buquês",
        featured: true,
        items: [
          { name: "Buquê 12 rosas colombianas", short_desc: "Embalagem premium com cartão.", price: 189.9, sku: "BUQ-001" },
          { name: "Buquê campestre", short_desc: "Flores do campo em tons pastel.", price: 139.9, sku: "BUQ-002" },
          { name: "Buquê girassóis", price: 149.9, sku: "BUQ-003" },
        ],
      },
      {
        name: "Arranjos",
        items: [
          { name: "Arranjo em vaso de vidro", price: 199.9, sku: "ARR-001" },
          { name: "Orquídea phalaenopsis", price: 169.9, sku: "ARR-002" },
        ],
      },
      {
        name: "Plantas",
        items: [
          { name: "Suculenta em vaso cerâmica", price: 39.9, sku: "PLT-001" },
          { name: "Costela de adão média", price: 119.9, sku: "PLT-002" },
        ],
      },
      {
        name: "Cestas e Presentes",
        items: [
          { name: "Cesta café da manhã", short_desc: "Entrega agendada na região.", price: 229.9, sku: "PRE-001" },
          { name: "Box chocolates + flores", price: 159.9, sku: "PRE-002" },
        ],
      },
    ],
  },

  {
    key: "papelaria",
    label: "Papelaria & Presentes",
    emoji: "✏️",
    tagline: "Material escolar, escritório, festa e personalizados.",
    categories: [
      {
        name: "Material escolar",
        featured: true,
        items: [
          { name: "Caderno 10 matérias", price: 34.9, sku: "ESC-001" },
          { name: "Kit canetas gel 12 cores", price: 29.9, sku: "ESC-002" },
          { name: "Mochila escolar reforçada", price: 159.9, sku: "ESC-003" },
        ],
      },
      {
        name: "Escritório",
        items: [
          { name: "Papel sulfite A4 500 folhas", price: 32.9, sku: "ETR-001" },
          { name: "Organizador de mesa", price: 49.9, sku: "ETR-002" },
        ],
      },
      {
        name: "Festa",
        items: [
          { name: "Kit painel + balões", price: 89.9, sku: "FES-001" },
          { name: "Topo de bolo personalizado", price: 39.9, sku: "FES-002" },
        ],
      },
      {
        name: "Personalizados",
        items: [
          { name: "Caneca personalizada 325ml", short_desc: "Envie sua arte pelo WhatsApp.", price: 44.9, sku: "PSN-001" },
          { name: "Camiseta com estampa", price: 69.9, sku: "PSN-002" },
        ],
      },
    ],
  },

  {
    key: "autopecas",
    label: "Autopeças & Oficina",
    emoji: "🔧",
    tagline: "Peças, óleos, acessórios e serviços de oficina.",
    categories: [
      {
        name: "Manutenção",
        featured: true,
        items: [
          { name: "Óleo sintético 5W30 1L", price: 54.9, sku: "MAN-001" },
          { name: "Filtro de óleo", price: 39.9, sku: "MAN-002" },
          { name: "Pastilha de freio dianteira", price: 149.9, sku: "MAN-003" },
        ],
      },
      {
        name: "Elétrica",
        items: [
          { name: "Bateria 60Ah", short_desc: "12 meses de garantia.", price: 449.9, sku: "ELE-001" },
          { name: "Lâmpada LED H4 par", price: 129.9, sku: "ELE-002" },
        ],
      },
      {
        name: "Acessórios",
        items: [
          { name: "Tapete borracha jogo", price: 119.9, sku: "ACS-001" },
          { name: "Capa de banco universal", price: 189.9, sku: "ACS-002" },
        ],
      },
      {
        name: "Serviços",
        items: [
          { name: "Troca de óleo + filtro", short_desc: "Mão de obra inclusa.", price: 89.9, sku: "SRV-001" },
          { name: "Alinhamento e balanceamento", price: 129.9, sku: "SRV-002" },
          { name: "Revisão completa", short_desc: "Checklist de 30 itens. Consulte prazo.", sku: "SRV-003" },
        ],
      },
    ],
  },

  {
    key: "artesanato",
    label: "Artesanato & Feito à Mão",
    emoji: "🧶",
    tagline: "Peças autorais, decoração e encomendas personalizadas.",
    categories: [
      {
        name: "Decoração",
        featured: true,
        items: [
          { name: "Macramê parede médio", price: 149.9, sku: "DEC-001" },
          { name: "Vaso cerâmica pintado à mão", price: 89.9, sku: "DEC-002" },
          { name: "Quadro bordado personalizado", price: 129.9, sku: "DEC-003" },
        ],
      },
      {
        name: "Crochê e Tricô",
        items: [
          { name: "Manta de crochê", price: 249.9, sku: "CRO-001" },
          { name: "Amigurumi personalizado", short_desc: "Produção sob encomenda (7 dias).", price: 119.9, sku: "CRO-002" },
        ],
      },
      {
        name: "Velas e Aromas",
        items: [
          { name: "Vela de soja aromática 180g", price: 59.9, sku: "VEL-001" },
          { name: "Difusor de ambiente 250ml", price: 69.9, sku: "VEL-002" },
        ],
      },
      {
        name: "Encomendas",
        items: [
          { name: "Lembrancinha para evento", short_desc: "Pedido mínimo 20 unidades. Consulte.", sku: "ENC-001" },
        ],
      },
    ],
  },

  {
    key: "otica",
    label: "Ótica",
    emoji: "👓",
    tagline: "Armações, lentes, solares e serviços.",
    categories: [
      {
        name: "Armações de grau",
        featured: true,
        items: [
          { name: "Armação acetato quadrada", price: 299.9, sku: "ARM-001" },
          { name: "Armação metal minimalista", price: 349.9, sku: "ARM-002" },
          { name: "Armação infantil flexível", price: 229.9, sku: "ARM-003" },
        ],
      },
      {
        name: "Óculos de sol",
        items: [
          { name: "Solar polarizado unissex", price: 399.9, promo_price: 329.9, sku: "SOL-001" },
          { name: "Solar espelhado", price: 279.9, sku: "SOL-002" },
        ],
      },
      {
        name: "Lentes",
        items: [
          { name: "Lente antirreflexo (par)", short_desc: "Consulte o grau para orçamento exato.", price: 349.9, sku: "LEN-001" },
          { name: "Lente multifocal digital (par)", price: 899.9, sku: "LEN-002" },
        ],
      },
      {
        name: "Serviços",
        items: [
          { name: "Exame de vista", short_desc: "Agende pelo WhatsApp.", price: 0, sku: "SRV-001" },
          { name: "Ajuste e limpeza", price: 0, sku: "SRV-002" },
        ],
      },
    ],
  },
];

export function findCatalogTemplate(key: string) {
  return CATALOG_TEMPLATES.find((t) => t.key === key) ?? null;
}
