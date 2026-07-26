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

  // ==========================================================
  // MODELOS DE SERVIÇOS (studios, salões, prestadores)
  // Dica: o tempo de duração vai na descrição e o preço é o
  // valor "a partir de". Depois é só editar tudo.
  // ==========================================================

  {
    key: "studio_beleza",
    label: "Studio de Beleza",
    emoji: "💇‍♀️",
    tagline: "Cabelo, unhas, maquiagem, sobrancelhas e combos.",
    categories: [
      {
        name: "Cabelo",
        description: "Corte, coloração e tratamentos.",
        featured: true,
        items: [
          { name: "Corte feminino + escova", short_desc: "Lavagem, corte e finalização. ⏱ 1h", price: 90, sku: "CAB-001" },
          { name: "Escova modelada", short_desc: "Lisa, ondulada ou cacheada. ⏱ 45 min", price: 55, sku: "CAB-002" },
          { name: "Coloração raiz", short_desc: "Cobertura de brancos com tinta profissional. ⏱ 1h30", price: 160, sku: "CAB-003" },
          { name: "Mechas / luzes", short_desc: "Orçamento conforme comprimento. ⏱ 3h", price: 350, sku: "CAB-004" },
          { name: "Progressiva sem formol", short_desc: "Redução de volume e brilho. ⏱ 2h30", price: 280, promo_price: 240, sku: "CAB-005" },
          { name: "Hidratação profunda", short_desc: "Máscara + ampola reconstrutora. ⏱ 40 min", price: 70, sku: "CAB-006" },
        ],
      },
      {
        name: "Unhas",
        description: "Manicure, pedicure e alongamentos.",
        items: [
          { name: "Manicure simples", short_desc: "Cutícula, lixa e esmaltação. ⏱ 40 min", price: 40, sku: "UNH-001" },
          { name: "Pedicure completa", short_desc: "Esfoliação, cutícula e esmaltação. ⏱ 50 min", price: 50, sku: "UNH-002" },
          { name: "Combo mão + pé", short_desc: "Manicure e pedicure no mesmo horário. ⏱ 1h20", price: 80, promo_price: 70, sku: "UNH-003" },
          { name: "Esmaltação em gel", short_desc: "Durabilidade de até 3 semanas. ⏱ 1h", price: 75, sku: "UNH-004" },
          { name: "Alongamento em fibra de vidro", short_desc: "Aplicação completa. ⏱ 2h30", price: 180, sku: "UNH-005" },
          { name: "Manutenção de alongamento", short_desc: "A cada 21 dias. ⏱ 1h30", price: 110, sku: "UNH-006" },
        ],
      },
      {
        name: "Maquiagem",
        items: [
          { name: "Maquiagem social", short_desc: "Para festas e eventos. ⏱ 1h", price: 140, sku: "MAQ-001" },
          { name: "Maquiagem noiva + prova", short_desc: "Inclui teste prévio e retoque. ⏱ 2h", price: 450, sku: "MAQ-002" },
          { name: "Maquiagem express", short_desc: "Pele, cílios e boca. ⏱ 30 min", price: 80, sku: "MAQ-003" },
          { name: "Aula de automaquiagem", short_desc: "Individual, com seus produtos. ⏱ 1h30", price: 200, sku: "MAQ-004" },
        ],
      },
      {
        name: "Sobrancelhas e cílios",
        items: [
          { name: "Design de sobrancelhas", short_desc: "Com pinça e linha. ⏱ 30 min", price: 45, sku: "SOB-001" },
          { name: "Design com henna", short_desc: "Preenchimento e correção. ⏱ 45 min", price: 65, sku: "SOB-002" },
          { name: "Brow lamination", short_desc: "Alinhamento e nutrição dos fios. ⏱ 1h", price: 150, sku: "SOB-003" },
          { name: "Extensão de cílios fio a fio", short_desc: "Efeito natural. ⏱ 2h", price: 190, sku: "CIL-001" },
          { name: "Lash lifting", short_desc: "Curvatura + nutrição. ⏱ 1h10", price: 130, sku: "CIL-002" },
        ],
      },
      {
        name: "Combos e pacotes",
        description: "Pacotes com desconto — ideal para fidelizar.",
        items: [
          { name: "Dia da noiva", short_desc: "Cabelo, maquiagem, unhas e espumante. ⏱ 4h", price: 890, sku: "PAC-001" },
          { name: "Combo beleza completa", short_desc: "Corte + escova + design + manicure. ⏱ 2h30", price: 210, promo_price: 179, sku: "PAC-002" },
          { name: "Pacote mensal de unhas", short_desc: "4 manutenções no mês. Validade 30 dias.", price: 380, sku: "PAC-003" },
          { name: "Vale-presente", short_desc: "Crédito para qualquer serviço do studio.", price: 100, sku: "PAC-004" },
        ],
      },
    ],
  },

  {
    key: "barbearia",
    label: "Barbearia",
    emoji: "💈",
    tagline: "Cortes, barba, pigmentação e planos mensais.",
    categories: [
      {
        name: "Cortes",
        featured: true,
        items: [
          { name: "Corte masculino", short_desc: "Máquina e tesoura, com finalização. ⏱ 40 min", price: 55, sku: "COR-001" },
          { name: "Corte + barba", short_desc: "Combo mais pedido. ⏱ 1h10", price: 85, promo_price: 75, sku: "COR-002" },
          { name: "Corte infantil", short_desc: "Até 10 anos. ⏱ 30 min", price: 45, sku: "COR-003" },
          { name: "Degradê navalhado", short_desc: "Acabamento na navalha. ⏱ 50 min", price: 65, sku: "COR-004" },
        ],
      },
      {
        name: "Barba e rosto",
        items: [
          { name: "Barba tradicional", short_desc: "Toalha quente, navalha e balm. ⏱ 40 min", price: 45, sku: "BAR-001" },
          { name: "Barboterapia", short_desc: "Vapor, esfoliação e massagem facial. ⏱ 50 min", price: 70, sku: "BAR-002" },
          { name: "Limpeza de pele masculina", short_desc: "Remoção de cravos e hidratação. ⏱ 1h", price: 120, sku: "BAR-003" },
        ],
      },
      {
        name: "Química e coloração",
        items: [
          { name: "Pigmentação de barba", short_desc: "Preenche falhas. ⏱ 40 min", price: 60, sku: "QUI-001" },
          { name: "Platinado", short_desc: "Descoloração + matização. ⏱ 2h30", price: 250, sku: "QUI-002" },
          { name: "Relaxamento capilar", short_desc: "Reduz volume. ⏱ 1h", price: 110, sku: "QUI-003" },
        ],
      },
      {
        name: "Planos e produtos",
        items: [
          { name: "Plano mensal ilimitado", short_desc: "Cortes ilimitados no mês + 1 barba/semana.", price: 189, sku: "PLA-001" },
          { name: "Clube do cavalheiro", short_desc: "4 cortes + 2 barbas por mês.", price: 149, sku: "PLA-002" },
          { name: "Pomada modeladora", short_desc: "Fixação forte, efeito matte. 120g", price: 49.9, brand: "Casa", sku: "PRO-001" },
          { name: "Óleo para barba", short_desc: "Hidrata e perfuma. 30ml", price: 39.9, brand: "Casa", sku: "PRO-002" },
        ],
      },
    ],
  },

  {
    key: "estetica",
    label: "Estética & Bem-estar",
    emoji: "✨",
    tagline: "Facial, corporal, depilação e massagens.",
    categories: [
      {
        name: "Estética facial",
        featured: true,
        items: [
          { name: "Limpeza de pele profunda", short_desc: "Extração, alta frequência e máscara. ⏱ 1h20", price: 180, sku: "FAC-001" },
          { name: "Peeling de diamante", short_desc: "Renovação celular. ⏱ 1h", price: 160, sku: "FAC-002" },
          { name: "Microagulhamento", short_desc: "Estímulo de colágeno. ⏱ 1h", price: 350, sku: "FAC-003" },
          { name: "Skinbooster / hidratação", short_desc: "Viço imediato. ⏱ 45 min", price: 220, sku: "FAC-004" },
        ],
      },
      {
        name: "Estética corporal",
        items: [
          { name: "Drenagem linfática", short_desc: "Sessão completa. ⏱ 1h", price: 130, sku: "COR-001" },
          { name: "Massagem modeladora", short_desc: "Redução de medidas. ⏱ 1h", price: 150, sku: "COR-002" },
          { name: "Pacote 10 sessões", short_desc: "Drenagem ou modeladora. Validade 60 dias.", price: 1100, promo_price: 990, sku: "COR-003" },
          { name: "Radiofrequência corporal", short_desc: "Firmeza e colágeno. ⏱ 50 min", price: 190, sku: "COR-004" },
        ],
      },
      {
        name: "Depilação",
        items: [
          { name: "Axilas — cera", short_desc: "⏱ 15 min", price: 35, sku: "DEP-001" },
          { name: "Meia perna — cera", short_desc: "⏱ 30 min", price: 55, sku: "DEP-002" },
          { name: "Virilha completa", short_desc: "⏱ 30 min", price: 70, sku: "DEP-003" },
          { name: "Depilação a laser — sessão", short_desc: "Consulte áreas e pacotes. ⏱ 40 min", price: 120, sku: "DEP-004" },
        ],
      },
      {
        name: "Massagens e relax",
        items: [
          { name: "Massagem relaxante", short_desc: "Corpo todo com óleos essenciais. ⏱ 1h", price: 140, sku: "MAS-001" },
          { name: "Pedras quentes", short_desc: "Alívio de tensão profunda. ⏱ 1h15", price: 180, sku: "MAS-002" },
          { name: "Day spa casal", short_desc: "Massagem + escalda-pés + chá. ⏱ 2h", price: 390, sku: "MAS-003" },
        ],
      },
    ],
  },

  {
    key: "servicos_casa",
    label: "Serviços para Casa",
    emoji: "🛠️",
    tagline: "Elétrica, hidráulica, pintura, montagem e limpeza.",
    categories: [
      {
        name: "Elétrica",
        featured: true,
        items: [
          { name: "Visita técnica + diagnóstico", short_desc: "Abatido do serviço aprovado. ⏱ 1h", price: 90, sku: "ELE-001" },
          { name: "Instalação de tomada/interruptor", short_desc: "Por ponto. ⏱ 40 min", price: 80, sku: "ELE-002" },
          { name: "Instalação de chuveiro", short_desc: "Inclui verificação do disjuntor. ⏱ 1h", price: 150, sku: "ELE-003" },
          { name: "Troca de quadro de disjuntores", short_desc: "Orçamento após visita.", price: 450, sku: "ELE-004" },
        ],
      },
      {
        name: "Hidráulica",
        items: [
          { name: "Reparo de vazamento", short_desc: "Diagnóstico e conserto simples. ⏱ 1h30", price: 180, sku: "HID-001" },
          { name: "Desentupimento de pia", short_desc: "⏱ 1h", price: 160, sku: "HID-002" },
          { name: "Instalação de torneira/válvula", short_desc: "Por peça. ⏱ 40 min", price: 90, sku: "HID-003" },
        ],
      },
      {
        name: "Pintura e reformas",
        items: [
          { name: "Pintura de parede — m²", short_desc: "Mão de obra, 2 demãos. Material à parte.", price: 28, sku: "PIN-001" },
          { name: "Textura / grafiato — m²", price: 45, sku: "PIN-002" },
          { name: "Pequenos reparos (diária)", short_desc: "8h de serviço com ferramentas.", price: 380, sku: "REP-001" },
        ],
      },
      {
        name: "Montagem e limpeza",
        items: [
          { name: "Montagem de móveis (hora)", short_desc: "Guarda-roupa, cama, estante. ⏱ 1h", price: 110, sku: "MON-001" },
          { name: "Instalação de suporte de TV", short_desc: "Inclui nivelamento. ⏱ 1h", price: 140, sku: "MON-002" },
          { name: "Limpeza pesada (diária)", short_desc: "Pós-obra ou mudança. ⏱ 8h", price: 320, sku: "LIM-001" },
          { name: "Higienização de sofá — 3 lugares", short_desc: "Secagem em até 6h. ⏱ 1h30", price: 220, sku: "LIM-002" },
        ],
      },
    ],
  },

  {
    key: "fotografia",
    label: "Fotografia & Eventos",
    emoji: "📸",
    tagline: "Ensaios, eventos, vídeo e pacotes corporativos.",
    categories: [
      {
        name: "Ensaios",
        featured: true,
        items: [
          { name: "Ensaio individual", short_desc: "1h de sessão + 20 fotos tratadas.", price: 590, sku: "ENS-001" },
          { name: "Ensaio gestante", short_desc: "Estúdio ou externa + 30 fotos.", price: 890, sku: "ENS-002" },
          { name: "Ensaio família", short_desc: "Até 5 pessoas + 30 fotos.", price: 790, sku: "ENS-003" },
          { name: "Book profissional / LinkedIn", short_desc: "10 fotos com retoque. ⏱ 45 min", price: 450, promo_price: 390, sku: "ENS-004" },
        ],
      },
      {
        name: "Eventos",
        items: [
          { name: "Aniversário — 4h", short_desc: "Cobertura + galeria online.", price: 1290, sku: "EVE-001" },
          { name: "Casamento — pacote completo", short_desc: "Making of à festa, 2 fotógrafos.", price: 4900, sku: "EVE-002" },
          { name: "Evento corporativo (hora)", short_desc: "Mínimo 3h.", price: 350, sku: "EVE-003" },
        ],
      },
      {
        name: "Vídeo",
        items: [
          { name: "Reels para redes sociais", short_desc: "3 vídeos verticais editados.", price: 690, sku: "VID-001" },
          { name: "Vídeo institucional", short_desc: "Roteiro, captação e edição até 2 min.", price: 2400, sku: "VID-002" },
          { name: "Cobertura com drone", short_desc: "Adicional por evento.", price: 600, sku: "VID-003" },
        ],
      },
      {
        name: "Produtos e extras",
        items: [
          { name: "Fotos de produto (10 itens)", short_desc: "Fundo branco, prontas para e-commerce.", price: 690, sku: "PRD-001" },
          { name: "Álbum impresso 20x30", short_desc: "30 páginas, capa dura.", price: 750, sku: "EXT-001" },
          { name: "Foto extra tratada", price: 35, sku: "EXT-002" },
        ],
      },
    ],
  },
];

export function findCatalogTemplate(key: string) {
  return CATALOG_TEMPLATES.find((t) => t.key === key) ?? null;
}
