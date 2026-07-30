import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

/* ------------------------------------------------------------------ *
 * Telemetria — alimenta o painel de monitoramento em tempo real.
 * ------------------------------------------------------------------ */

const clip = (v: unknown, max: number) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

const logSchema = z.object({
  event_name: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_.-]+$/),
  pixel_id: z.string().trim().max(20).optional().nullable(),
  path: z.string().trim().max(300).optional().nullable(),
  referrer: z.string().trim().max(300).optional().nullable(),
  session_hash: z.string().trim().max(40).optional().nullable(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional().nullable(),
  props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().nullable(),
});

/**
 * Registra um evento disparado pelo Pixel nas páginas públicas.
 * Endpoint público por natureza (roda no site aberto) — por isso valida tudo,
 * limita tamanhos e nunca grava dados pessoais.
 */
export const logPixelEvent = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => logSchema.parse(raw))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const props = data.props ?? {};
      const entries = Object.entries(props).slice(0, 12);
      await (supabaseAdmin as any).from("pixel_events").insert({
        event_name: data.event_name,
        pixel_id: data.pixel_id && META_PIXEL_ID_RE.test(data.pixel_id) ? data.pixel_id : null,
        path: clip(data.path, 300),
        referrer: clip(data.referrer, 300),
        session_hash: clip(data.session_hash, 40),
        device: data.device ?? null,
        source: "browser",
        props: Object.fromEntries(entries.map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 120) : v])),
      });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export type PixelAnalytics = {
  configured: boolean;
  pixelId: string | null;
  enabled: boolean;
  trackingPublic: boolean;
  totals: { last5m: number; lastHour: number; last24h: number; last7d: number };
  sessions24h: number;
  byEvent: { name: string; count: number }[];
  byPath: { path: string; count: number }[];
  byDevice: { device: string; count: number }[];
  timeline: { bucket: string; count: number }[];
  recent: {
    id: string;
    event_name: string;
    path: string | null;
    device: string | null;
    session_hash: string | null;
    created_at: string;
  }[];
};

/** Agregados do painel (somente super admin). */
export const getPixelAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PixelAnalytics> => {
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("is_super_admin", { _user: context.userId });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Acesso restrito: apenas administradores da plataforma.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: integration } = await (supabaseAdmin as any)
      .from("integrations")
      .select("enabled, config")
      .eq("category", "marketing")
      .eq("provider", "meta_pixel")
      .maybeSingle();

    const config = (integration?.config ?? {}) as Record<string, unknown>;
    const pixelId = String(config.pixel_id ?? "").trim() || null;

    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data: rows } = await (supabaseAdmin as any)
      .from("pixel_events")
      .select("id, event_name, path, device, session_hash, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    const list: PixelAnalytics["recent"] = rows ?? [];
    const now = Date.now();
    const within = (ms: number) => list.filter((r) => now - new Date(r.created_at).getTime() <= ms).length;

    const count = <T extends string>(key: (r: (typeof list)[number]) => T | null) => {
      const map = new Map<string, number>();
      for (const r of list) {
        const k = key(r);
        if (!k) continue;
        map.set(k, (map.get(k) ?? 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    };

    const day = list.filter((r) => now - new Date(r.created_at).getTime() <= 24 * 3600_000);
    const buckets = new Map<string, number>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now - i * 3600_000);
      buckets.set(`${String(d.getUTCHours()).padStart(2, "0")}h`, 0);
    }
    for (const r of day) {
      const d = new Date(r.created_at);
      const k = `${String(d.getUTCHours()).padStart(2, "0")}h`;
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
    }

    return {
      configured: Boolean(pixelId),
      pixelId,
      enabled: Boolean(integration?.enabled),
      trackingPublic: String(config.track_public_pages ?? "1") !== "0",
      totals: {
        last5m: within(5 * 60_000),
        lastHour: within(3600_000),
        last24h: day.length,
        last7d: list.length,
      },
      sessions24h: new Set(day.map((r) => r.session_hash).filter(Boolean)).size,
      byEvent: count((r) => r.event_name).slice(0, 8).map(([name, c]) => ({ name, count: c })),
      byPath: count((r) => r.path).slice(0, 8).map(([path, c]) => ({ path, count: c })),
      byDevice: count((r) => r.device).map(([device, c]) => ({ device, count: c })),
      timeline: [...buckets.entries()].map(([bucket, c]) => ({ bucket, count: c })),
      recent: list.slice(0, 40),
    };
  });
