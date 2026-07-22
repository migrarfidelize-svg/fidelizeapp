import { createFileRoute } from "@tanstack/react-router";

/**
 * Public QR redirect + scan counter.
 *
 * URL: /api/public/r/qr/:slug/:dest
 *  - dest = "main"   → redirects to /avaliar/{slug}
 *  - dest = "second" → redirects to ?u=<encoded URL>
 *
 * Records a row in public.qr_scans (best-effort, never blocks the redirect).
 * No PII is stored: IP is truncated to /24 + SHA-256 hashed with a per-day salt.
 */
export const Route = createFileRoute("/api/public/r/qr/$slug/$dest")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        const destParam = String(params.dest ?? "").trim().toLowerCase();
        const dest: "main" | "second" =
          destParam === "second" ? "second" : "main";

        if (!slug || !/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) {
          return new Response("Bad slug", { status: 400 });
        }

        const reqUrl = new URL(request.url);
        // Preserve incoming query (utm, etc)
        const forwardedQs = new URLSearchParams(reqUrl.searchParams);
        const secondaryOverride = forwardedQs.get("u");
        forwardedQs.delete("u");

        const origin = reqUrl.origin;

        // Look up establishment_id from slug via publishable-key server client
        // (public read protected by RLS on establishments if any; slug is a
        // stable public identifier of the merchant profile).
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_URL!;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const sb = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
                h.delete("Authorization");
              }
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const { data: est } = await sb
          .from("establishments")
          .select("id, qr_destination")
          .eq("slug", slug)
          .maybeSingle();

        // Compute redirect target (never fail the redirect if logging fails)
        let target: string;
        if (dest === "second") {
          let u = secondaryOverride ?? "";
          try {
            new URL(u);
          } catch {
            u = "";
          }
          target = u || `${origin}/e/${slug}`;
        } else {
          // Dynamic destination: reviews (default), linktree, or landing.
          const qd = (est?.qr_destination ?? "reviews") as
            | "reviews"
            | "linktree"
            | "landing";
          if (qd === "linktree") {
            target = `${origin}/links/${slug}`;
          } else if (qd === "landing") {
            target = `${origin}/l/${slug}`;
          } else {
            target = `${origin}/avaliar/${slug}`;
          }
        }


        // Forward any remaining UTM params
        const forwarded = forwardedQs.toString();
        if (forwarded) {
          const sep = target.includes("?") ? "&" : "?";
          target = `${target}${sep}${forwarded}`;
        }

        // Fire-and-forget scan log via admin client (writes bypass RLS)
        if (est?.id) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const ua = request.headers.get("user-agent")?.slice(0, 300) ?? null;
            const ipRaw =
              request.headers.get("cf-connecting-ip") ||
              request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              "";
            const dayKey = new Date().toISOString().slice(0, 10);
            const ipHash = ipRaw
              ? await sha256Hex(`${dayKey}:${truncateIp(ipRaw)}`)
              : null;
            // Do not await Supabase insert — Cloudflare Workers keep the promise
            // alive via waitUntil semantics of the platform; if it fails we
            // still redirect.
            void supabaseAdmin
              .from("qr_scans")
              .insert({ establishment_id: est.id, dest, ua, ip_hash: ipHash });
          } catch {
            /* swallow — analytics must never break the redirect */
          }
        }

        return Response.redirect(target, 302);
      },
    },
  },
});

function truncateIp(ip: string): string {
  // IPv4: keep the /24; IPv6: keep the /48
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.slice(0, 3).join(":") + "::/48";
  }
  const parts = ip.split(".");
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
}

async function sha256Hex(s: string): Promise<string> {
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}
