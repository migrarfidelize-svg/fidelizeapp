// Serve um .pkpass assinado para o access_token do cliente.
// Rota: /api/public/wallet/apple/:token
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/wallet/apple/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = params.token;
        if (!token || token.length < 10) return new Response("token inválido", { status: 400 });

        const { readAppleCreds, buildSignedPkpass } = await import("@/lib/pkpass.server");
        const creds = readAppleCreds();
        if (!creds) return new Response("Apple Wallet não configurado neste servidor.", { status: 503 });

        const { loadPassModelByToken, ensurePassRecord } = await import("@/lib/wallet-pass.server");
        const model = await loadPassModelByToken(token);
        if (!model) return new Response("Cartão não encontrado.", { status: 404 });
        if (!model.settings.apple_enabled) return new Response("Apple Wallet desativado para esta empresa.", { status: 403 });

        const pass = await ensurePassRecord({ model, platform: "apple" });
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

        try {
          const zip = await buildSignedPkpass({
            passJson,
            logoUrl: model.settings.logo_url || model.establishment.logo_url,
            creds,
          });
          return new Response(zip as BodyInit, {
            status: 200,
            headers: {
              "content-type": "application/vnd.apple.pkpass",
              "content-disposition": `attachment; filename="fidelize-${model.customer.code}.pkpass"`,
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[pkpass] sign failed", msg);
          return new Response("Falha ao assinar cartão.", { status: 500 });
        }
      },
    },
  },
});
