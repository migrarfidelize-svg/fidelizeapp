import { createFileRoute } from "@tanstack/react-router";
import { dispatchDueScheduledBroadcasts } from "@/lib/push.functions";

export const Route = createFileRoute("/api/public/hooks/dispatch-scheduled-push")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const r = await dispatchDueScheduledBroadcasts();
          return new Response(JSON.stringify({ ok: true, ...r }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
