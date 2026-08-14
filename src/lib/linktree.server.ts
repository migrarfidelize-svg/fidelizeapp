import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicLandingDTO = {
  establishment: {
    name: string;
    slug: string;
    logo_url: string | null;
    cover_url: string | null;
    primary_color: string;
    accent_color: string;
    description: string | null;
    updated_at: string;
  };
  page: {
    id: string;
    title: string | null;
    description: string | null;
    theme: any;
    logo_url: string | null;
    cover_url: string | null;
    updated_at: string;
  };
  links: Array<{
    id: string;
    label: string;
    url: string;
    kind: string;
    sort_order: number;
    data: any;
  }>;
};

export const getPublicLandingBySlug = async (slug: string): Promise<PublicLandingDTO> => {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    throw new Error("NOT_FOUND");
  }

  // 1. Buscar estabelecimento (bypassing RLS for public read)
  const { data: establishment, error: estError } = await supabaseAdmin
    .from("establishments")
    .select("id, slug, name, logo_url, cover_url, primary_color, accent_color, active, description, updated_at")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (estError) {
    console.error("[getPublicLandingBySlug] establishment lookup error:", estError);
    throw new Error("DATABASE_ERROR");
  }
  if (!establishment) throw new Error("NOT_FOUND");
  if (!establishment.active) throw new Error("INACTIVE");

  // 2. Buscar landing page (link_tree_pages) publicada
  const { data: page, error: pageError } = await supabaseAdmin
    .from("link_tree_pages")
    .select("*")
    .eq("establishment_id", establishment.id)
    .eq("published", true)
    .maybeSingle();

  if (pageError) {
    console.error("[getPublicLandingBySlug] page lookup error:", pageError);
    throw new Error("DATABASE_ERROR");
  }
  if (!page) throw new Error("UNPUBLISHED");

  // 3. Buscar links ativos
  const { data: links, error: linksError } = await supabaseAdmin
    .from("link_tree_links")
    .select("id, label, url, kind, sort_order, enabled, data")
    .eq("page_id", page.id)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  if (linksError) {
    console.error("[getPublicLandingBySlug] links lookup error:", linksError);
    throw new Error("DATABASE_ERROR");
  }

  // 4. DTO Seguro
  return {
    establishment: {
      name: establishment.name,
      slug: establishment.slug,
      logo_url: establishment.logo_url,
      cover_url: establishment.cover_url,
      primary_color: establishment.primary_color || "#0ea5e9",
      accent_color: establishment.accent_color || "#8b5cf6",
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
    links: (links || []).map(l => ({
      id: l.id,
      label: l.label,
      url: l.url,
      kind: l.kind,
      sort_order: l.sort_order,
      data: l.data
    }))
  };
};
