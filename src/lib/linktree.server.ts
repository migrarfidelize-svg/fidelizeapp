import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPublicLinkTreeBySlug = async (slug: string) => {
  const normalizedSlug = slug.trim().toLowerCase();

  // 1. Buscar estabelecimento
  const { data: establishment, error: estError } = await supabaseAdmin
    .from("establishments")
    .select("id, slug, name, logo_url, cover_url, primary_color, accent_color, active, description, updated_at")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (estError) throw new Error("DATABASE_ERROR");
  if (!establishment) throw new Error("NOT_FOUND");
  if (!establishment.active) throw new Error("INACTIVE");

  // 2. Buscar landing page (link_tree_pages) publicada
  const { data: page, error: pageError } = await supabaseAdmin
    .from("link_tree_pages")
    .select("*")
    .eq("establishment_id", establishment.id)
    .eq("published", true)
    .maybeSingle();

  if (pageError) throw new Error("DATABASE_ERROR");
  if (!page) throw new Error("UNPUBLISHED");

  // 3. Buscar links
  const { data: links, error: linksError } = await supabaseAdmin
    .from("link_tree_links")
    .select("id, label, url, kind, sort_order, enabled, data")
    .eq("page_id", page.id)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (linksError) throw new Error("DATABASE_ERROR");

  // 4. DTO Seguro
  return {
    establishment: {
      name: establishment.name,
      slug: establishment.slug,
      logo_url: establishment.logo_url,
      cover_url: establishment.cover_url,
      primary_color: establishment.primary_color,
      accent_color: establishment.accent_color,
      description: establishment.description,
      updated_at: establishment.updated_at,
    },
    page: {
      id: page.id,
      title: page.title,
      description: page.description,
      theme: page.theme,
      logo_url: page.logo_url,
      cover_url: page.cover_url,
      updated_at: page.updated_at,
    },
    links: links.map(l => ({
      id: l.id,
      label: l.label,
      url: l.url,
      kind: l.kind,
      sort_order: l.sort_order,
      data: l.data
    }))
  };
};
