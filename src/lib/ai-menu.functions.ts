import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  runAnalysis,
  runImport,
  runDescribe,
  runCombos,
  itemHash,
  surfaceKey,
  surfacePermission,
  MONTHLY_QUOTAS,
  type Surface,
} from "./ai-menu.server";

const surfaceEnum = z.enum(["menu", "catalog"]);

async function assertAiAccess(
  supabase: any,
  userId: string,
  establishmentId: string,
  surface: Surface,
) {
  const { data: allowed } = await supabase.rpc("has_plan_feature", {
    _est: establishmentId,
    _feature: surfaceKey(surface),
  });
  if (!allowed) {
    throw new Error(
      `Recurso não disponível no seu plano atual. Faça upgrade para desbloquear a Inteligência de ${surface === "menu" ? "Cardápio" : "Catálogo"} com IA.`,
    );
  }

  const { data: can } = await supabase.rpc("member_can", {
    _user: userId,
    _est: establishmentId,
    _action: surfacePermission(surface),
  });
  if (!can) throw new Error("Você não tem permissão para usar a IA neste estabelecimento.");

  const { data: est } = await supabase
    .from("establishments")
    .select("plan")
    .eq("id", establishmentId)
    .maybeSingle();
  const tier = (est?.plan ?? "free") as string;
  const quota = MONTHLY_QUOTAS[tier]?.[surface] ?? 0;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count: used } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", establishmentId)
    .eq("surface", surface)
    .gte("created_at", monthStart.toISOString());

  if ((used ?? 0) >= quota) {
    throw new Error(`Cota mensal esgotada (${used}/${quota}). Faça upgrade do plano ou aguarde o próximo mês.`);
  }

  return { tier, quota, used: used ?? 0 };
}

async function logUsage(
  supabase: any,
  userId: string,
  establishmentId: string,
  surface: Surface,
  kind: "analysis" | "import" | "describe" | "combo" | "image",
  tokens: number,
) {
  await supabase.from("ai_usage").insert({
    establishment_id: establishmentId,
    surface,
    kind,
    units: 1,
    tokens,
    actor_id: userId,
  });
}

/** Análise geral do cardápio/catálogo. */
export const analyzeShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string; surface: "menu" | "catalog" }) =>
    z.object({ establishment_id: z.string().uuid(), surface: surfaceEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAiAccess(supabase, userId, data.establishment_id, data.surface);

    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count: recent } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", data.establishment_id)
      .eq("surface", data.surface)
      .eq("kind", "analysis")
      .gte("created_at", oneMinAgo);
    if ((recent ?? 0) > 0) {
      throw new Error("Aguarde 60 segundos entre análises.");
    }

    const { data: menu } = await supabase
      .from("restaurant_menus")
      .select("id, establishment_id")
      .eq("establishment_id", data.establishment_id)
      .eq("kind", data.surface)
      .maybeSingle();
    if (!menu) throw new Error("Vitrine ainda não configurada.");

    const { data: est } = await supabase
      .from("establishments")
      .select("name")
      .eq("id", data.establishment_id)
      .maybeSingle();

    const { data: cats } = await supabase
      .from("menu_categories")
      .select("id, name")
      .eq("menu_id", menu.id)
      .order("position");

    const { data: itemsRaw } = await supabase
      .from("menu_items")
      .select("id, name, short_desc, long_desc, price, image_url, category_id, active")
      .eq("menu_id", menu.id)
      .order("position");
    const items = itemsRaw ?? [];

    const catCounts = new Map<string, number>();
    items.forEach((it: any) => {
      if (it.category_id) catCounts.set(it.category_id, (catCounts.get(it.category_id) ?? 0) + 1);
    });

    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const { data: events } = await supabase
      .from("channel_events")
      .select("subject_id, event")
      .eq("establishment_id", data.establishment_id)
      .in("channel", ["menu", "catalog"])
      .gte("created_at", since)
      .limit(5000);

    const views = new Map<string, number>();
    const clicks = new Map<string, number>();
    (events ?? []).forEach((e: any) => {
      const m = e.event === "click" ? clicks : views;
      if (e.subject_id) m.set(e.subject_id, (m.get(e.subject_id) ?? 0) + 1);
    });

    const payload = {
      establishment_name: est?.name ?? "",
      categories: (cats ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        item_count: catCounts.get(c.id) ?? 0,
      })),
      items: items.slice(0, 80).map((it: any) => ({
        id: it.id,
        name: it.name,
        description: it.short_desc ?? it.long_desc ?? null,
        price: it.price != null ? Number(it.price) : null,
        image_url: it.image_url,
        category_id: it.category_id,
        is_available: !!it.active,
        views_30d: views.get(it.id) ?? 0,
        clicks_30d: clicks.get(it.id) ?? 0,
      })),
    };

    const { result, tokens, model } = await runAnalysis(data.surface, payload);

    const { data: saved, error } = await supabase
      .from("ai_analyses")
      .insert({
        establishment_id: data.establishment_id,
        surface: data.surface,
        target_id: menu.id,
        overall_score: Math.round(result.overall_score ?? 0),
        scores_json: result.scores ?? {},
        findings_json: result.findings ?? [],
        tokens_used: tokens,
        model,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    const findings = result.findings ?? [];
    if (findings.length > 0) {
      const rows = findings.map((f) => ({
        analysis_id: saved.id,
        establishment_id: data.establishment_id,
        finding_key: f.key,
        target_type: f.target_type,
        target_id: f.target_id,
        status: "open",
      }));
      await supabase.from("ai_findings_state").insert(rows as any);
    }

    // Cache hash em cada item analisado
    for (const it of items.slice(0, 80)) {
      const hash = itemHash({
        name: it.name,
        description: it.short_desc ?? it.long_desc,
        price: it.price,
        image_url: it.image_url,
      });
      await supabase
        .from("menu_items")
        .update({ ai_hash: hash, ai_analyzed_at: new Date().toISOString() } as any)
        .eq("id", it.id);
    }

    await logUsage(supabase, userId, data.establishment_id, data.surface, "analysis", tokens);
    return { analysis_id: saved.id, ...result };
  });

/** Última análise (sem consumir cota). */
export const getLatestAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string; surface: "menu" | "catalog" }) =>
    z.object({ establishment_id: z.string().uuid(), surface: surfaceEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: last } = await supabase
      .from("ai_analyses")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .eq("surface", data.surface)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last) return null;

    const { data: states } = await supabase
      .from("ai_findings_state")
      .select("finding_key, status")
      .eq("analysis_id", last.id);

    const stateMap: Record<string, string> = {};
    (states ?? []).forEach((s: any) => { stateMap[s.finding_key] = s.status; });

    return { ...last, finding_states: stateMap };
  });

export const updateFindingState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    analysis_id: string;
    finding_key: string;
    status: "applied" | "ignored" | "edited";
    applied_payload?: unknown;
  }) => z.object({
    analysis_id: z.string().uuid(),
    finding_key: z.string(),
    status: z.enum(["applied", "ignored", "edited"]),
    applied_payload: z.any().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: analysis } = await supabase
      .from("ai_analyses")
      .select("establishment_id")
      .eq("id", data.analysis_id)
      .maybeSingle();
    if (!analysis) throw new Error("Análise não encontrada.");

    const { error } = await supabase
      .from("ai_findings_state")
      .upsert({
        analysis_id: data.analysis_id,
        establishment_id: analysis.establishment_id,
        finding_key: data.finding_key,
        status: data.status,
        applied_payload: (data.applied_payload ?? null) as any,
        actor_id: userId,
      } as any, { onConflict: "analysis_id,finding_key" });

    if (error) throw error;
    return { ok: true };
  });

/** Gera nova descrição para um item. */
export const improveItemDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    establishment_id: string;
    item_id: string;
    surface: "menu" | "catalog";
    mode: "create" | "improve" | "fix" | "shorten" | "appetizing" | "premium" | "delivery";
  }) => z.object({
    establishment_id: z.string().uuid(),
    item_id: z.string().uuid(),
    surface: surfaceEnum,
    mode: z.enum(["create","improve","fix","shorten","appetizing","premium","delivery"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAiAccess(supabase, userId, data.establishment_id, data.surface);

    const { data: item } = await supabase
      .from("menu_items")
      .select("id, name, short_desc, long_desc, establishment_id")
      .eq("id", data.item_id)
      .maybeSingle();
    if (!item || item.establishment_id !== data.establishment_id) {
      throw new Error("Item não encontrado.");
    }

    const currentDesc = (item.short_desc as string | null) ?? (item.long_desc as string | null);
    const { before, after, tokens } = await runDescribe(data.surface, {
      itemName: item.name as string,
      currentDescription: currentDesc,
      mode: data.mode,
    });

    await logUsage(supabase, userId, data.establishment_id, data.surface, "describe", tokens);
    return { before, after };
  });

/** Aplica descrição escolhida (grava em short_desc). */
export const applyItemDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: string; description: string }) =>
    z.object({ item_id: z.string().uuid(), description: z.string().max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("menu_items")
      .update({ short_desc: data.description, ai_hash: null, ai_analyzed_at: null } as any)
      .eq("id", data.item_id);
    if (error) throw error;
    return { ok: true };
  });

/** Importa cardápio a partir de imagem/PDF — devolve árvore para revisão. */
export const importShowcaseFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    establishment_id: string;
    surface: "menu" | "catalog";
    file_base64: string;
    mime: string;
  }) => z.object({
    establishment_id: z.string().uuid(),
    surface: surfaceEnum,
    file_base64: z.string().min(100),
    mime: z.string().regex(/^(image\/(jpeg|png|webp)|application\/pdf)$/),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAiAccess(supabase, userId, data.establishment_id, data.surface);

    const { result, tokens } = await runImport(data.surface, {
      base64: data.file_base64,
      mime: data.mime,
    });

    await logUsage(supabase, userId, data.establishment_id, data.surface, "import", tokens);
    return result;
  });

/** Cria categorias e itens revisados pelo usuário. */
export const confirmImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    establishment_id: string;
    surface: "menu" | "catalog";
    categories: Array<{
      name: string;
      items: Array<{ name: string; description: string | null; price: number | null }>;
    }>;
  }) => z.object({
    establishment_id: z.string().uuid(),
    surface: surfaceEnum,
    categories: z.array(z.object({
      name: z.string().min(1),
      items: z.array(z.object({
        name: z.string().min(1),
        description: z.string().nullable(),
        price: z.number().nullable(),
      })),
    })),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: menu } = await supabase
      .from("restaurant_menus")
      .select("id")
      .eq("establishment_id", data.establishment_id)
      .eq("kind", data.surface)
      .maybeSingle();
    if (!menu) throw new Error("Vitrine ainda não configurada.");

    const { count: catStart } = await supabase
      .from("menu_categories")
      .select("id", { count: "exact", head: true })
      .eq("menu_id", menu.id);

    let catPos = catStart ?? 0;
    let categoriesCreated = 0;
    let itemsCreated = 0;

    for (const cat of data.categories) {
      const { data: newCat, error: catErr } = await supabase
        .from("menu_categories")
        .insert({
          menu_id: menu.id,
          establishment_id: data.establishment_id,
          name: cat.name,
          position: catPos++,
        } as any)
        .select()
        .single();
      if (catErr || !newCat) continue;
      categoriesCreated++;

      let itemPos = 0;
      for (const it of cat.items) {
        const { error: itErr } = await supabase.from("menu_items").insert({
          menu_id: menu.id,
          establishment_id: data.establishment_id,
          category_id: (newCat as any).id,
          name: it.name,
          short_desc: it.description,
          price: it.price,
          position: itemPos++,
          active: true,
        } as any);
        if (!itErr) itemsCreated++;
      }
    }

    return { categoriesCreated, itemsCreated };
  });

/** Sugere combos/bundles. */
export const suggestCombos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string; surface: "menu" | "catalog" }) =>
    z.object({ establishment_id: z.string().uuid(), surface: surfaceEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAiAccess(supabase, userId, data.establishment_id, data.surface);

    const { data: menu } = await supabase
      .from("restaurant_menus")
      .select("id")
      .eq("establishment_id", data.establishment_id)
      .eq("kind", data.surface)
      .maybeSingle();
    if (!menu) throw new Error("Vitrine ainda não configurada.");

    const { data: items } = await supabase
      .from("menu_items")
      .select("id, name, price, category_id")
      .eq("menu_id", menu.id)
      .eq("active", true)
      .limit(60);

    const mapped = ((items ?? []) as any[]).map(i => ({
      id: i.id as string,
      name: i.name as string,
      price: i.price != null ? Number(i.price) : null,
      category_id: (i.category_id as string) ?? null,
    }));

    const { result, tokens } = await runCombos(data.surface, mapped);
    await logUsage(supabase, userId, data.establishment_id, data.surface, "combo", tokens);
    return result;
  });

export const getAiUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string; surface: "menu" | "catalog" }) =>
    z.object({ establishment_id: z.string().uuid(), surface: surfaceEnum }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est } = await supabase
      .from("establishments")
      .select("plan")
      .eq("id", data.establishment_id)
      .maybeSingle();
    const tier = (est?.plan ?? "free") as string;
    const quota = MONTHLY_QUOTAS[tier]?.[data.surface] ?? 0;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count: used } = await supabase
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", data.establishment_id)
      .eq("surface", data.surface)
      .gte("created_at", monthStart.toISOString());

    return { tier, quota, used: used ?? 0 };
  });
