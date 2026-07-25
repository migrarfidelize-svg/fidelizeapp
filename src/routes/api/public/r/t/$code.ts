import { createFileRoute } from "@tanstack/react-router";

/**
 * Public redirect for identified QR tags (mesa, balcão, guardanapo…).
 *
 * URL: /api/public/r/t/:code
 *   - Looks up qr_tags by code
 *   - Follows the tag's destination override OR the establishment default
 *   - Increments scans_count and logs a channel_events row with the tag label
 */
export const Route = createFileRoute("/api/public/r/t/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const code = String(params.code ?? "").trim().toLowerCase();
        if (!code || !/^[a-z0-9]{4,16}$/.test(code)) {
          return new Response("Bad code", { status: 400 });
        }

        const reqUrl = new URL(request.url);
        const origin = reqUrl.origin;
        const forwardedQs = new URLSearchParams(reqUrl.searchParams);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tag } = await supabaseAdmin
          .from("qr_tags")
          .select("id, establishment_id, label, destination, active, establishments(slug, qr_destination)")
          .eq("code", code)
          .maybeSingle();

        if (!tag || !tag.active) {
          return new Response("QR não encontrado ou inativo.", { status: 404 });
        }

        const est = (tag as any).establishments as { slug: string; qr_destination: string | null } | null;
        if (!est?.slug) return new Response("Estabelecimento indisponível.", { status: 404 });

        const { resolveQrTarget } = await import("@/lib/qr-target.server");
        const resolved = await resolveQrTarget({
          admin: supabaseAdmin,
          origin,
          slug: est.slug,
          establishmentId: tag.establishment_id,
          dest: tag.destination ?? est.qr_destination,
        });
        let target = resolved.url;

        const forwarded = forwardedQs.toString();
        if (forwarded) {
          const sep = target.includes("?") ? "&" : "?";
          target = `${target}${sep}${forwarded}`;
        }

        // Fire-and-forget scan bookkeeping
        try {
          const ua = request.headers.get("user-agent")?.slice(0, 300) ?? null;
          const ipRaw =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "";
          const dayKey = new Date().toISOString().slice(0, 10);
          const ipHash = ipRaw ? await sha256Hex(`${dayKey}:${truncateIp(ipRaw)}`) : null;

          void supabaseAdmin
            .from("channel_events")
            .insert({
              establishment_id: tag.establishment_id,
              channel: "qr",
              event_type: "qr_tag_scan",
              ref_id: code,
              ref_label: tag.label,
              ua,
              ip_hash: ipHash,
              utm_source: forwardedQs.get("utm_source"),
              utm_medium: forwardedQs.get("utm_medium"),
              utm_campaign: forwardedQs.get("utm_campaign"),
            });

          void supabaseAdmin
            .from("qr_tags")
            .select("scans_count")
            .eq("id", tag.id)
            .maybeSingle()
            .then(({ data: cur }) => {
              const next = ((cur?.scans_count ?? 0) as number) + 1;
              void supabaseAdmin.from("qr_tags").update({ scans_count: next }).eq("id", tag.id);
            });

        } catch {
          /* never block redirect */
        }

        return Response.redirect(target, 302);
      },
    },
  },
});

function truncateIp(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + "::/48";
  const p = ip.split(".");
  if (p.length !== 4) return ip;
  return `${p[0]}.${p[1]}.${p[2]}.0/24`;
}

async function sha256Hex(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
