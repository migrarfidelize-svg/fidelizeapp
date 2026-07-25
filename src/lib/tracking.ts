import { useEffect } from "react";

type ChannelName = "linktree" | "reviews" | "loyalty" | "qr" | "menu";
type EventType = "page_view" | "link_click" | "qr_scan";

type Payload = {
  slug: string;
  channel: ChannelName;
  event_type: EventType;
  ref_id?: string | null;
  ref_label?: string | null;
};

/**
 * Fire-and-forget beacon to /api/public/t/event.
 * Uses sendBeacon when available (survives page navigation), fallback to
 * fetch keepalive. Never blocks or awaits network.
 */
export function trackChannelEvent(payload: Payload): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    const url = "/api/public/t/event";
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Fires a page_view exactly once per (slug + channel) mount.
 */
export function useChannelPageView(slug: string | undefined, channel: ChannelName) {
  useEffect(() => {
    if (!slug) return;
    trackChannelEvent({ slug, channel, event_type: "page_view" });
  }, [slug, channel]);
}
