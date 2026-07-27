// Apple Wallet Web Service — versão mais recente do passe.
// GET /api/public/wallet/v1/passes/:passTypeId/:serial
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/wallet/v1/passes/$passTypeId/$serial")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const header = request.headers.get("authorization") || "";
        const provided = header.replace(/^ApplePass\s+/i, "").trim();
        if (!provided) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pass } = await supabaseAdmin
          .from("wallet_passes")
          .select("id, auth_token, customer_id, serial_number, status")
          .eq("platform", "apple")
          .eq("serial_number", params.serial)
          .maybeSingle();
        if (!pass || pass.status !== "active" || pass.auth_token !== provided) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { readAppleCreds, buildSignedPkpass } = await import("@/lib/pkpass.server");
        const creds = readAppleCreds();
        if (!creds) return new Response("Não configurado", { status: 503 });

        const { loadPassModelByCustomer } = await import("@/lib/wallet-pass.server");
        const model = await loadPassModelByCustomer(pass.customer_id);
        if (!model) return new Response("Cartão não encontrado", { status: 404 });

        const origin = new URL(request.url).origin;
        const { buildApplePassJson } = await import("@/lib/apple-pass.server");
        const passJson = buildApplePassJson({
          model,
          origin,
          passTypeId: creds.passTypeId,
          teamId: creds.teamId,
          serialNumber: pass.serial_number,
          authenticationToken: pass.auth_token,
        });

        const zip = await buildSignedPkpass({
          passJson,
          logoUrl: model.settings.logo_url || model.establishment.logo_url,
          creds,
        });
        return new Response(zip as BodyInit, {
          status: 200,
          headers: {
            "content-type": "application/vnd.apple.pkpass",
            "last-modified": new Date().toUTCString(),
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
