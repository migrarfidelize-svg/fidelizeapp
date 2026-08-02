import type { InstanceRef, ProviderRuntime, WhatsAppProvider } from "./types";
import { uazapiProvider } from "./providers/uazapi.server";
import { decryptSecret } from "./crypto.server";

const PROVIDERS: Record<string, WhatsAppProvider> = {
  uazapi: uazapiProvider,
};

export const DEFAULT_PROVIDER = "uazapi";

export function getWhatsAppProvider(id: string): WhatsAppProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Provedor de WhatsApp desconhecido: ${id}`);
  return p;
}

export function listWhatsAppProviders() {
  return Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label }));
}

/** Lê a configuração global do provedor (tabela protegida — usa service role). */
export async function loadProviderRuntime(providerId = DEFAULT_PROVIDER): Promise<{
  runtime: ProviderRuntime;
  provider: WhatsAppProvider;
  row: any;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("whatsapp_providers")
    .select("*")
    .eq("provider", providerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Provedor de WhatsApp ainda não configurado pelo administrador.");
  if (!data.is_enabled) throw new Error("Integração de WhatsApp desativada pelo administrador.");

  const adminToken = await decryptSecret(data.encrypted_api_token);
  return {
    row: data,
    provider: getWhatsAppProvider(providerId),
    runtime: {
      baseUrl: data.base_url ?? "",
      adminToken,
      mode: (data.mode as "sandbox" | "production") ?? "production",
    },
  };
}

/** Carrega a instância (token descriptografado) de uma conexão do lojista. */
export async function loadInstanceRef(connection: any): Promise<InstanceRef> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("whatsapp_connection_secrets")
    .select("encrypted_instance_token")
    .eq("connection_id", connection.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.encrypted_instance_token) throw new Error("Conexão sem token de instância. Reconecte o WhatsApp.");
  return {
    externalInstanceId: connection.external_instance_id ?? "",
    instanceToken: await decryptSecret(data.encrypted_instance_token),
  };
}
