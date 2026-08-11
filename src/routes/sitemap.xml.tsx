import { createFileRoute } from "@tanstack/react-router";
import { getSeoConfig } from "@/lib/seo.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getSeoConfig();
        const siteUrl = config.siteUrl;

        // Static routes from config
        const staticRoutes = Object.entries(config.routes)
          .filter(([path, data]) => !data.noindex && !path.includes("app") && !path.includes("hash") && !path.includes("/*"))
          .map(([path]) => path);

        // Fetch active establishments for /e/$slug, /catalogo/$slug, /cardapio/$slug
        // Assuming 'establishments' table is the source of truth
        const { data: establishments } = await supabaseAdmin
          .from("establishments")
          .select("slug")
          .eq("active", true);

        const dynamicUrls: string[] = [];
        if (establishments) {
          for (const est of establishments) {
            dynamicUrls.push(`/e/${est.slug}`);
            dynamicUrls.push(`/catalogo/${est.slug}`);
            dynamicUrls.push(`/cardapio/${est.slug}`);
          }
        }

        const urls = [...staticRoutes, ...dynamicUrls];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.map(path => `
  <url>
    <loc>${siteUrl}${path === "/" ? "" : path}</loc>
    <changefreq>daily</changefreq>
    <priority>${path === "/" ? "1.0" : "0.7"}</priority>
  </url>`).join("")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});