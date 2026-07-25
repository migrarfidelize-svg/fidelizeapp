import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = "https://fidelizeapp.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/precos", changefreq: "weekly", priority: "0.9" },
  { path: "/videos", changefreq: "monthly", priority: "0.6" },
  { path: "/baixar-migrator", changefreq: "monthly", priority: "0.4" },
  { path: "/ajuda", changefreq: "weekly", priority: "0.7" },
  { path: "/privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos", changefreq: "yearly", priority: "0.3" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        // Cardápios publicados — indexação controlada por status = 'published'
        try {
          const { data: menus } = await supabase
            .from("restaurant_menus")
            .select("updated_at, establishment:establishments!inner(slug, status)")
            .eq("status", "published");

          for (const m of menus ?? []) {
            const est: any = (m as any).establishment;
            if (!est?.slug) continue;
            if (est.status && est.status !== "active") continue;
            entries.push({
              path: `/cardapio/${est.slug}`,
              lastmod: (m as any).updated_at
                ? new Date((m as any).updated_at).toISOString().slice(0, 10)
                : undefined,
              changefreq: "daily",
              priority: "0.8",
            });
          }
        } catch {
          // fail-soft: sitemap ainda retorna as rotas estáticas
        }

        // Categorias públicas da central de ajuda
        try {
          const { data: cats } = await supabase
            .from("help_categories")
            .select("slug")
            .eq("published", true);
          for (const c of cats ?? []) {
            entries.push({
              path: `/ajuda/${(c as any).slug}`,
              changefreq: "monthly",
              priority: "0.5",
            });
          }
        } catch {}

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
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
          },
        });
      },
    },
  },
});
