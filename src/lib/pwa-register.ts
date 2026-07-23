// Guarded PWA registration wrapper.
// Skill invariants:
// - Only register in production, on real hostnames (never in Lovable previews, iframes, or dev).
// - Support `?sw=off` kill switch that unregisters `/sw.js`.
// - Unregister any stale `/sw.js` in refused contexts.
// - Never register more than once — this is the ONLY call site.

const SW_URL = "/sw.js";

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

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isProd = import.meta.env.PROD;
  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!isProd || inIframe || isPreviewHost(host) || killSwitch || !isPwaPath(window.location.pathname)) {
    // Refuse and clean up any stale registration/cache outside the customer voucher PWA.
    cleanupPwa();
    return;
  }

  // Defer registration until after load so first paint isn't blocked.
  const doRegister = () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => { /* noop */ });
  };
  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}
