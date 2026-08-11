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
          background_color: "#ffffff",
          theme_color: config.themeColor,
          icons: [
            {
              src: config.faviconUrl || "/favicon.ico",
              sizes: "any",
              type: "image/x-icon"
            },
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        };

        return new Response(JSON.stringify(manifest), {
          headers: {
            "Content-Type": "application/manifest+json",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
