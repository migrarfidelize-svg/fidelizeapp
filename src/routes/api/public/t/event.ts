import { createFileRoute } from "@tanstack/react-router";
import { logChannelEvent, resolveEstablishmentIdBySlug, type ChannelName, type EventType } from "@/lib/tracking.server";

/**
 * Beacon endpoint for anonymous engagement tracking.
 *
 * POST /api/public/t/event
 * body: { slug, channel, event_type, ref_id?, ref_label? }
 *
 * Called from the browser (navigator.sendBeacon or fetch keepalive) whenever
 * a public page loads. Fire-and-forget; always returns 204 to avoid blocking.
 */
export const Route = createFileRoute("/api/public/t/event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const raw = await request.text();
          const body = raw ? JSON.parse(raw) : {};
          const slug = String(body.slug ?? "").trim().toLowerCase();
          const channel = String(body.channel ?? "") as ChannelName;
          const event_type = String(body.event_type ?? "page_view") as EventType;
          const ref_id = body.ref_id ? String(body.ref_id) : null;
          const ref_label = body.ref_label ? String(body.ref_label) : null;

          const validChannels: ChannelName[] = ["linktree", "reviews", "loyalty", "qr"];
          const validEvents: EventType[] = ["page_view", "link_click", "qr_scan"];
          if (!validChannels.includes(channel) || !validEvents.includes(event_type)) {
            return new Response(null, { status: 204 });
          }

          const est_id = await resolveEstablishmentIdBySlug(slug);
          if (est_id) {
            await logChannelEvent({
              establishment_id: est_id,
              channel,
              event_type,
              ref_id,
              ref_label,
              request,
              url,
            });
          }
        } catch {
          /* swallow */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
