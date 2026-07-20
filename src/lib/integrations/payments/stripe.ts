import type { PaymentProvider } from "./base";
import { paymentFields } from "./base";
import { timedFetch } from "../types";

export const stripeProvider: PaymentProvider = {
  meta: {
    id: "stripe",
    label: "Stripe",
    category: "payments",
    description: "Cartões, assinaturas e checkout global.",
    icon: "💠",
    docsUrl: "https://stripe.com/docs",
    supportsMode: true,
    fields: paymentFields({ publicKeySecret: "STRIPE_PUBLIC_KEY", accessTokenSecret: "STRIPE_SECRET_KEY", webhookSecret: "STRIPE_WEBHOOK_SECRET" }),
  },
  async testConnection(runtime, env) {
    const token = env[runtime.credentials_ref.access_token ?? "STRIPE_SECRET_KEY"];
    if (!token) return { ok: false, message: "STRIPE_SECRET_KEY não configurada." };
    try {
      const { response, body, latency_ms } = await timedFetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso à Stripe." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
