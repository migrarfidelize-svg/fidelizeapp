// Serves a signed .pkpass for the given customer access_token.
// Route: /api/public/wallet/apple/:token
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicSb() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const Route = createFileRoute("/api/public/wallet/apple/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { readAppleCreds, buildSignedPkpass } = await import("@/lib/pkpass.server");
        const creds = readAppleCreds();
        if (!creds) {
          console.warn("[pkpass] apple creds missing");
          return new Response("Apple Wallet não configurado neste servidor.", { status: 503 });
        }
        const token = params.token;
        if (!token || token.length < 10) return new Response("token inválido", { status: 400 });

        const sb = publicSb();
        const { data: customer, error } = await sb
          .from("customers")
          .select("id, name, code, establishment_id")
          .eq("access_token", token)
          .maybeSingle();
        if (error || !customer) {
          console.warn("[pkpass] customer not found", { token: token.slice(0, 6), error: error?.message });
          return new Response("Cartão não encontrado.", { status: 404 });
        }
        const { data: est } = await sb
          .from("establishments")
          .select("id, name, slug, logo_url, primary_color")
          .eq("id", customer.establishment_id)
          .single();
        const { data: cards } = await sb
          .from("loyalty_cards")
          .select("id, stamps, campaign_id, campaigns:campaigns(name, stamps_required, reward_title)")
          .eq("customer_id", customer.id)
          .limit(1);
        const card = cards?.[0];
        const campaign = card?.campaigns as unknown as { name: string; stamps_required: number; reward_title: string } | undefined;
        if (!est || !card || !campaign) return new Response("Cliente ainda não tem cartão ativo.", { status: 404 });

        const origin = new URL(request.url).origin;
        const passJson = {
          formatVersion: 1,
          passTypeIdentifier: creds.passTypeId,
          teamIdentifier: creds.teamId,
          organizationName: est.name,
          description: `Cartão fidelidade ${est.name}`,
          serialNumber: card.id,
          backgroundColor: est.primary_color || "rgb(91,33,182)",
          foregroundColor: "rgb(255,255,255)",
          labelColor: "rgb(255,255,255)",
          logoText: est.name,
          barcodes: [{
            format: "PKBarcodeFormatQR",
            message: `${origin}/c/${token}`,
            messageEncoding: "iso-8859-1",
          }],
          storeCard: {
            headerFields: [{ key: "campaign", label: "Campanha", value: campaign.name }],
            primaryFields: [{ key: "stamps", label: "Carimbos", value: `${card.stamps}/${campaign.stamps_required}` }],
            secondaryFields: [
              { key: "customer", label: "Cliente", value: customer.name },
              { key: "code", label: "Código", value: customer.code },
            ],
            auxiliaryFields: [{ key: "reward", label: "Recompensa", value: campaign.reward_title }],
            backFields: [
              { key: "info", label: "Como usar", value: `Apresente este cartão a cada compra em ${est.name}.` },
              { key: "url", label: "Ver online", value: `${origin}/c/${token}` },
            ],
          },
        };

        try {
          const zip = await buildSignedPkpass({ passJson, logoUrl: est.logo_url, creds });
          console.log("[pkpass] signed", { customer: customer.code, bytes: zip.byteLength });
          return new Response(zip as BodyInit, {
            status: 200,
            headers: {
              "content-type": "application/vnd.apple.pkpass",
              "content-disposition": `attachment; filename="fidelize-${customer.code}.pkpass"`,
              "cache-control": "no-store",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[pkpass] sign failed", msg);
          return new Response(`Falha ao assinar cartão: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
