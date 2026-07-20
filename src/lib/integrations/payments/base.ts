import type { IntegrationField, IntegrationProvider, IntegrationProviderMeta } from "../types";

export function paymentFields(opts: { publicKeySecret?: string; accessTokenSecret: string; webhookSecret?: string }): IntegrationField[] {
  const fields: IntegrationField[] = [];
  if (opts.publicKeySecret) {
    fields.push({ name: "public_key", label: "Public Key", kind: "secret", secretName: opts.publicKeySecret, helpText: "Usada no frontend do checkout." });
  }
  fields.push({ name: "access_token", label: "Access Token", kind: "secret", required: true, secretName: opts.accessTokenSecret });
  if (opts.webhookSecret) {
    fields.push({ name: "webhook_secret", label: "Webhook Secret (HMAC)", kind: "secret", secretName: opts.webhookSecret, helpText: "Chave HMAC para validar notificações." });
  }
  fields.push({ name: "webhook_url", label: "Webhook URL", kind: "url", helpText: "URL informada no painel do gateway." });
  return fields;
}

export type PaymentProviderMeta = IntegrationProviderMeta & { category: "payments" };
export type PaymentProvider = IntegrationProvider & { meta: PaymentProviderMeta };
