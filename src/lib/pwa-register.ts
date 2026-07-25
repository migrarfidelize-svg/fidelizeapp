// Guarded PWA registration wrapper.
// Skill invariants:
// - Only register in production, on real hostnames (never in Lovable previews, iframes, or dev).
// - Support `?sw=off` kill switch that unregisters `/sw.js`.
// - Unregister any stale `/sw.js` in refused contexts.
// - Never register more than once — this is the ONLY call site.

const SW_URL = "/sw.js";
const SW_READY_TIMEOUT_MS = 20000;

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

function isPwaPath(_pathname: string): boolean {
  // Allow SW registration on every route on published domains so admin/merchant
  // pages can subscribe to test push. Hard-refused contexts (dev/preview/iframe)
  // are handled by `isHardRefusedContext()` below.
  return true;
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

export type SwRefusalReason =
  | "unsupported"
  | "not-production"
  | "in-iframe"
  | "preview-host"
  | "kill-switch";

export function canRegisterServiceWorker(): { allowed: true } | { allowed: false; reason: SwRefusalReason } {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { allowed: false, reason: "unsupported" };
  }
  if (!import.meta.env.PROD) return { allowed: false, reason: "not-production" };
  if (window.self !== window.top) return { allowed: false, reason: "in-iframe" };
  if (isPreviewHost(window.location.hostname)) return { allowed: false, reason: "preview-host" };
  if (new URLSearchParams(window.location.search).get("sw") === "off")
    return { allowed: false, reason: "kill-switch" };
  return { allowed: true };
}

function isHardRefusedContext(): boolean {
  return !canRegisterServiceWorker().allowed;
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

function requestImmediateActivation(registration: ServiceWorkerRegistration) {
  try {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    registration.installing?.postMessage({ type: "SKIP_WAITING" });
    registration.installing?.addEventListener("statechange", (ev) => {
      const sw = ev.target as ServiceWorker | null;
      if (sw?.state === "installed") sw.postMessage({ type: "SKIP_WAITING" });
    });
  } catch { /* noop */ }
}

function waitForRegistrationActivation(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active) return Promise.resolve(registration);

  return new Promise((resolve, reject) => {
    let settled = false;
    const candidates = [registration.installing, registration.waiting].filter(
      (sw): sw is ServiceWorker => Boolean(sw),
    );

    const cleanupFns: Array<() => void> = [];
    const finish = () => {
      if (settled) return;
      if (registration.active) {
        settled = true;
        cleanupFns.forEach((fn) => fn());
        resolve(registration);
      }
    };
    const failIfRedundant = (sw: ServiceWorker) => {
      if (settled) return;
      if (sw.state === "redundant") {
        settled = true;
        cleanupFns.forEach((fn) => fn());
        reject(new Error("O serviço de notificações não conseguiu instalar."));
      }
    };

    const onControllerChange = () => finish();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    cleanupFns.push(() => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange));

    for (const sw of candidates) {
      const onStateChange = () => {
        if (sw.state === "activated") finish();
        else failIfRedundant(sw);
      };
      sw.addEventListener("statechange", onStateChange);
      cleanupFns.push(() => sw.removeEventListener("statechange", onStateChange));
      onStateChange();
    }

    finish();
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

  history.pushState = function pushState(data: unknown, unused: string, url?: string | URL | null) {
    const result = originalPushState.call(history, data, unused, url);
    notify();
    return result;
  };
  history.replaceState = function replaceState(data: unknown, unused: string, url?: string | URL | null) {
    const result = originalReplaceState.call(history, data, unused, url);
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

  const registration = await registerServiceWorkerNow();

  // If a previous install attempt failed or a new SW is available, ask the
  // browser to re-check without blocking the permission click flow.
  void registration.update().catch(() => { /* noop */ });

  // If the SW is already active (any prior session), skip the ready race.
  if (registration.active) return registration;

  // Force any waiting worker to activate immediately so `ready` resolves.
  requestImmediateActivation(registration);

  try {
    return await withTimeout(
      Promise.race([
        navigator.serviceWorker.ready,
        waitForRegistrationActivation(registration),
      ]),
      timeoutMs,
      "O serviço de notificações demorou para iniciar. Recarregue o app e tente novamente.",
    );
  } catch (err) {
    // Fallback: if a usable registration appeared after the race, return it so push subscribe can proceed.
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;
    throw err;
  }
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
