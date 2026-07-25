import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/notify-expiring-rewards")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { notifyExpiringRewards } = await import("@/lib/reward-expiry.server");
          const result = await notifyExpiringRewards();
          return new Response(JSON.stringify({ ok: true, ...result }), {
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
