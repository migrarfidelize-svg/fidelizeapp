import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const mediaSchema = z.object({
  path: z.string().min(1).max(500),
  type: z.enum(["image", "video"]),
});

const linkSchema = z.object({
  label: z.string().trim().min(1).max(40),
  url: z.string().trim().url().max(500),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  establishment_id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(2000).nullable().optional(),
  media: z.array(mediaSchema).max(5).default([]),
  external_links: z.array(linkSchema).max(10).default([]),
  active: z.boolean().default(true),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  ends_at: z.string().datetime({ offset: true }).nullable().optional(),
});

const SIGN_TTL = 60 * 60 * 24 * 7; // 7 dias

type Media = { path: string; type: "image" | "video"; url?: string | null };

async function signMediaWith(
  storage: { createSignedUrls: (paths: string[], ttl: number) => Promise<{ data: Array<{ signedUrl: string | null }> | null }> },
  media: Media[] | null | undefined,
): Promise<Media[]> {
  const list = Array.isArray(media) ? media : [];
  const paths = list.map((m) => m.path).filter(Boolean);
  if (paths.length === 0) return list.map((m) => ({ ...m, url: null }));
  const { data } = await storage.createSignedUrls(paths, SIGN_TTL);
  return list.map((m, i) => ({ ...m, url: data?.[i]?.signedUrl ?? null }));
}

// ---------- Merchant CRUD ----------

export const listMyPromotions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("promotions")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const storage = supabase.storage.from("promotions");
    const out = await Promise.all(
      (rows ?? []).map(async (r) => ({
        ...r,
        media: await signMediaWith(storage, r.media as unknown as Media[]),
      })),
    );
    return out;
  });

export const upsertPromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      establishment_id: data.establishment_id,
      title: data.title,
      body: data.body ?? null,
      media: data.media,
      external_links: data.external_links,
      active: data.active,
      starts_at: data.starts_at ?? null,
      ends_at: data.ends_at ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("promotions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("promotions")
      .insert({ ...payload, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await context.supabase
      .from("promotions")
      .select("media")
      .eq("id", data.id)
      .single();
    const paths = (((p?.media as unknown as Media[]) ?? []) as Media[])
      .map((m) => m.path)
      .filter(Boolean);
    const { error } = await context.supabase.from("promotions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (paths.length > 0) {
      try {
        await context.supabase.storage.from("promotions").remove(paths);
      } catch {
        /* best-effort cleanup */
      }
    }
    return { ok: true };
  });

// ---------- Global external links (per establishment) ----------

export const getEstablishmentLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: e, error } = await context.supabase
      .from("establishments")
      .select("external_links")
      .eq("id", data.establishment_id)
      .single();
    if (error) throw new Error(error.message);
    return ((e?.external_links as unknown as { label: string; url: string }[]) ?? []);
  });

export const updateEstablishmentLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        external_links: z.array(linkSchema).max(10),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("establishments")
      .update({ external_links: data.external_links })
      .eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Public read (customer wallet + public establishment page) ----------

export const listPublicPromotionsBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    type PublicPromo = {
      id: string;
      title: string;
      body: string | null;
      media: Media[];
      external_links: { label: string; url: string }[];
      starts_at: string | null;
      ends_at: string | null;
      created_at: string;
    };
    type PublicEst = {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      primary_color: string;
      accent_color: string;
      external_links: { label: string; url: string }[];
      description: string | null;
      address: string | null;
      city: string | null;
      phone: string | null;
      whatsapp: string | null;
      instagram: string | null;
      website: string | null;
      business_hours: string | null;
    };
    type PublicCampaign = {
      id: string;
      name: string;
      stamps_required: number;
      reward_title: string;
      reward_description: string | null;
      rules: string | null;
      stamp_icon: string;
      primary_color: string | null;
      accent_color: string | null;
      stamp_validity_days: number | null;
      reward_validity_days: number | null;
    };
    const empty: { establishment: PublicEst | null; promotions: PublicPromo[]; campaigns: PublicCampaign[]; has_menu: boolean } = {
      establishment: null,
      promotions: [],
      campaigns: [],
      has_menu: false,
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: est } = await supabaseAdmin
      .from("establishments")
      .select("id, name, slug, logo_url, primary_color, accent_color, external_links, active, description, address, city, phone, whatsapp, instagram, website, business_hours")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!est || !est.active) return empty;
    const nowIso = new Date().toISOString();
    const [{ data: rows, error }, { data: camps }] = await Promise.all([
      supabaseAdmin
        .from("promotions")
        .select("id, title, body, media, external_links, starts_at, ends_at, created_at")
        .eq("establishment_id", est.id)
        .eq("active", true)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("campaigns")
        .select("id, name, stamps_required, reward_title, reward_description, rules, stamp_icon, primary_color, accent_color, stamp_validity_days, reward_validity_days")
        .eq("establishment_id", est.id)
        .eq("active", true)
        .order("created_at", { ascending: false }),
    ]);
    if (error) throw new Error(error.message);
    const storage = supabaseAdmin.storage.from("promotions");
    const promotions: PublicPromo[] = await Promise.all(
      (rows ?? []).map(async (r) => ({
        id: r.id as string,
        title: r.title as string,
        body: (r.body as string | null) ?? null,
        media: await signMediaWith(storage, r.media as unknown as Media[]),
        external_links: (r.external_links as unknown as { label: string; url: string }[]) ?? [],
        starts_at: (r.starts_at as string | null) ?? null,
        ends_at: (r.ends_at as string | null) ?? null,
        created_at: r.created_at as string,
      })),
    );
    const campaigns: PublicCampaign[] = (camps ?? []).map((c) => ({
      id: c.id as string,
      name: c.name as string,
      stamps_required: c.stamps_required as number,
      reward_title: c.reward_title as string,
      reward_description: (c.reward_description as string | null) ?? null,
      rules: (c.rules as string | null) ?? null,
      stamp_icon: (c.stamp_icon as string) ?? "star",
      primary_color: (c.primary_color as string | null) ?? null,
      accent_color: (c.accent_color as string | null) ?? null,
      stamp_validity_days: (c.stamp_validity_days as number | null) ?? null,
      reward_validity_days: (c.reward_validity_days as number | null) ?? null,
    }));
    // Vitrine digital: só expomos o atalho quando o plano libera e o cardápio está publicado.
    const { isMenuDestinationValid } = await import("@/lib/qr-target.server");
    const hasMenu = await isMenuDestinationValid(supabaseAdmin, est.id as string);
    return {
      has_menu: hasMenu,
      establishment: {
        id: est.id,
        name: est.name,
        slug: est.slug,
        logo_url: est.logo_url as string | null,
        primary_color: (est.primary_color as string) ?? "#5B21B6",
        accent_color: (est.accent_color as string) ?? "#F97066",
        external_links: (est.external_links as unknown as { label: string; url: string }[]) ?? [],
        description: (est.description as string | null) ?? null,
        address: (est.address as string | null) ?? null,
        city: (est.city as string | null) ?? null,
        phone: (est.phone as string | null) ?? null,
        whatsapp: (est.whatsapp as string | null) ?? null,
        instagram: (est.instagram as string | null) ?? null,
        website: (est.website as string | null) ?? null,
        business_hours: (est.business_hours as string | null) ?? null,
      },
      promotions,
      campaigns,
    };
  });
