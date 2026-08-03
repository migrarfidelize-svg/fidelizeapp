import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_DISCOVER_SETTINGS,
  normalizeDiscoverSettings,
  type DiscoverBanner,
  type DiscoverSettings,
} from "@/lib/discover";

const BANNER_COLUMNS =
  "id, title, subtitle, image_url, link_url, bg_color, text_color, cta_label, active, sort_order, starts_at, ends_at, city";

const bannerInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2).max(120),
  subtitle: z.string().max(200).nullable().optional(),
  image_url: z.string().max(1000).nullable().optional(),
  link_url: z.string().max(1000).nullable().optional(),
  bg_color: z.string().max(40).nullable().optional(),
  text_color: z.string().max(40).nullable().optional(),
  cta_label: z.string().max(40).nullable().optional(),
  active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(999).default(0),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  city: z.string().max(120).nullable().optional(),
});

/** Banners ativos do Descobrir (cliente logado). Respeita janela de vigência e cidade. */
export const getDiscoverBanners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { city?: string | null } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("discover_banners")
      .select(BANNER_COLUMNS)
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);

    const now = Date.now();
    const city = (data.city ?? "").trim().toLowerCase();
    return ((rows ?? []) as DiscoverBanner[]).filter((b) => {
      if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
      if (b.ends_at && new Date(b.ends_at).getTime() < now) return false;
      if (b.city && city && b.city.trim().toLowerCase() !== city) return false;
      return true;
    });
  });

/** Configuração pública do Descobrir (raio padrão, opções e rotação de banners). */
export const getDiscoverSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("landing_content")
      .select("data")
      .eq("key", "discover")
      .maybeSingle();
    return data?.data ? normalizeDiscoverSettings(data.data) : DEFAULT_DISCOVER_SETTINGS;
  });

/** Lista completa (inclui inativos) — apenas Super Admin. */
export const listDiscoverBannersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("discover_banners")
      .select(BANNER_COLUMNS)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as DiscoverBanner[];
  });

/** Cria ou atualiza um banner — apenas Super Admin. */
export const saveDiscoverBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bannerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const payload = {
      title: data.title,
      subtitle: data.subtitle ?? null,
      image_url: data.image_url ?? null,
      link_url: data.link_url ?? null,
      bg_color: data.bg_color ?? null,
      text_color: data.text_color ?? null,
      cta_label: data.cta_label ?? null,
      active: data.active,
      sort_order: data.sort_order,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
      city: data.city || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("discover_banners").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("discover_banners")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: created.id };
  });

/** Remove um banner — apenas Super Admin. */
export const deleteDiscoverBanner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("discover_banners").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Salva a configuração do Descobrir — apenas Super Admin. */
export const saveDiscoverSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { settings: DiscoverSettings }) => input)
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/landing-content.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("landing_content").upsert(
      [{ key: "discover", data: normalizeDiscoverSettings(data.settings) as any, updated_by: context.userId }],
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
