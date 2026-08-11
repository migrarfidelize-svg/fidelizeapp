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
            {
              src: config.faviconUrl || "/favicon.ico",
              sizes: "any",
              type: config.faviconUrl?.endsWith(".png") ? "image/png" : 
                    config.faviconUrl?.endsWith(".svg") ? "image/svg+xml" : 
                    config.faviconUrl?.endsWith(".webp") ? "image/webp" : "image/x-icon"
            },
            {
              src: config.pwaIcon192Url || "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: config.pwaIcon512Url || "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
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
