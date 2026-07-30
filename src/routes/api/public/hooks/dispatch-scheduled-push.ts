import { createFileRoute } from "@tanstack/react-router";
import { dispatchDueScheduledBroadcasts } from "@/lib/push.functions";

export const Route = createFileRoute("/api/public/hooks/dispatch-scheduled-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authorizeCronRequest } = await import("@/lib/cron-auth.server");
        const denied = authorizeCronRequest(request);
        if (denied) return denied;

        try {
          const r = await dispatchDueScheduledBroadcasts();
          return new Response(JSON.stringify({ ok: true, ...r }), {
            headers: { "Content-Type": "application/json" },
          });
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
