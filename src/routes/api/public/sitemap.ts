import { createFileRoute } from "@tanstack/react-router";
import { getSeoConfig } from "@/lib/seo.server";

export const Route = createFileRoute("/api/public/sitemap")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getSeoConfig();
        const siteUrl = config.siteUrl;
        
        // Only include indexable routes from config
        const publicRoutes = Object.entries(config.routes)
          .filter(([path, data]) => !data.noindex && !path.includes("app") && !path.includes("hash"))
          .map(([path]) => path);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${publicRoutes.map(path => `
  <url>
    <loc>${siteUrl}${path === "/" ? "" : path}</loc>
    <changefreq>weekly</changefreq>
    <priority>${path === "/" ? "1.0" : "0.8"}</priority>
  </url>`).join("")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
