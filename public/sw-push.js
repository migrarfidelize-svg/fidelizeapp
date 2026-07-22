/* Fidelize push handlers — loaded by workbox generateSW via workbox.importScripts. */
/* eslint-disable no-restricted-globals */

/**
 * Resolve a safe in-app URL for a push payload. Always keeps the user inside
 * /carteira/*. The `type` field (or `data.type`) chooses a canonical section,
 * with optional `slug` / `cardId` params for card-scoped screens. A raw
 * `url` is only honored when it points to the same origin AND its path starts
 * with /carteira — anything else falls back to a section from `type` or to
 * /carteira as the last resort.
 */
function resolveTargetUrl(data) {
  const origin = self.location.origin;
  const type = String(data.type || "").toLowerCase();
  const slug = typeof data.slug === "string" ? data.slug : "";

  const bySection = {
    qr: "/carteira?openQr=1",
    stamp: "/carteira/historico",
    history: "/carteira/historico",
    reward: "/carteira/premios",
    rewards: "/carteira/premios",
    prize: "/carteira/premios",
    cards: "/carteira/cartoes",
    campaign: "/carteira/mensagens",
    message: "/carteira/mensagens",
    birthday: "/carteira",
    discover: "/carteira/descobrir",
    profile: "/carteira/perfil",
    promotions: "/carteira/descobrir",
    promotion: "/carteira/descobrir",
    promo: "/carteira/descobrir",
  };

  // Card-scoped deep-link (stamp on a specific establishment).
  if (type === "card" && slug) return `/carteira/${encodeURIComponent(slug)}`;
  if ((type === "stamp" || type === "reward") && slug) {
    return `/carteira/${encodeURIComponent(slug)}`;
  }
  if ((type === "promotions" || type === "promotion" || type === "promo") && slug) {
    return `/carteira/${encodeURIComponent(slug)}/promocoes`;
  }

  // Explicit URL in payload — same-origin + /carteira prefix only.
  const raw = typeof data.url === "string" ? data.url : "";
  if (raw) {
    try {
      const u = new URL(raw, origin);
      if (u.origin === origin && u.pathname.startsWith("/carteira")) {
        return u.pathname + u.search + u.hash;
      }
    } catch (_e) {
      /* fall through */
    }
  }

  return bySection[type] || "/carteira";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Fidelize", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Fidelize";
  const targetUrl = resolveTargetUrl(data);
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || undefined,
    data: { url: targetUrl, type: data.type || null, slug: data.slug || null },
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const stored = (event.notification.data && event.notification.data.url) || "/carteira";
  // Re-run the guard: even if a bad URL was persisted from an older SW, keep
  // the click inside /carteira.
  const targetUrl = resolveTargetUrl({
    url: stored,
    type: event.notification.data && event.notification.data.type,
    slug: event.notification.data && event.notification.data.slug,
  });

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Prefer an existing wallet tab, then any same-origin tab.
      const sameOrigin = clientList.filter((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch (_e) {
          return false;
        }
      });
      const walletFirst =
        sameOrigin.find((c) => {
          try {
            return new URL(c.url).pathname.startsWith("/carteira");
          } catch (_e) {
            return false;
          }
        }) || sameOrigin[0];

      if (walletFirst && "focus" in walletFirst) {
        try {
          walletFirst.navigate(targetUrl);
        } catch (_e) {
          /* some browsers block navigate(); fall back to postMessage */
          try {
            walletFirst.postMessage({ type: "fidelize:navigate", url: targetUrl });
          } catch (_e2) {
            /* noop */
          }
        }
        return walletFirst.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    }),
  );
});
