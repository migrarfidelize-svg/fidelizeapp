// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

const config = defineConfig({
  // Produção oficial: processo HTTP Node para PM2/Nginx. Sem esta definição o
  // pacote Lovable usa cloudflare-module, cujo index.mjs expõe fetch mas não
  // abre uma porta TCP quando executado diretamente pelo PM2.
  nitro: { preset: "node-server" },
  tanstackStart: {
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      strategies: "generateSW",
      // Nitro node-server serves this directory verbatim. The Lovable wrapper
      // runs multiple Vite environments, whose generic fallback is `dist`;
      // pinning the PWA output prevents the final SSR pass from separating the
      // generated Workbox runtime from the service worker served by Node.
      outDir: ".output/public",
      registerType: "autoUpdate",
      injectRegister: null, // wrapper is the only registrar
      devOptions: { enabled: false },
      filename: "sw.js",
      manifest: false, // we ship our own public/manifest.webmanifest
      workbox: {
        importScripts: ["/sw-push.js"],
        clientsClaim: true,
        skipWaiting: true,
        cleanupOutdatedCaches: true,
        // TanStack Start emits browser files under a build-time `client/` folder,
        // but the deployed site serves them from `/`. If Workbox precaches the
        // raw `client/...` URLs, install fails with 404s and
        // navigator.serviceWorker.ready times out during push opt-in.
        modifyURLPrefix: { "client/": "" },
        // Offline fallback is only for customer vouchers. Admin/app pages must
        // always load fresh code on refresh to avoid stale UI/runtime chunks.
        navigateFallback: "/",
        navigateFallbackAllowlist: [/^\/c\//],
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/api\//,
          /^\/app(?:\/|$)/,
          /^\/admin(?:\/|$)/,
          /^\/auth(?:\/|$)/,
          /^\/onboarding(?:\/|$)/,
        ],
        // Don't precache HTML — always fetch fresh via NetworkFirst below.
        globPatterns: ["**/*.{js,css,woff,woff2,ico,png,svg,webp,avif}"],
        runtimeCaching: [
          {
            // HTML navigations: always try network first, fall back to cache offline.
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && url.pathname.startsWith("/c/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Same-origin hashed static assets (Vite build output).
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && /\.(?:js|css|woff2?|ttf|otf)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Icons and other same-origin images.
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && /\.(?:png|jpg|jpeg|svg|webp|avif|ico|gif)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Google Fonts stylesheet + files.
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts" },
          },
        ],
      },
    }),
  ],
});

// The Lovable wrapper intentionally replaces every user Nitro preset with
// cloudflare-module when LOVABLE_SANDBOX or DEV_SERVER__PROJECT_PATH is set.
// `npm run build` is the official VPS build, so hide only those build-host
// signals while the wrapper composes the production configuration. Development
// and preview behavior remains unchanged.
export default async function defineVpsProductionConfig(env: Parameters<typeof config>[0]) {
  if (env.command !== "build" || env.mode === "development") return config(env);

  const buildHostVariables = ["LOVABLE_SANDBOX", "DEV_SERVER__PROJECT_PATH", "LOVABLE_NITRO_PRESET"] as const;
  const previousValues = new Map(buildHostVariables.map((name) => [name, process.env[name]]));

  for (const name of buildHostVariables) delete process.env[name];
  try {
    return await config(env);
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
