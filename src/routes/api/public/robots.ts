import { createFileRoute } from "@tanstack/react-router";
import { getSeoConfig } from "@/lib/seo.server";

export const Route = createFileRoute("/api/public/robots")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getSeoConfig();
        const siteUrl = config.siteUrl;

        const content = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /app/",
          "Disallow: /hash/",
          "Disallow: /api/",
          "",
          `Sitemap: ${siteUrl}/api/public/sitemap.xml`
        ].join("\n");

        return new Response(content, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
