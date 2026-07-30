import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DISCOVER_CATEGORIES } from "@/lib/discover-categories";

const CREATIVE_TTL = 60 * 30; // 30 min — o card é efêmero na vitrine.
const CATEGORY_IDS = DISCOVER_CATEGORIES.map((c) => c.id) as [string, ...string[]];

/**
 * Converte o identificador anônimo do navegador em um hash estável.
 * Nunca guardamos o valor original — apenas o hash, usado para deduplicar
 * impressões e cliques.
 */
async function hashSession(sessionId: string): Promise<string> {
  const salt = process.env.WALLET_SYNC_SECRET ?? process.env.SUPABASE_URL ?? "fidelize-ads";
  const bytes = new TextEncoder().encode(`${salt}:${sessionId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Anúncios em destaque para a vitrine Descobrir. Somente leitura, sem PII. */
export const getDiscoverySponsoredAds = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        category: z.enum(CATEGORY_IDS).nullable().optional(),
        session_id: z.string().trim().min(8).max(80),
        limit: z.number().int().min(1).max(6).default(3),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sessionHash = await hashSession(data.session_id);

    const { data: rows, error } = await supabaseAdmin.rpc("get_sponsored_ads_for_discovery", {
      _category: data.category ?? "",
      _session_hash: sessionHash,
      _limit: data.limit,
    });
    if (error) return [];

    const storage = supabaseAdmin.storage.from("sponsored-ads");
    return Promise.all(
      (rows ?? []).map(async (r: any) => {
        let image_url: string | null = null;
        if (r.image_source === "upload" && r.image_path) {
          const { data: signed } = await storage.createSignedUrl(r.image_path, CREATIVE_TTL);
          image_url = signed?.signedUrl ?? null;
        } else {
          image_url = r.establishment_logo_url ?? null;
        }
        return {
          campaign_id: r.campaign_id,
          tracking_token: r.tracking_token,
          title: r.title,
          description: r.description,
          cta_label: r.cta_label,
          destination_type: r.destination_type,
          destination_slug: r.destination_slug,
          category_id: r.category_id,
          establishment_name: r.establishment_name,
          establishment_slug: r.establishment_slug,
          establishment_primary_color: r.establishment_primary_color,
          image_url,
        };
      }),
    );
  });

/** Registra impressão/clique de forma deduplicada. Nunca lança para o cliente. */
export const trackSponsoredAdEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().trim().min(8).max(120),
        event_type: z.enum(["impression", "click"]),
        session_id: z.string().trim().min(8).max(80),
        placement: z.string().trim().max(40).default("discover"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sessionHash = await hashSession(data.session_id);
      await supabaseAdmin.rpc("register_sponsored_ad_event", {
        _token: data.token,
        _event_type: data.event_type,
        _session_hash: sessionHash,
        _placement: data.placement,
      });
    } catch {
      /* métrica nunca deve quebrar a navegação do cliente */
    }
    return { ok: true as const };
  });
