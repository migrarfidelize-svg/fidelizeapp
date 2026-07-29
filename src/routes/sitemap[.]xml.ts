import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://fidelizeapp.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/**
 * Apenas rotas públicas e indexáveis.
 * Áreas autenticadas (/app, /hash, /carteira), fluxos de conta (/auth,
 * /onboarding), links tokenizados (/c/, /r/, /invite/) e endpoints de API
 * NUNCA entram aqui — além de bloqueados no robots.txt, recebem noindex.
 */
const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/precos", changefreq: "weekly", priority: "0.9" },
  { path: "/ajuda", changefreq: "weekly", priority: "0.7" },
  { path: "/videos", changefreq: "monthly", priority: "0.6" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos", changefreq: "yearly", priority: "0.3" },
];

const day = (v: unknown) => {
  if (!v) return undefined;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Estabelecimentos ativos: perfil público /e/{slug}
        const activeSlugs = new Map<string, { slug: string; updated_at?: string }>();
        try {
          const { data } = await supabaseAdmin
            .from("establishments")
            .select("id, slug, updated_at")
            .eq("active", true);
          for (const e of data ?? []) {
            if (!e.slug) continue;
            activeSlugs.set(e.id, { slug: e.slug, updated_at: e.updated_at ?? undefined });
            entries.push({
              path: `/e/${e.slug}`,
              lastmod: day(e.updated_at),
              changefreq: "weekly",
              priority: "0.7",
            });
          }
        } catch {
          // fail-soft: o sitemap continua válido com as rotas estáticas
        }

        // Vitrines publicadas — cardápio e catálogo
        try {
          const { data: menus } = await supabaseAdmin
            .from("restaurant_menus")
            .select("kind, updated_at, establishment_id")
            .eq("status", "published");
          for (const m of menus ?? []) {
            const est = activeSlugs.get(m.establishment_id as string);
            if (!est) continue;
            entries.push({
              path: `/${m.kind === "catalog" ? "catalogo" : "cardapio"}/${est.slug}`,
              lastmod: day(m.updated_at),
              changefreq: "daily",
              priority: "0.8",
            });
          }
        } catch {}

        // Árvores de links publicadas
        try {
          const { data: pages } = await supabaseAdmin
            .from("link_tree_pages")
            .select("establishment_id, updated_at")
            .eq("published", true);
          for (const p of pages ?? []) {
            const est = activeSlugs.get(p.establishment_id as string);
            if (!est) continue;
            entries.push({
              path: `/links/${est.slug}`,
              lastmod: day(p.updated_at),
              changefreq: "weekly",
              priority: "0.6",
            });
          }
        } catch {}

        // Central de ajuda — categorias e artigos publicados
        try {
          const { data: cats } = await supabaseAdmin
            .from("help_categories")
            .select("id, slug")
            .eq("active", true);
          const catSlug = new Map<string, string>();
          for (const c of cats ?? []) {
            if (!c.slug) continue;
            catSlug.set(c.id, c.slug);
            entries.push({ path: `/ajuda/${c.slug}`, changefreq: "monthly", priority: "0.5" });
          }
          const { data: articles } = await supabaseAdmin
            .from("help_articles")
            .select("slug, category_id, updated_at")
            .eq("published", true);
          for (const a of articles ?? []) {
            const cs = catSlug.get(a.category_id as string);
            if (!cs || !a.slug) continue;
            entries.push({
              path: `/ajuda/${cs}/${a.slug}`,
              lastmod: day((a as { updated_at?: string }).updated_at),
              changefreq: "monthly",
              priority: "0.4",
            });
          }
        } catch {}

        // Remove duplicatas mantendo a primeira ocorrência
        const seen = new Set<string>();
        const unique = entries.filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));

        const urls = unique.map((e) =>
          [
            `  <url>`,
            `    <loc>${escapeXml(BASE_URL + e.path)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
