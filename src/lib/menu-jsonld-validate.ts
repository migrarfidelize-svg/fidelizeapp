// Validador de JSON-LD (Restaurant/Menu) inspirado nos erros mais comuns do
// Google Rich Results Test. Não substitui o teste oficial, mas cobre 100%
// dos avisos que aparecem regularmente para este tipo de schema.

export type Severity = "error" | "warning" | "info";

export type Finding = {
  code: string;
  severity: Severity;
  path: string;
  message: string;
  hint?: string;
};

const isHttps = (u: unknown) => typeof u === "string" && /^https:\/\//i.test(u);
const isAbsUrl = (u: unknown) => typeof u === "string" && /^https?:\/\//i.test(u);

export function validateMenuJsonLd(json: any): Finding[] {
  const f: Finding[] = [];
  const push = (x: Finding) => f.push(x);

  if (!json || typeof json !== "object") {
    return [{ code: "NOT_OBJECT", severity: "error", path: "$", message: "JSON-LD ausente ou inválido." }];
  }

  // 1. @context / @type raiz
  if (json["@context"] !== "https://schema.org") {
    push({
      code: "CONTEXT_MISSING",
      severity: "error",
      path: "@context",
      message: "@context deve ser 'https://schema.org'.",
    });
  }
  if (json["@type"] !== "Restaurant") {
    push({
      code: "TYPE_ROOT",
      severity: "error",
      path: "@type",
      message: `@type raiz deveria ser 'Restaurant' (encontrado: ${JSON.stringify(json["@type"])}).`,
    });
  }

  // 2. Campos essenciais do Restaurant
  if (!json.name || typeof json.name !== "string") {
    push({ code: "NAME_REQUIRED", severity: "error", path: "name", message: "'name' é obrigatório." });
  }
  if (!json.url) {
    push({ code: "URL_REQUIRED", severity: "error", path: "url", message: "'url' é obrigatório." });
  } else if (!isAbsUrl(json.url)) {
    push({ code: "URL_ABS", severity: "error", path: "url", message: "'url' deve ser absoluta (http/https)." });
  } else if (!isHttps(json.url)) {
    push({ code: "URL_HTTPS", severity: "warning", path: "url", message: "Prefira HTTPS em 'url'." });
  }

  // 3. Imagem (recomendada; se presente deve ser absoluta e HTTPS)
  if (!json.image) {
    push({
      code: "IMAGE_MISSING",
      severity: "warning",
      path: "image",
      message: "Sem 'image' — o Google recomenda imagem para restaurantes.",
      hint: "Envie uma capa ou logo no cadastro do estabelecimento.",
    });
  } else if (!isAbsUrl(json.image)) {
    push({ code: "IMAGE_ABS", severity: "error", path: "image", message: "'image' precisa ser URL absoluta." });
  } else if (!isHttps(json.image)) {
    push({ code: "IMAGE_HTTPS", severity: "warning", path: "image", message: "'image' deveria usar HTTPS." });
  }

  // 4. Endereço estruturado
  if (!json.address) {
    push({
      code: "ADDRESS_MISSING",
      severity: "warning",
      path: "address",
      message: "Sem PostalAddress — Rich Result de restaurante pede endereço estruturado.",
      hint: "Preencha o endereço nas configurações da empresa.",
    });
  } else {
    if (json.address["@type"] !== "PostalAddress") {
      push({
        code: "ADDRESS_TYPE",
        severity: "error",
        path: "address.@type",
        message: "address.@type deve ser 'PostalAddress'.",
      });
    }
    if (!json.address.streetAddress) {
      push({
        code: "ADDRESS_STREET",
        severity: "warning",
        path: "address.streetAddress",
        message: "'streetAddress' ausente.",
      });
    }
    if (!json.address.addressLocality) {
      push({
        code: "ADDRESS_LOCALITY",
        severity: "warning",
        path: "address.addressLocality",
        message: "Recomendado: 'addressLocality' (cidade).",
      });
    }
    if (!json.address.addressCountry) {
      push({
        code: "ADDRESS_COUNTRY",
        severity: "warning",
        path: "address.addressCountry",
        message: "Recomendado: 'addressCountry' (ex.: 'BR').",
      });
    }
  }

  // 5. Telefone / cozinha (info level)
  if (!json.telephone) {
    push({ code: "TELEPHONE_MISSING", severity: "info", path: "telephone", message: "Recomendado: 'telephone'." });
  }
  if (!json.servesCuisine) {
    push({
      code: "CUISINE_MISSING",
      severity: "info",
      path: "servesCuisine",
      message: "Recomendado: 'servesCuisine' (tipo de cozinha) para o Rich Result.",
    });
  }

  // 6. Menu
  const menu = json.hasMenu;
  if (!menu) {
    push({ code: "MENU_REQUIRED", severity: "error", path: "hasMenu", message: "Falta 'hasMenu'." });
  } else {
    if (menu["@type"] !== "Menu") {
      push({ code: "MENU_TYPE", severity: "error", path: "hasMenu.@type", message: "hasMenu.@type deve ser 'Menu'." });
    }
    if (!menu.name) {
      push({ code: "MENU_NAME", severity: "warning", path: "hasMenu.name", message: "'hasMenu.name' recomendado." });
    }
    const sections: any[] = menu.hasMenuSection ?? [];
    if (!sections.length) {
      push({
        code: "MENU_SECTIONS_EMPTY",
        severity: "error",
        path: "hasMenu.hasMenuSection",
        message: "Nenhuma seção — cardápio precisa de ao menos uma 'MenuSection'.",
        hint: "Publique categorias com itens.",
      });
    }

    let totalItems = 0;
    sections.forEach((s: any, si: number) => {
      const p = `hasMenu.hasMenuSection[${si}]`;
      if (s["@type"] !== "MenuSection") {
        push({ code: "SECTION_TYPE", severity: "error", path: `${p}.@type`, message: "'@type' deve ser 'MenuSection'." });
      }
      if (!s.name) {
        push({ code: "SECTION_NAME", severity: "error", path: `${p}.name`, message: "Seção sem 'name'." });
      }
      const items: any[] = s.hasMenuItem ?? [];
      if (!items.length) {
        push({
          code: "SECTION_EMPTY",
          severity: "warning",
          path: `${p}.hasMenuItem`,
          message: `Seção '${s.name ?? "?"}' sem itens.`,
        });
      }
      items.forEach((it: any, ii: number) => {
        totalItems++;
        const ip = `${p}.hasMenuItem[${ii}]`;
        if (it["@type"] !== "MenuItem") {
          push({ code: "ITEM_TYPE", severity: "error", path: `${ip}.@type`, message: "'@type' deve ser 'MenuItem'." });
        }
        if (!it.name) {
          push({ code: "ITEM_NAME", severity: "error", path: `${ip}.name`, message: "Item sem 'name'." });
        }
        if (!it.offers) {
          push({
            code: "ITEM_OFFER_MISSING",
            severity: "warning",
            path: `${ip}.offers`,
            message: `Item '${it.name ?? "?"}' sem 'offers' (preço).`,
            hint: "Rich Result de menu prioriza itens com preço.",
          });
        } else {
          const o = it.offers;
          if (o["@type"] !== "Offer") {
            push({ code: "OFFER_TYPE", severity: "error", path: `${ip}.offers.@type`, message: "offers.@type deve ser 'Offer'." });
          }
          if (o.price === undefined || o.price === null || o.price === "") {
            push({ code: "OFFER_PRICE", severity: "error", path: `${ip}.offers.price`, message: "Falta 'price'." });
          } else if (Number.isNaN(Number(o.price))) {
            push({ code: "OFFER_PRICE_NUM", severity: "error", path: `${ip}.offers.price`, message: "'price' deve ser numérico (string com número)." });
          } else if (typeof o.price === "string" && !/^\d+(\.\d{1,2})?$/.test(o.price)) {
            push({
              code: "OFFER_PRICE_FORMAT",
              severity: "warning",
              path: `${ip}.offers.price`,
              message: "'price' deveria estar no formato '12.90' (ponto, 2 casas).",
            });
          }
          if (!o.priceCurrency) {
            push({ code: "OFFER_CURRENCY", severity: "error", path: `${ip}.offers.priceCurrency`, message: "Falta 'priceCurrency' (ex.: 'BRL')." });
          } else if (!/^[A-Z]{3}$/.test(o.priceCurrency)) {
            push({ code: "OFFER_CURRENCY_ISO", severity: "error", path: `${ip}.offers.priceCurrency`, message: "'priceCurrency' deve ser ISO 4217 (3 letras)." });
          }
          if (o.availability && !/^https:\/\/schema\.org\/(InStock|OutOfStock|Discontinued|LimitedAvailability|PreOrder|SoldOut)$/.test(o.availability)) {
            push({ code: "OFFER_AVAIL", severity: "warning", path: `${ip}.offers.availability`, message: "'availability' fora do enum schema.org." });
          }
        }
        if (it.image && !isAbsUrl(it.image)) {
          push({ code: "ITEM_IMAGE_ABS", severity: "error", path: `${ip}.image`, message: "'image' do item deve ser absoluta." });
        }
      });
    });

    if (totalItems === 0 && sections.length > 0) {
      push({ code: "MENU_NO_ITEMS", severity: "error", path: "hasMenu", message: "Cardápio sem nenhum item — Google não vai renderizar Rich Result." });
    }
  }

  // 7. Byte size — Google recomenda < 10KB para JSON-LD por bloco
  try {
    const size = new Blob([JSON.stringify(json)]).size;
    if (size > 10 * 1024) {
      push({
        code: "JSONLD_SIZE",
        severity: "warning",
        path: "$",
        message: `JSON-LD com ${(size / 1024).toFixed(1)}KB — Google pode truncar acima de 10KB.`,
      });
    }
  } catch { /* browser only */ }

  return f;
}

export function summarizeFindings(findings: Finding[]) {
  return {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    infos: findings.filter((f) => f.severity === "info").length,
    valid: !findings.some((f) => f.severity === "error"),
  };
}
