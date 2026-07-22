import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const LinkKind = z.enum([
  "whatsapp", "instagram", "facebook", "tiktok", "youtube",
  "site", "google", "maps", "email", "phone", "wifi", "pix", "custom",
]);


const LinkInput = z.object({
  id: z.string().uuid().optional(),
  kind: LinkKind,
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(500),
  icon: z.string().trim().max(40).nullable().optional(),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().nonnegative(),
});

const ThemeInput = z.object({
  primary: z.string().max(20).optional(),
  accent: z.string().max(20).optional(),
  background: z.string().max(20).optional(),
  text: z.string().max(20).optional(),
  button_style: z.enum(["solid", "outline", "glass"]).optional(),
  rounded: z.enum(["sm", "md", "lg", "xl", "full"]).optional(),
}).partial();

const SocialInput = z.object({
  instagram: z.string().max(120).optional().nullable(),
  facebook: z.string().max(200).optional().nullable(),
  tiktok: z.string().max(120).optional().nullable(),
  youtube: z.string().max(200).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  site: z.string().max(200).optional().nullable(),
  google: z.string().max(300).optional().nullable(),
  maps: z.string().max(300).optional().nullable(),
}).partial();

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

// ---------- Merchant: get my linktree page ----------
export const getMyLinkTree = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string }) =>
    z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: page } = await context.supabase
      .from("link_tree_pages")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!page) return { page: null, links: [] as any[] };
    const { data: links } = await context.supabase
      .from("link_tree_links")
      .select("*")
      .eq("page_id", page.id)
      .order("sort_order", { ascending: true });
    return { page, links: links ?? [] };
  });

// ---------- Merchant: upsert page + replace links ----------
export const upsertLinkTree = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    title: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    // Aceita URLs longas e data-URLs base64 do recorte de logo.
    logo_url: z.string().trim().max(2_500_000).nullable().optional(),
    cover_url: z.string().trim().max(2_500_000).nullable().optional(),
    theme: ThemeInput.default({}),
    social: SocialInput.default({}),
    links: z.array(LinkInput).max(50),
    published: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Database["public"]["Tables"]["link_tree_pages"]["Insert"] = {
      establishment_id: data.establishment_id,
      title: data.title ?? null,
      description: data.description ?? null,
      logo_url: data.logo_url ?? null,
      cover_url: data.cover_url ?? null,
      theme: data.theme,
      social: data.social,
    };
    if (typeof data.published === "boolean") {
      patch.published = data.published;
      if (data.published) patch.published_at = new Date().toISOString();
    }
    const { data: page, error } = await context.supabase
      .from("link_tree_pages")
      .upsert(patch, { onConflict: "establishment_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);


    // Replace links: delete all then insert
    await context.supabase.from("link_tree_links").delete().eq("page_id", page.id);
    if (data.links.length > 0) {
      const rows = data.links.map((l, i) => ({
        page_id: page.id,
        kind: l.kind,
        label: l.label,
        url: l.url,
        icon: l.icon ?? null,
        enabled: l.enabled,
        sort_order: l.sort_order ?? i,
      }));
      const { error: e2 } = await context.supabase.from("link_tree_links").insert(rows);
      if (e2) throw new Error(e2.message);
    }
    return { ok: true, page_id: page.id, published: page.published };
  });

// ---------- Merchant: set QR destination on the establishment ----------
export const setQrDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    destination: z.enum(["reviews", "linktree", "landing"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("establishments")
      .update({ qr_destination: data.destination })
      .eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getQrDestinationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { establishment_id: string }) =>
    z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: est } = await context.supabase
      .from("establishments")
      .select("qr_destination, slug")
      .eq("id", data.establishment_id)
      .maybeSingle();
    const { data: page } = await context.supabase
      .from("link_tree_pages")
      .select("published")
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    const { data: form } = await context.supabase
      .from("review_forms")
      .select("id")
      .eq("establishment_id", data.establishment_id)
      .eq("active", true)
      .maybeSingle();
    return {
      destination: (est?.qr_destination ?? "reviews") as "reviews" | "linktree" | "landing",
      linktree_published: !!page?.published,
      review_form_active: !!form,
      slug: est?.slug ?? null,
    };
  });

// ---------- Public: get by slug (only if published) ----------
export const getPublicLinkTreeBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: est } = await s
      .from("establishments")
      .select("id, name, slug, logo_url, cover_url, description, primary_color, accent_color")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!est) return null;
    const { data: page } = await s
      .from("link_tree_pages")
      .select("*")
      .eq("establishment_id", est.id)
      .eq("published", true)
      .maybeSingle();
    if (!page) return { establishment: est, page: null, links: [] as any[] };
    const { data: links } = await s
      .from("link_tree_links")
      .select("*")
      .eq("page_id", page.id)
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return { establishment: est, page, links: links ?? [] };
  });
