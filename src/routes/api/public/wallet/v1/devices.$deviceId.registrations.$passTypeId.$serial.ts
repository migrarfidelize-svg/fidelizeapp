// Apple Wallet Web Service — registro/cancelamento de dispositivo.
// POST/DELETE /api/public/wallet/v1/devices/:deviceId/registrations/:passTypeId/:serial
import { createFileRoute } from "@tanstack/react-router";

async function authorize(request: Request, serial: string) {
  const header = request.headers.get("authorization") || "";
  const provided = header.replace(/^ApplePass\s+/i, "").trim();
  if (!provided || provided.length < 10) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pass } = await supabaseAdmin
    .from("wallet_passes")
    .select("id, auth_token, customer_id, status")
    .eq("platform", "apple")
    .eq("serial_number", serial)
    .maybeSingle();
  if (!pass || pass.status !== "active" || pass.auth_token !== provided) return null;
  return pass;
}

export const Route = createFileRoute("/api/public/wallet/v1/devices/$deviceId/registrations/$passTypeId/$serial")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const pass = await authorize(request, params.serial);
        if (!pass) return new Response("Unauthorized", { status: 401 });

        let pushToken = "";
        try {
          const body = (await request.json()) as { pushToken?: string };
          pushToken = String(body.pushToken || "").slice(0, 200);
        } catch { /* corpo vazio */ }
        if (!pushToken) return new Response("pushToken ausente", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("wallet_pass_devices")
          .select("id")
          .eq("pass_id", pass.id)
          .eq("device_library_identifier", params.deviceId)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin.from("wallet_pass_devices").update({ push_token: pushToken }).eq("id", existing.id);
          return new Response(null, { status: 200 });
        }
        await supabaseAdmin.from("wallet_pass_devices").insert({
          pass_id: pass.id,
          device_library_identifier: params.deviceId,
          push_token: pushToken,
        });
        return new Response(null, { status: 201 });
      },

      DELETE: async ({ params, request }) => {
        const pass = await authorize(request, params.serial);
        if (!pass) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("wallet_pass_devices")
          .delete()
          .eq("pass_id", pass.id)
          .eq("device_library_identifier", params.deviceId);
        return new Response(null, { status: 200 });
      },
    },
  },
});
