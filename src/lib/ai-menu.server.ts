/**
 * Server-only helpers for the "Inteligência com IA" module.
 * Uses raw fetch against Lovable AI Gateway (same pattern as faq-ai.functions.ts).
 * Shared between menu.ai and catalog.ai — the surface param drives prompt tone.
 */
import { createHash } from "crypto";

export type Surface = "menu" | "catalog";

export const MONTHLY_QUOTAS: Record<string, Record<Surface, number>> = {
  free:       { menu: 0,  catalog: 0 },
  starter:    { menu: 3,  catalog: 3 },
  pro:        { menu: 30, catalog: 30 },
  enterprise: { menu: 999999, catalog: 999999 },
};

export function surfaceKey(surface: Surface) {
  return surface === "menu" ? "menu.ai" : "catalog.ai";
}
export function surfacePermission(surface: Surface) {
  return surface === "menu" ? "menu.ai.use" : "catalog.ai.use";
}

export function itemHash(item: {
  name?: string | null;
  description?: string | null;
  price?: number | string | null;
  image_url?: string | null;
}) {
  const raw = JSON.stringify({
    n: item.name ?? "",
    d: item.description ?? "",
    p: String(item.price ?? ""),
    i: item.image_url ?? "",
  });
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

async function callGateway(body: Record<string, unknown>): Promise<any> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Muitas solicitações. Aguarde alguns segundos e tente novamente.");
  if (res.status === 402) throw new Error("Créditos de IA esgotados. Recarregue seus créditos ou aguarde a próxima cobrança.");
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gateway ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

function extractJson(text: string): any {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}

// ---------------- ANALYSIS ----------------

export type Finding = {
  key: string;
  type: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  target_type: "item" | "category" | "menu";
  target_id: string | null;
  target_label: string;
  problem: string;
  recommendation: string;
  suggested_payload: string | null;
};

export type AnalysisResult = {
  overall_score: number;
  scores: {
    images: number;
    descriptions: number;
    organization: number;
    product_info: number;
    conversion: number;
    combos: number;
    experience: number;
  };
  findings: Finding[];
};

export async function runAnalysis(
  surface: Surface,
  payload: {
    establishment_name: string;
    categories: Array<{ id: string; name: string; item_count: number }>;
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number | null;
      image_url: string | null;
      category_id: string | null;
      is_available: boolean;
      views_30d: number;
      clicks_30d: number;
    }>;
  },
): Promise<{ result: AnalysisResult; tokens: number; model: string }> {
  const isMenu = surface === "menu";
  const domain = isMenu ? "cardápio de restaurante/delivery" : "catálogo de produtos de loja";
  const combosLabel = isMenu ? "combos (prato+bebida, sobremesa, família)" : "kits, cross-sell e upsell";
  const model = "google/gemini-2.5-flash";

  const system = `Você é um consultor sênior brasileiro em ${domain}. Retorne SOMENTE JSON válido no formato exato pedido, em PT-BR.`;

  const user = `Analise "${payload.establishment_name}" e retorne o JSON:
{
  "overall_score": 0-100,
  "scores": {
    "images": 0-100, "descriptions": 0-100, "organization": 0-100,
    "product_info": 0-100, "conversion": 0-100, "combos": 0-100, "experience": 0-100
  },
  "findings": [
    {
      "key": "único_e_estável",
      "type": "missing_image|missing_desc|short_desc|missing_price|typo|empty_category|wrong_category|unavailable_shown|missing_combos|low_conversion|duplicated|other",
      "priority": "low|medium|high|critical",
      "title": "resumo curto",
      "target_type": "item|category|menu",
      "target_id": "UUID real ou null",
      "target_label": "nome do item/categoria",
      "problem": "1-2 frases",
      "recommendation": "1-2 frases práticas",
      "suggested_payload": "sugestão pronta em texto para descrições, senão null"
    }
  ]
}

REGRAS:
- Máximo 25 findings, priorize impacto.
- overall_score = média ponderada das 7 subnotas.
- Verifique: sem imagem, sem descrição, sem preço, descrição <30 chars, erros de português, categorias vazias, itens em categoria errada, indisponíveis exibidos, falta de ${combosLabel}, itens com muitas views e poucos clicks, duplicados.
- Nunca invente ingredientes/alergênicos.

Dados:
${JSON.stringify(payload).slice(0, 28000)}`;

  const json = await callGateway({
    model,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 4000,
  });

  const content = json?.choices?.[0]?.message?.content ?? "{}";
  const tokens = json?.usage?.total_tokens ?? 0;

  let parsed: AnalysisResult;
  try {
    parsed = extractJson(content) as AnalysisResult;
  } catch {
    parsed = { overall_score: 0, scores: { images: 0, descriptions: 0, organization: 0, product_info: 0, conversion: 0, combos: 0, experience: 0 }, findings: [] };
  }
  parsed.findings = (parsed.findings ?? []).slice(0, 40);
  return { result: parsed, tokens, model };
}

// ---------------- IMPORT ----------------

export type ImportResult = {
  categories: Array<{
    name: string;
    items: Array<{
      name: string;
      description: string | null;
      price: number | null;
      sizes: string[] | null;
      addons: string[] | null;
    }>;
  }>;
};

export async function runImport(
  surface: Surface,
  file: { base64: string; mime: string },
): Promise<{ result: ImportResult; tokens: number; model: string }> {
  const model = "google/gemini-2.5-flash";
  const isMenu = surface === "menu";

  const dataUrl = `data:${file.mime};base64,${file.base64}`;
  const contentBlock: any = file.mime.startsWith("image/")
    ? { type: "image_url", image_url: { url: dataUrl } }
    : { type: "file", file: { filename: "input.pdf", file_data: dataUrl } };

  const instruction = `Extraia o ${isMenu ? "cardápio" : "catálogo"} da imagem/PDF em PT-BR.
Retorne SOMENTE JSON no formato:
{
  "categories": [
    {
      "name": "...",
      "items": [
        { "name": "...", "description": "..." | null, "price": 12.90 | null, "sizes": ["..."] | null, "addons": ["..."] | null }
      ]
    }
  ]
}
price em número (BRL, ponto decimal). Extraia todas as categorias e itens que conseguir identificar.`;

  const json = await callGateway({
    model,
    messages: [{ role: "user", content: [{ type: "text", text: instruction }, contentBlock] }],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 4000,
  });

  const content = json?.choices?.[0]?.message?.content ?? "{}";
  const tokens = json?.usage?.total_tokens ?? 0;
  let parsed: ImportResult;
  try {
    parsed = extractJson(content) as ImportResult;
  } catch {
    parsed = { categories: [] };
  }
  return { result: parsed, tokens, model };
}

// ---------------- DESCRIBE ----------------

const MODE_GUIDE: Record<Surface, Record<string, string>> = {
  menu: {
    create: "Crie uma descrição apetitosa original.",
    improve: "Melhore a descrição atual mantendo o tom.",
    fix: "Corrija erros de português mantendo o conteúdo.",
    shorten: "Resuma em uma única frase curta (máx. 90 caracteres).",
    appetizing: "Reescreva com apelo apetitoso, sensorial e delicioso.",
    premium: "Reescreva com tom sofisticado e premium.",
    delivery: "Versão curta e direta ideal para apps de delivery (máx. 120 chars).",
  },
  catalog: {
    create: "Crie uma descrição informativa que destaque benefícios.",
    improve: "Melhore a descrição atual mantendo o tom.",
    fix: "Corrija erros de português mantendo o conteúdo.",
    shorten: "Resuma em uma única frase curta (máx. 90 caracteres).",
    appetizing: "Reescreva destacando benefícios de forma atrativa.",
    premium: "Reescreva com tom sofisticado e premium.",
    delivery: "Versão curta e direta ideal para marketplaces (máx. 120 chars).",
  },
};

export async function runDescribe(
  surface: Surface,
  input: { itemName: string; currentDescription: string | null; mode: string },
): Promise<{ before: string; after: string; tokens: number; model: string }> {
  const model = "google/gemini-2.5-flash";
  const isMenu = surface === "menu";
  const guide = MODE_GUIDE[surface][input.mode] ?? MODE_GUIDE[surface].improve;

  const prompt = `Copywriter em PT-BR para ${isMenu ? "restaurantes" : "lojas online"}.
Produto: "${input.itemName}"
Descrição atual: ${input.currentDescription ? `"${input.currentDescription}"` : "(vazia)"}
Instrução: ${guide}

Responda SOMENTE com a nova descrição, sem prefixos, aspas ou markdown. Máximo 220 caracteres.`;

  const json = await callGateway({
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  });

  const raw: string = json?.choices?.[0]?.message?.content ?? "";
  const tokens = json?.usage?.total_tokens ?? 0;
  const cleaned = raw.trim().replace(/^["'`]|["'`]$/g, "").slice(0, 240);
  return {
    before: input.currentDescription ?? "",
    after: cleaned,
    tokens,
    model,
  };
}

// ---------------- COMBOS ----------------

export type CombosResult = {
  combos: Array<{
    name: string;
    description: string;
    item_ids: string[];
    rationale: string;
  }>;
};

export async function runCombos(
  surface: Surface,
  items: Array<{ id: string; name: string; price: number | null; category_id: string | null }>,
): Promise<{ result: CombosResult; tokens: number; model: string }> {
  const model = "google/gemini-2.5-flash";
  const isMenu = surface === "menu";

  const prompt = `Consultor de ${isMenu ? "restaurantes" : "varejo"} em PT-BR.
Sugira até 8 ${isMenu ? "combos (prato+bebida, individual, dupla, família, sobremesa)" : "kits/bundles (produtos complementares, cross-sell, upsell)"} usando SOMENTE os itens abaixo.
NUNCA sugira preço — o usuário definirá manualmente.
Cada combo deve ter mínimo 2 e máximo 5 item_ids REAIS desta lista.

Itens (${items.length}):
${JSON.stringify(items.slice(0, 60))}

Retorne SOMENTE JSON:
{ "combos": [ { "name": "≤40 chars", "description": "≤120 chars", "item_ids": ["uuid",...], "rationale": "≤120 chars" } ] }`;

  const json = await callGateway({
    model,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.6,
    max_tokens: 2000,
  });
  const content = json?.choices?.[0]?.message?.content ?? "{}";
  const tokens = json?.usage?.total_tokens ?? 0;

  let parsed: CombosResult;
  try {
    parsed = extractJson(content) as CombosResult;
  } catch {
    parsed = { combos: [] };
  }
  const idSet = new Set(items.map(i => i.id));
  parsed.combos = (parsed.combos ?? []).filter(c => Array.isArray(c.item_ids) && c.item_ids.every(id => idSet.has(id)));
  return { result: parsed, tokens, model };
}
