import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina periódica dos destaques patrocinados:
 * ativa campanhas programadas cuja data chegou, encerra as que venceram e
 * expira cobranças PIX abandonadas.
 */
export const Route = createFileRoute("/api/public/hooks/sponsored-ads-lifecycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/lib/cron-auth.server");
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const now = new Date().toISOString();

          const activated = await supabaseAdmin
            .from("sponsored_ad_campaigns")
            .update({ status: "active", updated_at: now })
            .eq("status", "scheduled")
            .lte("starts_at", now)
            .select("id");

          const expired = await supabaseAdmin
            .from("sponsored_ad_campaigns")
            .update({ status: "expired", updated_at: now })
            .in("status", ["active", "paused"])
            .lt("ends_at", now)
            .select("id");

          const staleOrders = await supabaseAdmin
            .from("sponsored_ad_orders")
            .update({ status: "expired", updated_at: now })
            .eq("status", "pending")
            .lt("pix_expires_at", now)
            .select("id");

          return new Response(
            JSON.stringify({
              ok: true,
              activated: activated.data?.length ?? 0,
              expired: expired.data?.length ?? 0,
              expired_orders: staleOrders.data?.length ?? 0,
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
