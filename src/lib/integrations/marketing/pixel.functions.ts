import { createServerFn } from "@tanstack/react-start";
import { META_PIXEL_ID_RE } from "./meta";

/**
 * Configuração PÚBLICA do Pixel do Meta.
 *
 * Devolve exclusivamente o Pixel ID (que é público por natureza e fica visível
 * no HTML de qualquer site que use o Pixel). O token da Conversions API NUNCA
 * é lido nem retornado aqui.
 */
export const getPublicMetaPixel = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("integrations")
      .select("enabled, config")
      .eq("category", "marketing")
      .eq("provider", "meta_pixel")
      .maybeSingle();

    if (!data?.enabled) return { pixelId: null as string | null };
    const config = (data.config ?? {}) as Record<string, unknown>;
    if (String(config.track_public_pages ?? "1") === "0") return { pixelId: null as string | null };

    const pixelId = String(config.pixel_id ?? "").trim();
    // Barreira anti-injeção: o valor entra num <script>, então só dígitos passam.
    if (!META_PIXEL_ID_RE.test(pixelId)) return { pixelId: null as string | null };
    return { pixelId };
  } catch {
    return { pixelId: null as string | null };
  }
});
