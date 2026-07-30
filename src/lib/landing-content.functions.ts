import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeBrands, normalizeHero, type LandingBrandsContent, type LandingHeroContent } from "@/lib/landing-content";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicPlan = {
  slug: string;
  name: string;
  price_monthly: number | null;
  description: string | null;
  display_order: number;
  is_featured: boolean;
  button_text: string | null;
};

/** Conteúdo público da landing: mockup, marcas e preços dos planos (fonte: banco). */
export const getLandingPublic = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = publicClient();
  const [{ data: content }, { data: plans }] = await Promise.all([
    supabase.from("landing_content").select("key, data").in("key", ["hero", "brands"]),
    supabase
      .from("plans")
      .select("slug, name, price_monthly, description, display_order, is_featured, button_text")
      .eq("is_active", true)
      .is("archived_at", null)
      .order("display_order", { ascending: true }),
  ]);

  const map = new Map((content ?? []).map((r: any) => [r.key, r.data]));
  return {
    hero: normalizeHero(map.get("hero")),
    brands: normalizeBrands(map.get("brands")),
    plans: (plans ?? []) as PublicPlan[],
  };
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles").select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}

export const saveLandingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hero?: LandingHeroContent; brands?: LandingBrandsContent }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const rows: Array<{ key: string; data: any; updated_by: string }> = [];
    if (data.hero) rows.push({ key: "hero", data: normalizeHero(data.hero), updated_by: context.userId });
    if (data.brands) rows.push({ key: "brands", data: normalizeBrands(data.brands), updated_by: context.userId });
    if (!rows.length) return { ok: true };
    const { error } = await context.supabase.from("landing_content").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
