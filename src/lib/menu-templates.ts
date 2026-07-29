// ============================================================
// Catálogo de MODELOS DE CARDÁPIO por segmento.
// Cada modelo tem categorias e, dentro delas, pratos prontos
// (nome, descrição curta, preço sugerido, badges dietéticos).
// ============================================================

export type TemplateItem = {
  name: string;
  short_desc?: string;
  price?: number;
  badges?: string[];        // vegetariano, vegano, sem_gluten, sem_lactose, picante, carne, frutos_mar, contem_ovos, contem_castanhas
  prep_minutes?: number;
};

export type TemplateCategory = {
  name: string;
  description?: string;
  featured?: boolean;
  items: TemplateItem[];
};

export type MenuTemplate = {
  key: string;
  label: string;
  emoji: string;
  tagline: string;
  categories: TemplateCategory[];
};

export const MENU_TEMPLATES: MenuTemplate[] = [
  // ---------------------------------------------------------
  {
    key: "pizzaria",
    label: "Pizzaria",
    emoji: "🍕",
    tagline: "Pizzas artesanais, calzones e bebidas geladas.",
    categories: [
      {
        name: "Pizzas Salgadas",
        description: "Massa artesanal, molho da casa e ingredientes selecionados.",
        featured: true,
        items: [
          { name: "Margherita", short_desc: "Molho de tomate, muçarela, tomate fresco e manjericão.", price: 49.9, badges: ["vegetariano"], prep_minutes: 25 },
          { name: "Calabresa", short_desc: "Calabresa fatiada, cebola roxa, muçarela e azeitona.", price: 54.9, badges: ["carne"], prep_minutes: 25 },
          { name: "Portuguesa", short_desc: "Presunto, ovo, cebola, ervilha, azeitona e muçarela.", price: 59.9, badges: ["carne", "contem_ovos"], prep_minutes: 30 },
          { name: "Frango c/ Catupiry", short_desc: "Frango desfiado temperado e catupiry cremoso.", price: 57.9, badges: ["carne"], prep_minutes: 30 },
          { name: "Quatro Queijos", short_desc: "Muçarela, provolone, parmesão e gorgonzola.", price: 62.9, badges: ["vegetariano"], prep_minutes: 25 },
        ],
      },
      {
        name: "Pizzas Doces",
        items: [
          { name: "Chocolate c/ Morango", short_desc: "Chocolate ao leite derretido e morangos frescos.", price: 55.9, badges: ["vegetariano"], prep_minutes: 25 },
          { name: "Romeu e Julieta", short_desc: "Muçarela e goiabada cremosa.", price: 49.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Calzones & Esfihas",
        items: [
          { name: "Calzone de Calabresa", short_desc: "Massa dobrada recheada com calabresa e muçarela.", price: 39.9, badges: ["carne"] },
          { name: "Esfiha de Carne", short_desc: "Massa leve e recheio suculento (unidade).", price: 8.9, badges: ["carne"] },
        ],
      },
      {
        name: "Bebidas",
        items: [
          { name: "Refrigerante 2L", price: 14.9 },
          { name: "Suco Natural 500ml", short_desc: "Laranja, maracujá ou limão.", price: 12.9, badges: ["vegetariano"] },
          { name: "Água Mineral", price: 5.0 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "hamburgueria",
    label: "Hamburgueria",
    emoji: "🍔",
    tagline: "Burgers artesanais, batatas fritas e milkshakes.",
    categories: [
      {
        name: "Burgers Clássicos",
        featured: true,
        items: [
          { name: "Cheese Bacon", short_desc: "150g de blend, cheddar, bacon crocante e maionese da casa.", price: 34.9, badges: ["carne"], prep_minutes: 15 },
          { name: "Smash Duplo", short_desc: "Dois discos smash 90g, queijo americano e picles.", price: 38.9, badges: ["carne"], prep_minutes: 12 },
          { name: "Salada", short_desc: "Blend 150g, alface, tomate, cebola e maionese.", price: 29.9, badges: ["carne"], prep_minutes: 12 },
        ],
      },
      {
        name: "Burgers Especiais",
        items: [
          { name: "Barbecue Onion", short_desc: "Blend, cheddar, cebola caramelizada e molho barbecue.", price: 36.9, badges: ["carne"], prep_minutes: 15 },
          { name: "Vegano do Chef", short_desc: "Burger de grão-de-bico, alface, tomate e maionese vegana.", price: 32.9, badges: ["vegano"], prep_minutes: 15 },
        ],
      },
      {
        name: "Acompanhamentos",
        items: [
          { name: "Batata Frita", short_desc: "Porção generosa, sequinha por fora e macia por dentro.", price: 22.9, badges: ["vegetariano"] },
          { name: "Onion Rings", short_desc: "Anéis de cebola empanados.", price: 24.9, badges: ["vegetariano"] },
          { name: "Nuggets (10 un.)", price: 21.9, badges: ["carne"] },
        ],
      },
      {
        name: "Milkshakes & Bebidas",
        items: [
          { name: "Milkshake Ovomaltine 400ml", price: 19.9, badges: ["vegetariano"] },
          { name: "Refrigerante Lata", price: 7.0 },
          { name: "Cerveja Long Neck", price: 10.9 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "cafeteria",
    label: "Cafeteria",
    emoji: "☕",
    tagline: "Cafés especiais, doces e brunch.",
    categories: [
      {
        name: "Cafés",
        featured: true,
        items: [
          { name: "Espresso", short_desc: "Extração 25s, café 100% arábica.", price: 6.9, badges: ["vegetariano"] },
          { name: "Cappuccino", short_desc: "Espresso, leite vaporizado e canela.", price: 12.9, badges: ["vegetariano"] },
          { name: "Latte", short_desc: "Espresso com leite cremoso e arte.", price: 13.9, badges: ["vegetariano"] },
          { name: "Mocha", short_desc: "Café, chocolate e chantilly.", price: 15.9, badges: ["vegetariano"] },
          { name: "Café Coado", short_desc: "Grão do dia, método V60.", price: 9.9, badges: ["vegano"] },
        ],
      },
      {
        name: "Doces & Bolos",
        items: [
          { name: "Bolo de Cenoura c/ Chocolate", price: 12.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Cheesecake de Frutas Vermelhas", price: 16.9, badges: ["vegetariano"] },
          { name: "Brownie c/ Nozes", price: 11.9, badges: ["vegetariano", "contem_castanhas"] },
          { name: "Cookie de Chocolate", price: 8.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Brunch & Salgados",
        items: [
          { name: "Ovos Mexidos c/ Torrada", short_desc: "Ovos cremosos e pão artesanal.", price: 22.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Panini de Frango", short_desc: "Frango grelhado, queijo e pesto.", price: 24.9, badges: ["carne"] },
          { name: "Quiche de Alho-Poró", price: 18.9, badges: ["vegetariano", "contem_ovos"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "acai",
    label: "Açaí & Sorveteria",
    emoji: "🍨",
    tagline: "Açaí cremoso, sorvetes e sobremesas geladas.",
    categories: [
      {
        name: "Açaí Tradicional",
        featured: true,
        items: [
          { name: "Açaí 300ml", short_desc: "Base pura de açaí. Escolha 3 acompanhamentos.", price: 16.9, badges: ["vegano"] },
          { name: "Açaí 500ml", price: 22.9, badges: ["vegano"] },
          { name: "Açaí 700ml", price: 28.9, badges: ["vegano"] },
        ],
      },
      {
        name: "Açaí Especial",
        items: [
          { name: "Açaí Power (500ml)", short_desc: "Banana, granola, mel e leite condensado.", price: 26.9, badges: ["vegetariano"] },
          { name: "Açaí Fit (500ml)", short_desc: "Aveia, banana, morango e whey.", price: 27.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Sorvetes",
        items: [
          { name: "Casquinha 1 bola", price: 6.9, badges: ["vegetariano"] },
          { name: "Sundae Chocolate", price: 14.9, badges: ["vegetariano", "contem_castanhas"] },
          { name: "Milkshake 500ml", price: 18.9, badges: ["vegetariano"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "japones",
    label: "Japonês",
    emoji: "🍣",
    tagline: "Sushi, sashimi e temakis frescos.",
    categories: [
      {
        name: "Combinados",
        featured: true,
        items: [
          { name: "Combinado 20 peças", short_desc: "Niguiris, uramakis e sashimis variados.", price: 79.9, badges: ["frutos_mar"], prep_minutes: 20 },
          { name: "Combinado 40 peças", price: 129.9, badges: ["frutos_mar"], prep_minutes: 25 },
          { name: "Barca Salmão 80 peças", price: 199.9, badges: ["frutos_mar"], prep_minutes: 30 },
        ],
      },
      {
        name: "Sashimis",
        items: [
          { name: "Sashimi Salmão (10 un.)", price: 42.9, badges: ["frutos_mar"] },
          { name: "Sashimi Atum (10 un.)", price: 48.9, badges: ["frutos_mar"] },
        ],
      },
      {
        name: "Uramaki & Hot",
        items: [
          { name: "Uramaki Filadélfia", short_desc: "Salmão, cream cheese e cebolinha.", price: 32.9, badges: ["frutos_mar"] },
          { name: "Hot Roll Salmão", short_desc: "Empanado e frito.", price: 34.9, badges: ["frutos_mar"] },
        ],
      },
      {
        name: "Temaki",
        items: [
          { name: "Temaki Salmão", price: 26.9, badges: ["frutos_mar"] },
          { name: "Temaki Atum Spicy", price: 28.9, badges: ["frutos_mar", "picante"] },
        ],
      },
      {
        name: "Bebidas",
        items: [
          { name: "Chá Verde Gelado", price: 8.9, badges: ["vegano"] },
          { name: "Refrigerante Lata", price: 7.0 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "brasileira",
    label: "Comida Brasileira",
    emoji: "🍛",
    tagline: "Almoço executivo, self-service e pratos regionais.",
    categories: [
      {
        name: "Executivos",
        featured: true,
        items: [
          { name: "Filé à Parmegiana", short_desc: "Arroz, fritas, salada e filé empanado.", price: 42.9, badges: ["carne"] },
          { name: "Frango Grelhado Fit", short_desc: "Arroz integral, legumes e salada.", price: 34.9, badges: ["carne"] },
          { name: "Feijoada Individual", short_desc: "Feijão preto, arroz, couve, farofa e laranja.", price: 39.9, badges: ["carne"] },
          { name: "Bife à Cavalo", short_desc: "Contrafilé, ovo, arroz, feijão e fritas.", price: 44.9, badges: ["carne", "contem_ovos"] },
        ],
      },
      {
        name: "Marmitex",
        items: [
          { name: "Marmita P", price: 22.9 },
          { name: "Marmita M", price: 27.9 },
          { name: "Marmita G", price: 32.9 },
        ],
      },
      {
        name: "Porções",
        items: [
          { name: "Fritas c/ Cheddar e Bacon", price: 34.9, badges: ["carne"] },
          { name: "Isca de Frango (500g)", price: 39.9, badges: ["carne"] },
        ],
      },
      {
        name: "Sobremesas",
        items: [
          { name: "Pudim de Leite", price: 12.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Mousse de Maracujá", price: 11.9, badges: ["vegetariano"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "bar",
    label: "Bar & Petiscaria",
    emoji: "🍺",
    tagline: "Petiscos, chopp gelado e drinks autorais.",
    categories: [
      {
        name: "Chopps & Cervejas",
        featured: true,
        items: [
          { name: "Chopp Pilsen 300ml", price: 9.9 },
          { name: "Chopp IPA 300ml", price: 13.9 },
          { name: "Long Neck", price: 10.9 },
        ],
      },
      {
        name: "Drinks",
        items: [
          { name: "Caipirinha de Limão", short_desc: "Cachaça artesanal, limão e açúcar.", price: 19.9 },
          { name: "Gin Tônica", short_desc: "Gin, tônica e especiarias.", price: 28.9 },
          { name: "Aperol Spritz", price: 32.9 },
        ],
      },
      {
        name: "Petiscos",
        items: [
          { name: "Bolinho de Bacalhau (10 un.)", price: 42.9, badges: ["frutos_mar"] },
          { name: "Batata Rústica c/ Alecrim", price: 29.9, badges: ["vegetariano"] },
          { name: "Linguiça Artesanal", price: 34.9, badges: ["carne"] },
          { name: "Isca de Tilápia", price: 44.9, badges: ["frutos_mar"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "doceria",
    label: "Doceria & Confeitaria",
    emoji: "🧁",
    tagline: "Bolos, tortas, doces finos e encomendas.",
    categories: [
      {
        name: "Bolos Fatia",
        featured: true,
        items: [
          { name: "Bolo de Chocolate Trufado", price: 14.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Red Velvet", price: 16.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Bolo de Cenoura c/ Ganache", price: 12.9, badges: ["vegetariano", "contem_ovos"] },
        ],
      },
      {
        name: "Tortas",
        items: [
          { name: "Torta Holandesa", price: 18.9, badges: ["vegetariano"] },
          { name: "Torta de Limão", price: 14.9, badges: ["vegetariano", "contem_ovos"] },
        ],
      },
      {
        name: "Docinhos (100g)",
        items: [
          { name: "Brigadeiro Gourmet", price: 24.9, badges: ["vegetariano"] },
          { name: "Beijinho", price: 22.9, badges: ["vegetariano"] },
          { name: "Cajuzinho", price: 26.9, badges: ["vegetariano", "contem_castanhas"] },
        ],
      },
    ],
  },
  // ---------------------------------------------------------
  {
    key: "churrascaria",
    label: "Churrascaria",
    emoji: "🥩",
    tagline: "Cortes nobres na brasa, espetos e acompanhamentos clássicos.",
    categories: [
      {
        name: "Carnes Nobres",
        description: "Cortes selecionados assados na brasa com sal grosso.",
        featured: true,
        items: [
          { name: "Picanha (400g)", short_desc: "Corte nobre, gordura corada e sal grosso.", price: 89.9, badges: ["carne"], prep_minutes: 25 },
          { name: "Maminha (400g)", short_desc: "Carne macia, ideal para dividir.", price: 72.9, badges: ["carne"], prep_minutes: 25 },
          { name: "Fraldinha (400g)", short_desc: "Sabor marcante e textura suculenta.", price: 76.9, badges: ["carne"], prep_minutes: 25 },
          { name: "Costela de Ripa (600g)", short_desc: "Costela bovina assada lentamente no carvão.", price: 98.9, badges: ["carne"], prep_minutes: 40 },
        ],
      },
      {
        name: "Espetos",
        items: [
          { name: "Espeto de Picanha", short_desc: "Cubos de picanha grelhados na brasa.", price: 34.9, badges: ["carne"] },
          { name: "Espeto de Coração", short_desc: "Coração de frango temperado e grelhado.", price: 24.9, badges: ["carne"] },
          { name: "Espeto de Kafta", short_desc: "Carne moída temperada com especiarias.", price: 28.9, badges: ["carne"] },
        ],
      },
      {
        name: "Acompanhamentos",
        items: [
          { name: "Arroz à Grega", short_desc: "Arroz com passas, cenoura e ervilha.", price: 19.9, badges: ["vegetariano"] },
          { name: "Farofa Especial", short_desc: "Farofa com bacon, ovos e temperos.", price: 16.9, badges: ["carne", "contem_ovos"] },
          { name: "Pão de Alho", short_desc: "Pão francês com manteiga de alho e queijo.", price: 14.9, badges: ["vegetariano"] },
          { name: "Batata Rústica", short_desc: "Batatas assadas com alecrim e sal grosso.", price: 22.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Bebidas",
        items: [
          { name: "Chopp 300ml", price: 9.9 },
          { name: "Refrigerante 2L", price: 14.9 },
          { name: "Suco Natural 500ml", short_desc: "Laranja, limão ou maracujá.", price: 12.9, badges: ["vegetariano"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "mexicano",
    label: "Mexicano",
    emoji: "🌮",
    tagline: "Tacos, burritos, nachos e margaritas autênticas.",
    categories: [
      {
        name: "Tacos",
        description: "Tortillas de milho ou trigo com recheios tradicionais.",
        featured: true,
        items: [
          { name: "Tacos de Carne", short_desc: "Carne grelhada, cebola, coentro e salsa.", price: 29.9, badges: ["carne"], prep_minutes: 15 },
          { name: "Tacos de Frango", short_desc: "Frango desfiado com guacamole e pico de gallo.", price: 27.9, badges: ["carne"], prep_minutes: 15 },
          { name: "Tacos de Peixe", short_desc: "Peixe empanado com repolho e molho chipotle.", price: 32.9, badges: ["frutos_mar"], prep_minutes: 18 },
          { name: "Tacos Veganos", short_desc: "Cogumelos, pimentões e abacate.", price: 26.9, badges: ["vegano"], prep_minutes: 15 },
        ],
      },
      {
        name: "Burritos",
        items: [
          { name: "Burrito Clássico", short_desc: "Arroz, feijão, carne, queijo e sour cream.", price: 34.9, badges: ["carne"] },
          { name: "Burrito de Frango", short_desc: "Frango temperado com guacamole.", price: 32.9, badges: ["carne"] },
          { name: "Burrito Vegetariano", short_desc: "Feijão preto, arroz, queijo e vegetais.", price: 28.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Nachos & Porções",
        items: [
          { name: "Nachos Supremos", short_desc: "Nachos com queijo, jalapeño, guacamole e sour cream.", price: 36.9, badges: ["vegetariano"] },
          { name: "Quesadilla", short_desc: "Tortilla recheada com queijo e frango.", price: 31.9, badges: ["carne"] },
          { name: "Chili com Carne", short_desc: "Chili apimentado servido com nachos.", price: 33.9, badges: ["carne", "picante"] },
        ],
      },
      {
        name: "Margaritas & Bebidas",
        items: [
          { name: "Margarita Clássica", short_desc: "Tequila, limão e sal na borda.", price: 24.9 },
          { name: "Margarita de Morango", short_desc: "Margarita com purê de morango.", price: 26.9, badges: ["vegetariano"] },
          { name: "Cerveja Mexicana", price: 12.9 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "padaria",
    label: "Padaria",
    emoji: "🥖",
    tagline: "Pães artesanais, salgados, bolos e cafés especiais.",
    categories: [
      {
        name: "Pães Artesanais",
        description: "Pães fermentação natural, saídos do forno ao longo do dia.",
        featured: true,
        items: [
          { name: "Baguete Tradicional", short_desc: "Crocante por fora e macia por dentro.", price: 8.9, badges: ["vegetariano"] },
          { name: "Pão de Fermentação Natural", short_desc: "Levain artesanal, crosta rústica.", price: 18.9, badges: ["vegetariano"] },
          { name: "Focaccia de Alecrim", short_desc: "Focaccia com azeite e alecrim.", price: 14.9, badges: ["vegetariano"] },
          { name: "Pão de Queijo", short_desc: "Tradicional mineiro, 6 unidades.", price: 12.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Salgados",
        items: [
          { name: "Coxinha de Frango", short_desc: "Massa cremosa e recheio suculento.", price: 8.9, badges: ["carne"] },
          { name: "Esfihas (un)", short_desc: "Escolha carne, frango ou queijo.", price: 7.9 },
          { name: "Kibe (un)", short_desc: "Kibe frito com recheio de carne.", price: 9.9, badges: ["carne"] },
          { name: "Folhado de Queijo", short_desc: "Massa folhada recheada com queijo.", price: 7.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Bolos",
        items: [
          { name: "Bolo de Cenoura c/ Chocolate", short_desc: "Fatia generosa com cobertura de chocolate.", price: 12.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Bolo de Laranja", short_desc: "Massa fofinha com calda de laranja.", price: 11.9, badges: ["vegetariano", "contem_ovos"] },
          { name: "Pão de Mel", short_desc: "Pão de mel recheado com doce de leite.", price: 6.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Cafés & Bebidas",
        items: [
          { name: "Café Espresso", short_desc: "Café 100% arábica.", price: 6.9, badges: ["vegetariano"] },
          { name: "Cappuccino", short_desc: "Espresso com leite vaporizado.", price: 12.9, badges: ["vegetariano"] },
          { name: "Suco Natural", short_desc: "Laranja, limão ou maracujá.", price: 10.9, badges: ["vegetariano"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "italiano",
    label: "Italiano",
    emoji: "🍝",
    tagline: "Massas frescas, risotos, antepastos e vinhos.",
    categories: [
      {
        name: "Massas",
        description: "Massas artesanais com molhos clássicos e especiais.",
        featured: true,
        items: [
          { name: "Spaghetti à Bolonhesa", short_desc: "Molho de carne cozido lentamente.", price: 42.9, badges: ["carne"], prep_minutes: 20 },
          { name: "Fettuccine Alfredo", short_desc: "Molho cremoso de parmesão e manteiga.", price: 38.9, badges: ["vegetariano"], prep_minutes: 18 },
          { name: "Lasanha à Bolonhesa", short_desc: "Camadas de massa, carne e queijo.", price: 44.9, badges: ["carne", "contem_ovos"], prep_minutes: 30 },
          { name: "Nhoque de Batata", short_desc: "Nhoque caseiro ao molho sugo.", price: 36.9, badges: ["vegetariano"], prep_minutes: 20 },
        ],
      },
      {
        name: "Risotos",
        items: [
          { name: "Risoto de Funghi", short_desc: "Arroz arbóreo com cogumelos e trufas.", price: 48.9, badges: ["vegetariano"] },
          { name: "Risoto de Frutos do Mar", short_desc: "Camarão, lula e polvo.", price: 54.9, badges: ["frutos_mar"] },
          { name: "Risoto de Limone Siciliano", short_desc: "Risoto cítrico com parmesão.", price: 42.9, badges: ["vegetariano"] },
        ],
      },
      {
        name: "Entradas",
        items: [
          { name: "Bruschetta Clássica", short_desc: "Pão italiano com tomate, manjericão e azeite.", price: 22.9, badges: ["vegetariano"] },
          { name: "Caprese", short_desc: "Muçarela de búfala, tomate e manjericão.", price: 34.9, badges: ["vegetariano"] },
          { name: "Carpaccio de Carne", short_desc: "Fatias finas de filé com rúcula e parmesão.", price: 39.9, badges: ["carne"] },
        ],
      },
      {
        name: "Vinhos & Bebidas",
        items: [
          { name: "Vinho Tinto da Casa", short_desc: "Taça de vinho tinto suave.", price: 18.9 },
          { name: "Vinho Branco da Casa", short_desc: "Taça de vinho branco leve.", price: 17.9 },
          { name: "Água com Gás", price: 6.9 },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "saudavel",
    label: "Saudável & Fit",
    emoji: "🥗",
    tagline: "Bowls, saladas, wraps e sucos para uma refeição leve.",
    categories: [
      {
        name: "Bowls",
        description: "Bowls completos, nutritivos e equilibrados.",
        featured: true,
        items: [
          { name: "Buddha Bowl", short_desc: "Quinoa, grão-de-bico, abacate e vegetais.", price: 34.9, badges: ["vegano"], prep_minutes: 15 },
          { name: "Poke Bowl Salmão", short_desc: "Salmão cru, arroz, edamame e molho tarê.", price: 42.9, badges: ["frutos_mar"], prep_minutes: 15 },
          { name: "Açaí Bowl", short_desc: "Açaí com granola, banana e mel.", price: 24.9, badges: ["vegetariano"] },
          { name: "Tropical Bowl", short_desc: "Manga, abacate, camarão e arroz integral.", price: 38.9, badges: ["frutos_mar"] },
        ],
      },
      {
        name: "Saladas",
        items: [
          { name: "Salada Caesar", short_desc: "Alface, croutons, parmesão e molho caesar.", price: 28.9, badges: ["carne"] },
          { name: "Salada Grega", short_desc: "Pepino, tomate, azeitona e queijo feta.", price: 26.9, badges: ["vegetariano"] },
          { name: "Salada de Quinoa", short_desc: "Quinoa, rúcula, tomate seco e castanhas.", price: 29.9, badges: ["vegetariano", "contem_castanhas"] },
        ],
      },
      {
        name: "Wraps",
        items: [
          { name: "Wrap de Frango", short_desc: "Frango grelhado, alface e molho mostarda.", price: 27.9, badges: ["carne"] },
          { name: "Wrap Vegano", short_desc: "Hummus, cogumelos e vegetais grelhados.", price: 25.9, badges: ["vegano"] },
          { name: "Wrap de Atum", short_desc: "Atum, alface, tomate e azeite.", price: 29.9, badges: ["frutos_mar"] },
        ],
      },
      {
        name: "Sucos & Detox",
        items: [
          { name: "Suco Verde Detox", short_desc: "Couve, limão, gengibre e maçã.", price: 14.9, badges: ["vegano"] },
          { name: "Suco de Laranja Natural", short_desc: "Laranja espremida na hora.", price: 10.9, badges: ["vegano"] },
          { name: "Smoothie de Açaí", short_desc: "Açaí, banana e morango.", price: 18.9, badges: ["vegano"] },
        ],
      },
    ],
  },

  // ---------------------------------------------------------
  {
    key: "marisqueira",
    label: "Marisqueira",
    emoji: "🦐",
    tagline: "Camarões, frutos do mar, peixes frescos e cervejas artesanais.",
    categories: [
      {
        name: "Camarões",
        description: "Camarões frescos em preparações clássicas e especiais.",
        featured: true,
        items: [
          { name: "Camarão ao Alho e Óleo", short_desc: "Camarões salteados no alho e azeite.", price: 64.9, badges: ["frutos_mar"], prep_minutes: 20 },
          { name: "Camarão Empanado", short_desc: "Camarões empanados com molho tártaro.", price: 58.9, badges: ["frutos_mar"], prep_minutes: 20 },
          { name: "Camarão ao Curry", short_desc: "Camarões ao molho de curry com leite de coco.", price: 67.9, badges: ["frutos_mar", "picante"], prep_minutes: 25 },
          { name: "Camarão 7 Barbas", short_desc: "Camarão grelhado com manteiga de ervas.", price: 72.9, badges: ["frutos_mar"], prep_minutes: 25 },
        ],
      },
      {
        name: "Frutos do Mar",
        items: [
          { name: "Ostras (6 un.)", short_desc: "Ostras frescas com limão e tabasco.", price: 84.9, badges: ["frutos_mar"] },
          { name: "Mexilhão ao Vapor", short_desc: "Mexilhões cozidos no vinho branco.", price: 49.9, badges: ["frutos_mar"] },
          { name: "Lula à Dore", short_desc: "Lulas empanadas e fritas.", price: 54.9, badges: ["frutos_mar"] },
        ],
      },
      {
        name: "Peixes",
        items: [
          { name: "Salmão Grelhado", short_desc: "Salmão grelhado com legumes.", price: 62.9, badges: ["frutos_mar"] },
          { name: "Robalo ao Molho de Camarão", short_desc: "Robalo grelhado com molho de camarão.", price: 76.9, badges: ["frutos_mar"] },
          { name: "Peixe Frito com Aipim", short_desc: "Tilápia frita com aipim e salada.", price: 48.9, badges: ["frutos_mar"] },
        ],
      },
      {
        name: "Bebidas",
        items: [
          { name: "Cerveja Artesanal", short_desc: "Chopp ou long neck artesanal.", price: 16.9 },
          { name: "Vinho Branco", short_desc: "Taça de vinho branco leve.", price: 18.9 },
          { name: "Caipirinha de Limão", short_desc: "Clássica brasileira.", price: 19.9 },
        ],
      },
    ],
  },
];

export function findTemplate(key: string) {
  return MENU_TEMPLATES.find((t) => t.key === key) ?? null;
}
