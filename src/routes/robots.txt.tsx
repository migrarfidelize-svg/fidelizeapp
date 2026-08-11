import { createFileRoute } from "@tanstack/react-router";
import { getSeoConfig } from "@/lib/seo.server";

export const Route = createFileRoute("/robots/txt")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getSeoConfig();
        const siteUrl = config.siteUrl;

        const content = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /app",
          "Disallow: /app/",
          "Disallow: /hash",
          "Disallow: /hash/",
          "Disallow: /auth",
          "Disallow: /carteira",
          "Disallow: /api/",
          "",
          `Sitemap: ${siteUrl}/sitemap.xml`
        ].join("\n");

        return new Response(content, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});