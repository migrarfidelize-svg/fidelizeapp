import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Configuração global da integração de WhatsApp — exclusiva do Super Admin.
 * Tokens são gravados criptografados; a UI só recebe máscaras.
 */

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

export const getWhatsAppProviderConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret, maskSecret } = await import("@/lib/whatsapp/crypto.server");
    const { listWhatsAppProviders } = await import("@/lib/whatsapp/registry.server");
    const { getPublicAppUrl } = await import("@/lib/app-url");

    const { data, error } = await (supabaseAdmin as any)
      .from("whatsapp_providers")
      .select("*")
      .order("provider");
    if (error) throw new Error(error.message);

    const rows = await Promise.all(
      (data ?? []).map(async (r: any) => ({
        id: r.id,
        provider: r.provider,
        display_name: r.display_name,
        is_enabled: r.is_enabled,
        base_url: r.base_url,
        mode: r.mode,
        settings: r.settings ?? {},
        last_test_status: r.last_test_status,
        last_test_message: r.last_test_message,
        last_tested_at: r.last_tested_at,
        api_token_masked: maskSecret(await decryptSecret(r.encrypted_api_token)),
        updated_at: r.updated_at,
      })),
    );

    const { count } = await (supabaseAdmin as any)
      .from("whatsapp_connections")
      .select("id", { count: "exact", head: true });

    return {
      providers: rows,
      catalog: listWhatsAppProviders(),
      connectionsCount: count ?? 0,
      cryptoConfigured: Boolean(process.env["WHATSAPP_CRYPTO_KEY"]),
      webhookBaseUrl: `${getPublicAppUrl()}/api/public/whatsapp/webhook`,
    };
  });

const SaveInput = z.object({
  provider: z.string().min(2).max(40),
  display_name: z.string().min(2).max(80),
  base_url: z.string().url().max(300),
  mode: z.enum(["sandbox", "production"]),
  is_enabled: z.boolean(),
  api_token: z.string().max(500).optional(),
});

export const saveWhatsAppProviderConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptSecret } = await import("@/lib/whatsapp/crypto.server");

    const patch: Record<string, unknown> = {
      provider: data.provider,
      display_name: data.display_name,
      base_url: data.base_url.replace(/\/+$/, ""),
      mode: data.mode,
      is_enabled: data.is_enabled,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (data.api_token && data.api_token.trim()) {
      patch["encrypted_api_token"] = await encryptSecret(data.api_token.trim());
    }

    const { error } = await (supabaseAdmin as any)
      .from("whatsapp_providers")
      .upsert(patch, { onConflict: "provider" });
    if (error) throw new Error(error.message);

    try {
      await (supabaseAdmin as any).from("audit_logs").insert({
        user_id: context.userId,
        action: "whatsapp.provider.save",
        target_type: "whatsapp_provider",
        metadata: { provider: data.provider, mode: data.mode, enabled: data.is_enabled },
      });
    } catch { /* auditoria best-effort */ }

    return { ok: true };
  });

export const testWhatsAppProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ provider: z.string().min(2).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecret } = await import("@/lib/whatsapp/crypto.server");
    const { getWhatsAppProvider } = await import("@/lib/whatsapp/registry.server");

    const { data: row, error } = await (supabaseAdmin as any)
      .from("whatsapp_providers").select("*").eq("provider", data.provider).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Provedor não configurado ainda.");

    const provider = getWhatsAppProvider(data.provider);
    let result;
    try {
      result = await provider.testConnection({
        baseUrl: row.base_url ?? "",
        adminToken: await decryptSecret(row.encrypted_api_token),
        mode: row.mode ?? "production",
      });
    } catch (e: any) {
      result = { ok: false, message: e?.message ? String(e.message) : "Erro desconhecido." };
    }

    await (supabaseAdmin as any).from("whatsapp_providers").update({
      last_test_status: result.ok ? "ok" : "error",
      last_test_message: result.message.slice(0, 500),
      last_tested_at: new Date().toISOString(),
    }).eq("provider", data.provider);

    return result;
  });

/** Visão operacional: conexões de todos os lojistas. */
export const listWhatsAppConnectionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("whatsapp_connections")
      .select("id, establishment_id, provider, connected_phone, connection_status, suspended, last_activity_at, last_error, created_at, establishments(name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const setWhatsAppConnectionSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ connection_id: z.string().uuid(), suspended: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("whatsapp_connections")
      .update({ suspended: data.suspended, updated_at: new Date().toISOString() })
      .eq("id", data.connection_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
