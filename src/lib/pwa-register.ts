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

export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isProd = import.meta.env.PROD;
  const inIframe = window.self !== window.top;
  const host = window.location.hostname;
  const killSwitch = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!isProd || inIframe || isPreviewHost(host) || killSwitch) {
    // Refuse and clean up any stale registration.
    void unregisterMatching();
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
