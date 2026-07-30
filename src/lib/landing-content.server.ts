import { createClient } from "@supabase/supabase-js";
import { normalizeBrands, normalizeHero, type PublicPlan } from "@/lib/landing-content";

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
  } catch {
    return { hero: normalizeHero(null), brands: normalizeBrands(null), plans: [] as PublicPlan[] };
  }
}

export async function assertPlatformAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles").select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}
