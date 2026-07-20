import type { PaymentProvider } from "./base";
import { paymentFields } from "./base";
import { timedFetch } from "../types";

export const pagarmeProvider: PaymentProvider = {
  meta: {
    id: "pagarme",
    label: "Pagar.me",
    category: "payments",
    description: "Cartão, PIX e boleto (Stone).",
    icon: "🟣",
    docsUrl: "https://docs.pagar.me",
    supportsMode: true,
    fields: paymentFields({ accessTokenSecret: "PAGARME_ACCESS_TOKEN" }),
  },
  async testConnection(runtime, env) {
    const token = env[runtime.credentials_ref.access_token ?? "PAGARME_ACCESS_TOKEN"];
    if (!token) return { ok: false, message: "PAGARME_ACCESS_TOKEN não configurado." };
    try {
      const basic = Buffer.from(`${token}:`).toString("base64");
      const { response, body, latency_ms } = await timedFetch("https://api.pagar.me/core/v5/balance", {
        headers: { Authorization: `Basic ${basic}` },
      });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso à Pagar.me." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
