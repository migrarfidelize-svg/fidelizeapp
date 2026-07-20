import type { IntegrationField, IntegrationProvider, IntegrationProviderMeta } from "../types";

/**
 * Campos padrão para provedores de IA.
 * `secretName` é usado quando `kind === "secret"` — o valor é lido de process.env
 * pelo backend; jamais retornado ao cliente.
 */
export function aiFields(secretName: string, opts: { orgField?: boolean; defaultModel?: string } = {}): IntegrationField[] {
  const fields: IntegrationField[] = [
    { name: "api_key", label: "API Key", kind: "secret", required: true, secretName, helpText: "Armazenada com segurança como variável de ambiente." },
  ];
  if (opts.orgField) {
    fields.push({ name: "organization", label: "Organization", kind: "text", placeholder: "org_...", helpText: "Opcional. Necessário para contas com múltiplas organizações." });
  }
  fields.push(
    { name: "base_url", label: "Base URL", kind: "url", placeholder: "https://...", helpText: "Opcional. Use endpoint próprio ou proxy compatível." },
    { name: "default_model", label: "Modelo padrão", kind: "text", required: true, defaultValue: opts.defaultModel, placeholder: opts.defaultModel },
    { name: "timeout_ms", label: "Timeout (ms)", kind: "number", defaultValue: 15000 },
  );
  return fields;
}

export type AIProviderMeta = IntegrationProviderMeta & { category: "ai" };
export type AIProvider = IntegrationProvider & { meta: AIProviderMeta };
