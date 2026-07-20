import type { PaymentProvider } from "./base";
import { paymentFields } from "./base";
import { timedFetch } from "../types";

export const pagseguroProvider: PaymentProvider = {
  meta: {
    id: "pagseguro",
    label: "PagSeguro (PagBank)",
    category: "payments",
    description: "Cobranças, PIX e cartão via API do PagBank.",
    icon: "🟠",
    docsUrl: "https://developer.pagbank.com.br",
    supportsMode: true,
    fields: paymentFields({ accessTokenSecret: "PAGSEGURO_ACCESS_TOKEN" }),
  },
  async testConnection(runtime, env) {
    const token = env[runtime.credentials_ref.access_token ?? "PAGSEGURO_ACCESS_TOKEN"];
    if (!token) return { ok: false, message: "PAGSEGURO_ACCESS_TOKEN não configurado." };
    const base = runtime.mode === "sandbox" ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";
    try {
      // Endpoint público de validação: lista métodos aceitos pela conta.
      const { response, body, latency_ms } = await timedFetch(`${base}/public-keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "card" }),
      });
      return {
        ok: response.ok,
        status: response.status,
        latency_ms,
        message: response.ok ? "Conectado com sucesso ao PagBank." : (body || `HTTP ${response.status}`),
      };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
