import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Módulo Cardápio Virtual — server functions.
 * Todas escopadas ao usuário autenticado; a RLS já impede acesso cruzado
 * entre estabelecimentos. Nenhuma função aqui altera dados de outros módulos.
 */

const estIdSchema = z.object({ establishment_id: z.string().uuid() });

// ------- Visão geral -------
export const getMyMenuOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const estId = data.establishment_id;

    // Garante o registro do cardápio (upsert idempotente na primeira visita).
    let { data: menu } = await supabase
      .from("restaurant_menus")
      .select("*")
      .eq("establishment_id", estId)
      .maybeSingle();

    if (!menu) {
      const { data: created, error } = await supabase
        .from("restaurant_menus")
        .insert({ establishment_id: estId, status: "draft", default_view: "list" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      menu = created;
    }

    const [{ count: categoriesCount }, { count: itemsCount }, { count: videosCount }] = await Promise.all([
      supabase.from("menu_categories").select("id", { count: "exact", head: true }).eq("menu_id", menu.id),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("menu_id", menu.id),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("menu_id", menu.id).not("video_url", "is", null),
    ]);

    // Acessos recentes (canal analytics reaproveitado)
    const { data: recentEvents } = await supabase
      .from("channel_events")
      .select("kind, created_at")
      .eq("establishment_id", estId)
      .eq("channel", "menu")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    return {
      menu,
      counts: {
        categories: categoriesCount ?? 0,
        items: itemsCount ?? 0,
        videos: videosCount ?? 0,
        recent7d: recentEvents?.length ?? 0,
      },
    };
  });

// ------- Publicação -------
export const setMenuStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    status: z.enum(["draft", "published", "paused"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: menu, error } = await supabase
      .from("restaurant_menus")
      .update({ status: data.status })
      .eq("establishment_id", data.establishment_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { menu };
  });
