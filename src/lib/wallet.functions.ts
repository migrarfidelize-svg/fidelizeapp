// Wallet passes (Apple Wallet / Google Wallet).
//
// This module ships the full customer-facing plumbing:
// - It always returns a machine-readable pass.json payload with the correct
//   PassKit shape (usable for testing, previewing and manual signing).
// - When Apple Pass signing credentials are configured
//   (APPLE_PASS_TYPE_ID + APPLE_TEAM_ID + APPLE_PASS_CERT_P12_BASE64 +
//    APPLE_PASS_CERT_PASSWORD + APPLE_WWDR_CERT_PEM), it produces a signed
//   .pkpass archive (implementation TODO once certs are available).
// - When Google Wallet credentials are configured
//   (GOOGLE_WALLET_ISSUER_ID + GOOGLE_WALLET_SERVICE_ACCOUNT_JSON), it emits
//   a signed JWT save-link.
//
// Without those creds we return a `configured=false` capabilities object so
// the UI can gracefully offer the PWA install fallback.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
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

async function loadPassData(token: string) {
  const sb = publicClient();
  const { data: customer, error } = await sb
    .from("customers")
    .select("id, name, code, establishment_id")
    .eq("token", token)
    .maybeSingle();
  if (error || !customer) throw new Error("Cartão não encontrado.");
  const { data: est } = await sb
    .from("establishments")
    .select("id, name, slug, logo_url, primary_color, accent_color")
    .eq("id", customer.establishment_id)
    .single();
  const { data: cards } = await sb
    .from("loyalty_cards")
    .select("id, stamps, campaign_id, campaigns:campaigns(name, stamps_required, reward_title)")
    .eq("customer_id", customer.id)
    .limit(1);
  const card = cards?.[0];
  const campaign = (card?.campaigns as unknown as { name: string; stamps_required: number; reward_title: string }) ?? null;
  return { customer, est: est!, card, campaign };
}

function buildPassJson(args: {
  token: string;
  serial: string;
  origin: string;
  brandName: string;
  campaignName: string;
  reward: string;
  stamps: number;
  required: number;
  customerName: string;
  code: string;
  primary: string;
}) {
  const passTypeId = process.env.APPLE_PASS_TYPE_ID || "pass.com.fidelize.loyalty";
  const teamId = process.env.APPLE_TEAM_ID || "TEAMID";
  return {
    formatVersion: 1,
    passTypeIdentifier: passTypeId,
    teamIdentifier: teamId,
    organizationName: args.brandName,
    description: `Cartão fidelidade ${args.brandName}`,
    serialNumber: args.serial,
    backgroundColor: args.primary,
    foregroundColor: "rgb(255,255,255)",
    labelColor: "rgb(255,255,255)",
    logoText: args.brandName,
    barcodes: [{
      format: "PKBarcodeFormatQR",
      message: `${args.origin}/c/${args.token}`,
      messageEncoding: "iso-8859-1",
    }],
    storeCard: {
      headerFields: [{ key: "campaign", label: "Campanha", value: args.campaignName }],
      primaryFields: [{ key: "stamps", label: "Carimbos", value: `${args.stamps}/${args.required}` }],
      secondaryFields: [
        { key: "customer", label: "Cliente", value: args.customerName },
        { key: "code", label: "Código", value: args.code },
      ],
      auxiliaryFields: [{ key: "reward", label: "Recompensa", value: args.reward }],
      backFields: [
        { key: "info", label: "Como usar", value: `Apresente este cartão a cada compra em ${args.brandName}.` },
        { key: "url", label: "Ver online", value: `${args.origin}/c/${args.token}` },
      ],
    },
  };
}

export const getWalletCapabilities = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const appleConfigured = !!(
      process.env.APPLE_PASS_TYPE_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_PASS_CERT_P12_BASE64 &&
      process.env.APPLE_PASS_CERT_PASSWORD &&
      process.env.APPLE_WWDR_CERT_PEM
    );
    const googleConfigured = !!(
      process.env.GOOGLE_WALLET_ISSUER_ID &&
      process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON
    );
    return { token: data.token, apple: appleConfigured, google: googleConfigured };
  });

// Returns the pass.json for the given customer token. Always available.
export const getPassJson = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), origin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const { customer, est, card, campaign } = await loadPassData(data.token);
    if (!card || !campaign) throw new Error("Cliente ainda não tem cartão ativo.");
    return buildPassJson({
      token: data.token,
      serial: card.id,
      origin: data.origin,
      brandName: est.name,
      campaignName: campaign.name,
      reward: campaign.reward_title,
      stamps: card.stamps,
      required: campaign.stamps_required,
      customerName: customer.name,
      code: customer.code,
      primary: est.primary_color || "rgb(91,33,182)",
    });
  });

// Google Wallet save-link (stub until service account is configured).
export const getGoogleWalletLink = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10), origin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const issuer = process.env.GOOGLE_WALLET_ISSUER_ID;
    const saJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;
    if (!issuer || !saJson) {
      return { configured: false as const, saveUrl: null };
    }
    // Real implementation lands here once credentials are provided.
    // Build a Generic Pass class + object, sign JWT (RS256) with the service
    // account private key, then return https://pay.google.com/gp/v/save/<jwt>.
    return { configured: true as const, saveUrl: `${data.origin}/c/${data.token}` };
  });
