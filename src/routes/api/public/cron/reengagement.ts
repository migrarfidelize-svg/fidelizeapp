import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: send re-engagement pushes to customers inactive for N days.
 * Called daily by pg_cron via /api/public/cron/reengagement (requer cabeçalho apikey).
 */
export const Route = createFileRoute("/api/public/cron/reengagement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/lib/cron-auth.server");
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sendPushToCustomer } = await import("@/lib/push.server");

          const { data: allSettings } = await supabaseAdmin
            .from("retention_settings")
            .select("establishment_id, reengagement_enabled, reengagement_days, reengagement_message")
            .eq("reengagement_enabled", true);

          let totalSent = 0;
          let totalProcessed = 0;

          for (const s of allSettings ?? []) {
            const days = Math.max(7, s.reengagement_days ?? 30);
            const cutoff = new Date();
            cutoff.setUTCDate(cutoff.getUTCDate() - days);
            const cutoffIso = cutoff.toISOString();

            const { data: customers } = await supabaseAdmin
              .from("customers")
              .select("id, name, last_visit_at")
              .eq("establishment_id", s.establishment_id)
              .not("last_visit_at", "is", null)
              .lt("last_visit_at", cutoffIso)
              .limit(500);

            for (const c of customers ?? []) {
              const { data: recent } = await supabaseAdmin
                .from("retention_dispatches")
                .select("id")
                .eq("customer_id", c.id)
                .eq("kind", "reengagement")
                .gte("created_at", cutoffIso)
                .maybeSingle();
              if (recent) continue;

              const r = await sendPushToCustomer(
                c.id,
                {
                  title: `Sentimos sua falta, ${c.name?.split(" ")[0] ?? ""} 💛`,
                  body: s.reengagement_message,
                  tag: `reengagement-${c.id}`,
                },
                "campaign",
              );
              await supabaseAdmin.from("retention_dispatches").insert({
                establishment_id: s.establishment_id,
                customer_id: c.id,
                kind: "reengagement",
                channel: "push",
                status: r.sent > 0 ? "sent" : "skipped",
                payload: { sent: r.sent, days },
              });
              totalSent += r.sent;
              totalProcessed++;
            }
          }

          return Response.json({ ok: true, totalProcessed, totalSent });
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
