import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeBrands, normalizeHero, type LandingBrandsContent, type LandingHeroContent } from "@/lib/landing-content";
import { normalizeBrand, type BrandIdentity } from "@/lib/brand";
import { normalizeVoiceSettings, type VoiceSettings } from "@/lib/voice-settings";


/** Conteúdo público da landing: mockup, marcas e preços dos planos (fonte: banco). */
export const getLandingPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { loadLandingPublic } = await import("@/lib/landing-content.server");
  return loadLandingPublic();
});

/** Identidade visual pública (logo do menu). Leve, chamada por qualquer tela. */
export const getBrandIdentity = createServerFn({ method: "GET" }).handler(async () => {
  const { loadBrandIdentity } = await import("@/lib/landing-content.server");
  return loadBrandIdentity();
});

/** Voz global do painel — leitura pública (aplicada a lojistas e admin). */
export const getVoiceSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { loadVoiceSettings } = await import("@/lib/landing-content.server");
  return loadVoiceSettings();
});

/** Somente Super Admin edita a voz do painel. */
export const saveVoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { voice: VoiceSettings }) => input)
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("landing_content")
      .upsert([{ key: "voice", data: normalizeVoiceSettings(data.voice) as any, updated_by: context.userId }], {
        onConflict: "key",
      });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveLandingContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hero?: LandingHeroContent; brands?: LandingBrandsContent; brand?: BrandIdentity }) => input)
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const rows: Array<{ key: string; data: any; updated_by: string }> = [];
    if (data.hero) rows.push({ key: "hero", data: normalizeHero(data.hero), updated_by: context.userId });
    if (data.brands) rows.push({ key: "brands", data: normalizeBrands(data.brands), updated_by: context.userId });
    if (data.brand) rows.push({ key: "brand", data: normalizeBrand(data.brand), updated_by: context.userId });
    if (!rows.length) return { ok: true };
    const { error } = await context.supabase.from("landing_content").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
