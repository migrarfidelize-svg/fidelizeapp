import type { PaymentProvider } from "./base";
import { paymentFields } from "./base";
import { timedFetch } from "../types";

/**
 * Adapter fino para o Mercado Pago. A configuração completa continua em
 * `/admin/pagamentos` e `payment_settings`. Aqui só provemos metadados e
 * um teste de conexão consistente com o restante do hub.
 */
export const mercadopagoProvider: PaymentProvider = {
  meta: {
    id: "mercadopago",
    label: "Mercado Pago",
    category: "payments",
    description: "PIX, cartão e boleto. Configuração completa em /admin/pagamentos.",
    icon: "💳",
    docsUrl: "https://www.mercadopago.com.br/developers/pt",
    supportsMode: true,
    fields: paymentFields({
      publicKeySecret: "MERCADOPAGO_PUBLIC_KEY",
      accessTokenSecret: "MERCADOPAGO_ACCESS_TOKEN",
      webhookSecret: "MERCADOPAGO_WEBHOOK_SECRET",
    }),
  },
  async testConnection(runtime, env) {
    const token = env[runtime.credentials_ref.access_token ?? "MERCADOPAGO_ACCESS_TOKEN"];
    if (!token) return { ok: false, message: "MERCADOPAGO_ACCESS_TOKEN não configurado." };
    try {
      const { response, body, latency_ms } = await timedFetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return { ok: false, status: response.status, latency_ms, message: body || `HTTP ${response.status}` };
      const me = JSON.parse(body) as { nickname?: string; email?: string; id?: number; site_id?: string; tags?: string[] };
      const isTest = /^TESTUSER/i.test(String(me.nickname ?? "")) || (me.tags ?? []).includes("test_user");
      if (runtime.mode === "production" && isTest) {
        return {
          ok: false,
          status: 200,
          latency_ms,
          message: `Credencial de teste (${me.nickname}) configurada em ambiente de produção. Troque para o Access Token real ou mude o modo para Sandbox.`,
        };
      }
      return { ok: true, status: 200, latency_ms, message: `Conectado como ${me.nickname ?? me.email ?? me.id}`, details: { id: me.id ?? null, nickname: me.nickname ?? null, site_id: me.site_id ?? null } };
    } catch (e: any) {
      return { ok: false, message: e?.message ?? String(e) };
    }
  },
};
