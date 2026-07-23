// Guarded PWA registration wrapper.
// Skill invariants:
// - Only register in production, on real hostnames (never in Lovable previews, iframes, or dev).
// - Support `?sw=off` kill switch that unregisters `/sw.js`.
// - Unregister any stale `/sw.js` in refused contexts.
// - Never register more than once — this is the ONLY call site.

const SW_URL = "/sw.js";
const SW_READY_TIMEOUT_MS = 9000;

let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let routeWatcherInstalled = false;

function isPreviewHost(hostname: string): boolean {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        if (url.endsWith(SW_URL)) {
          try { await r.unregister(); } catch { /* noop */ }
        }
      }),
    );
  } catch { /* noop */ }
}

async function clearPwaCaches() {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) =>
          key.startsWith("workbox-") ||
          key === "html-navigations" ||
          key === "static-assets" ||
          key === "images" ||
          key === "google-fonts"
        )
        .map((key) => caches.delete(key)),
    );
  } catch { /* noop */ }
}

function cleanupPwa() {
  void unregisterMatching();
  void clearPwaCaches();
}

function isPwaPath(pathname: string): boolean {
  // Customer PWA surfaces that need a service worker (offline voucher +
  // Web Push subscription). Push opt-in lives on /carteira, so the SW must
  // be registered there or `navigator.serviceWorker.ready` never resolves.
  return pathname.startsWith("/c/") || pathname.startsWith("/carteira");
}

function isPwaLaunchAuth(pathname: string, search: string): boolean {
  if (!pathname.startsWith("/auth")) return false;
  try {
    return new URLSearchParams(search).get("source") === "pwa";
  } catch {
    return false;
  }
}

function shouldRegisterForLocation(location: Location): boolean {
  return isPwaPath(location.pathname) || isPwaLaunchAuth(location.pathname, location.search);
}

function isHardRefusedContext(): boolean {
  const isProd = import.meta.env.PROD;
  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";
  return !isProd || inIframe || isPreviewHost(host) || killSwitch;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function registerServiceWorkerNow(): Promise<ServiceWorkerRegistration> {
  if (registrationPromise) return registrationPromise;
  registrationPromise = navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch((error) => {
    registrationPromise = null;
    throw error;
  });
  return registrationPromise;
}

function triggerRegistrationIfNeeded() {
  if (isHardRefusedContext()) {
    cleanupPwa();
    return;
  }
  if (!shouldRegisterForLocation(window.location)) return;
  void registerServiceWorkerNow().catch(() => { /* noop */ });
}

function installRouteWatcher() {
  if (routeWatcherInstalled) return;
  routeWatcherInstalled = true;

  const notify = () => window.dispatchEvent(new Event("fidelize:pwa-route-change"));
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    notify();
    return result;
  };
  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    notify();
    return result;
  };

  window.addEventListener("popstate", triggerRegistrationIfNeeded);
  window.addEventListener("fidelize:pwa-route-change", triggerRegistrationIfNeeded);
}

export async function ensurePwaRegistration(timeoutMs = SW_READY_TIMEOUT_MS): Promise<ServiceWorkerRegistration> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Este aparelho não suporta notificações push.");
  }
  if (isHardRefusedContext()) {
    cleanupPwa();
    throw new Error("Notificações push funcionam no app publicado e instalado.");
  }

  await registerServiceWorkerNow();
  return withTimeout(
    navigator.serviceWorker.ready,
    timeoutMs,
    "O serviço de notificações demorou para iniciar. Recarregue o app e tente novamente.",
  );
}

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isHardRefusedContext()) {
    // Refuse and clean up any stale registration/cache in dev, preview, iframe or kill-switch contexts.
    cleanupPwa();
    return;
  }

  installRouteWatcher();

  if (!shouldRegisterForLocation(window.location)) return;

  // Defer registration until after load so first paint isn't blocked.
  const doRegister = () => {
    void registerServiceWorkerNow().catch(() => { /* noop */ });
  };
  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
