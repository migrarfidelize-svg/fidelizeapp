import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Obtém os estados de publicação dos menus/catálogos do lojista de forma segura.
 * Usado exclusivamente pelo painel administrativo (autenticado).
 */
export const getMyShowcaseStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({
    establishment_id: z.string().uuid()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    
    // Consulta autenticada (RLS normal do lojista)
    const { data: menus, error } = await supabase
      .from("restaurant_menus")
      .select("kind, status")
      .eq("establishment_id", data.establishment_id);
      
    if (error) {
      console.error("[getMyShowcaseStatus] Error:", error);
      throw new Error("Falha ao consultar status das vitrines");
    }

    return {
      has_menu: menus?.some(m => m.kind === "menu" && m.status === "published") ?? false,
      has_catalog: menus?.some(m => m.kind === "catalog" && m.status === "published") ?? false,
      menus: menus ?? []
    };
  });
