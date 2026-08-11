import { createFileRoute } from "@tanstack/react-router";
import { getSeoConfig } from "@/lib/seo.server";

export const Route = createFileRoute("/api/public/manifest")({
  server: {
    handlers: {
      GET: async () => {
        const config = await getSeoConfig();
        
        const manifest = {
          name: config.platformName,
          short_name: config.shortName,
          description: config.defaultDescription,
          start_url: "/",
          display: "standalone",
          background_color: config.backgroundColor || "#ffffff",
          theme_color: config.themeColor,
          icons: [
            ...(config.pwaIcon192Url ? [{
              src: config.pwaIcon192Url,
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            }] : []),
            ...(config.pwaIcon512Url ? [{
              src: config.pwaIcon512Url,
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }] : [])
          ]
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json",
            "Cache-Control": "no-store, max-age=0",
          },
        });
      },
    },
  },
});
