import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initSentryClient, captureClientError } from "../lib/sentry-client";
import { registerPWA } from "../lib/pwa-register";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";


if (typeof window !== "undefined") {
  initSentryClient();
  registerPWA();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">O endereço que você tentou acessar não existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground">Voltar ao início</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[root errorComponent]", error);
    reportLovableError(error, { boundary: "root" });
    captureClientError(error, { boundary: "root" });
  }, [error]);
  const detail = (error && (error.message || String(error))) || "";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Ops, algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tente novamente em alguns instantes.</p>
        {detail ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded-md border bg-muted/40 px-3 py-2 text-left text-[11px] leading-snug text-muted-foreground whitespace-pre-wrap break-words">
            {detail}
          </pre>
        ) : null}
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground">Tentar novamente</button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm font-medium">Início</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fidelize — Cartão fidelidade digital para o seu negócio" },
      { name: "description", content: "Crie seu cartão fidelidade digital, compartilhe por QR Code e faça seus clientes voltarem mais vezes. Sem aplicativo, sem cartão de papel." },
      { name: "author", content: "Fidelize" },
      { property: "og:title", content: "Fidelize — Cartão fidelidade digital" },
      { property: "og:description", content: "Transforme visitantes em clientes fiéis. Sem app, sem cartão de papel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#00ffff" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Fidelize" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon-mark.svg" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// Tema por rota: painéis internos (/app, /admin) em claro; restante em dark.
function themeForPath(p: string): "light" | "dark" {
  return p.startsWith("/app") || p.startsWith("/admin") ? "light" : "dark";
}
const THEME_INIT_SCRIPT = `(function(){try{var p=location.pathname;var t=(p.indexOf('/app')===0||p.indexOf('/admin')===0)?'light':'dark';var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;}catch(e){}})();`;



function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  // Aplica tema conforme a rota atual (/app e /admin em claro, resto em dark).
  useEffect(() => {
    const apply = () => {
      const t = themeForPath(window.location.pathname);
      const r = document.documentElement;
      r.classList.toggle("dark", t === "dark");
      r.style.colorScheme = t;
    };
    apply();
    const unsub = router.subscribe("onResolved", apply);
    return () => unsub();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
