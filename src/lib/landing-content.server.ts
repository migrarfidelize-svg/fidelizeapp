import { createClient } from "@supabase/supabase-js";
import { normalizeBrands, normalizeHero, type PublicPlan } from "@/lib/landing-content";
import { DEFAULT_BRAND, normalizeBrand } from "@/lib/brand";
import { DEFAULT_VOICE_SETTINGS, normalizeVoiceSettings } from "@/lib/voice-settings";

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

export async function loadLandingPublic() {
  try {
    const supabase = publicClient();
    const [{ data: content }, { data: plans }] = await Promise.all([
      supabase.from("landing_content").select("key, data").in("key", ["hero", "brands", "brand"]),
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
      brand: normalizeBrand(map.get("brand")),
      plans: (plans ?? []) as PublicPlan[],
    };
  } catch {
    return { hero: normalizeHero(null), brands: normalizeBrands(null), brand: DEFAULT_BRAND, plans: [] as PublicPlan[] };
  }
}

export async function assertPlatformAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles").select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}

/** Somente a identidade visual — consulta enxuta usada pelo componente <Logo />. */
export async function loadBrandIdentity() {
  try {
    const supabase = publicClient();
    const { data } = await supabase.from("landing_content").select("data").eq("key", "brand").maybeSingle();
    return normalizeBrand(data?.data ?? null);
  } catch {
    return DEFAULT_BRAND;
  }
}

/** Configuração global da voz do painel (chave "voice" em landing_content). */
export async function loadVoiceSettings() {
  try {
    const supabase = publicClient();
    const { data } = await supabase.from("landing_content").select("data").eq("key", "voice").maybeSingle();
    return normalizeVoiceSettings(data?.data ?? null);
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}
