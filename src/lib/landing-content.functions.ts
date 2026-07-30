import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeBrands, normalizeHero, type LandingBrandsContent, type LandingHeroContent } from "@/lib/landing-content";
export type { PublicPlan } from "@/lib/landing-content.server";

/** Conteúdo público da landing: mockup, marcas e preços dos planos (fonte: banco). */
export const getLandingPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { loadLandingPublic } = await import("@/lib/landing-content.server");
  return loadLandingPublic();
});

export const saveLandingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hero?: LandingHeroContent; brands?: LandingBrandsContent }) => input)
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const rows: Array<{ key: string; data: any; updated_by: string }> = [];
    if (data.hero) rows.push({ key: "hero", data: normalizeHero(data.hero), updated_by: context.userId });
    if (data.brands) rows.push({ key: "brands", data: normalizeBrands(data.brands), updated_by: context.userId });
    if (!rows.length) return { ok: true };
    const { error } = await context.supabase.from("landing_content").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
