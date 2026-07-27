// Apple Wallet Web Service — lista de passes alterados para o dispositivo.
// GET /api/public/wallet/v1/devices/:deviceId/registrations/:passTypeId?passesUpdatedSince=...
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/wallet/v1/devices/$deviceId/registrations/$passTypeId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new URL(request.url).searchParams.get("passesUpdatedSince");

        const { data: devices } = await supabaseAdmin
          .from("wallet_pass_devices")
          .select("pass_id")
          .eq("device_library_identifier", params.deviceId);

        const ids = (devices ?? []).map((d) => d.pass_id);
        if (ids.length === 0) return new Response(null, { status: 204 });

        let q = supabaseAdmin
          .from("wallet_passes")
          .select("serial_number, updated_at")
          .in("id", ids)
          .eq("status", "active");
        if (since) q = q.gt("updated_at", since);

        const { data: passes } = await q;
        if (!passes || passes.length === 0) return new Response(null, { status: 204 });

        const lastUpdated = passes
          .map((p) => p.updated_at)
          .sort()
          .at(-1)!;

        return Response.json({
          serialNumbers: passes.map((p) => p.serial_number),
          lastUpdated,
        });
      },
    },
  },
});
