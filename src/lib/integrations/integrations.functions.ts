import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider, providerCatalog } from "./registry";
import type { IntegrationCategory, IntegrationRuntimeConfig } from "./types";
import { resolveWebhooks } from "./webhooks";
import { PROVIDER_GUIDES } from "./docs";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

async function safeAudit(supabaseAdmin: any, row: Record<string, unknown>) {
  try { await (supabaseAdmin as any).from("audit_logs").insert(row); } catch { /* audit best-effort */ }
}

/**
 * Serializa credenciais para o cliente ocultando o valor. Retornamos apenas
 * `{ field: { set: boolean, masked: string | null } }`. Nunca devolver texto puro.
 */
function maskCredentials(credentials: Record<string, unknown> | null | undefined) {
  const out: Record<string, { set: boolean; masked: string | null }> = {};
  if (!credentials || typeof credentials !== "object") return out;
  for (const [k, v] of Object.entries(credentials)) {
    const s = v == null ? "" : String(v);
    if (!s) { out[k] = { set: false, masked: null }; continue; }
    const tail = s.length <= 4 ? s : `••••${s.slice(-4)}`;
    out[k] = { set: true, masked: tail };
  }
  return out;
}

/** Catálogo estático (metadados + guias) — seguro para o cliente. */
export const listIntegrationCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return providerCatalog().map((m) => ({ ...m, guide: PROVIDER_GUIDES[m.id] ?? null }));
  });

/** Webhooks do sistema com URL absoluta pronta para copiar. */
export const listWebhooks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return resolveWebhooks();
  });

/** Lista todas as integrações salvas + máscara de secrets/credenciais. */
export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("integrations")
      .select("id, category, provider, enabled, mode, config, credentials_ref, last_test_status, last_test_message, last_tested_at, last_test_details, created_at, updated_at, updated_by")
      .order("category")
      .order("provider");
    if (error) throw new Error(error.message);

    // Carregar credenciais separadamente via admin (RLS oculta do authenticated)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: credRows } = await (supabaseAdmin as any)
      .from("integrations")
      .select("id, credentials");
    const credMap = new Map<string, Record<string, unknown>>();
    (credRows ?? []).forEach((r: any) => credMap.set(r.id, r.credentials ?? {}));

    const rows = (data ?? []) as any[];
    return rows.map((row) => {
      const refs = (row.credentials_ref ?? {}) as Record<string, string>;
      const secretStatus: Record<string, boolean> = {};
      for (const [field, envName] of Object.entries(refs)) {
        secretStatus[field] = Boolean(process.env[envName]);
      }
      const dbCreds = credMap.get(row.id) ?? {};
      // Marca "set" se estiver no DB OU se env já tiver valor
      const credMasked = maskCredentials(dbCreds);
      for (const [field, envName] of Object.entries(refs)) {
        if (!credMasked[field]?.set && process.env[envName]) {
          credMasked[field] = { set: true, masked: "•••• (env)" };
        }
      }
      return { ...row, secret_status: secretStatus, credentials_masked: credMasked };
    });
  });

/** Histórico de auditoria da integração. */
export const listIntegrationHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ integration_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: rows } = await (context.supabase as any)
      .from("audit_logs")
      .select("id, action, actor_id, metadata, created_at")
      .eq("target_type", "integration")
      .eq("target_id", data.integration_id)
      .order("created_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

const UpsertInput = z.object({
  category: z.enum(["ai", "payments"]),
  provider: z.string().min(1),
  enabled: z.boolean().optional(),
  mode: z.enum(["sandbox", "production"]).nullable().optional(),
  config: z.record(z.string(), z.any()).optional(),
  credentials_ref: z.record(z.string(), z.string()).optional(),
});

export const upsertIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const provider = getProvider(data.category as IntegrationCategory, data.provider);

    // Validação de campos obrigatórios não-secretos + tipos (url/number)
    if (data.config) {
      for (const f of provider.meta.fields) {
        if (f.kind === "secret") continue;
        const v = (data.config as any)[f.name];
        if (f.required && (v === undefined || v === null || v === "")) {
          throw new Error(`Campo obrigatório ausente: ${f.label}`);
        }
        if (v == null || v === "") continue;
        if (f.kind === "url" && !/^https?:\/\/.+/i.test(String(v))) {
          throw new Error(`URL inválida no campo ${f.label}: use http(s)://...`);
        }
        if (f.kind === "number" && Number.isNaN(Number(v))) {
          throw new Error(`Número inválido no campo ${f.label}.`);
        }
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = { category: data.category, provider: data.provider, updated_by: context.userId };
    if (data.enabled !== undefined) payload.enabled = data.enabled;
    if (data.mode !== undefined) payload.mode = data.mode;
    if (data.config !== undefined) payload.config = data.config;
    if (data.credentials_ref !== undefined) payload.credentials_ref = data.credentials_ref;

    const { data: row, error } = await (supabaseAdmin as any)
      .from("integrations")
      .upsert(payload, { onConflict: "category,provider" })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await safeAudit(supabaseAdmin, {
      actor_id: context.userId,
      action: "integration.upsert",
      target_type: "integration",
      target_id: row?.id,
      metadata: { category: data.category, provider: data.provider, enabled: data.enabled, mode: data.mode, config_keys: Object.keys(data.config ?? {}) },
    });
    return row;
  });

const CredentialsInput = z.object({
  category: z.enum(["ai", "payments"]),
  provider: z.string(),
  // { field_name: value } — se value === "" mantém, se null remove.
  credentials: z.record(z.string(), z.union([z.string(), z.null()])),
});

/** Salva credenciais editadas manualmente pelo admin (persistidas no DB, backend-only). */
export const saveIntegrationCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CredentialsInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const provider = getProvider(data.category as IntegrationCategory, data.provider);
    const allowed = new Set(provider.meta.fields.filter((f) => f.kind === "secret" || f.kind === "password").map((f) => f.name));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await (supabaseAdmin as any)
      .from("integrations")
      .select("id, credentials")
      .eq("category", data.category)
      .eq("provider", data.provider)
      .maybeSingle();

    const merged: Record<string, string> = { ...(existing?.credentials ?? {}) };
    const changedFields: string[] = [];
    for (const [k, v] of Object.entries(data.credentials)) {
      if (!allowed.has(k)) throw new Error(`Campo de credencial desconhecido: ${k}`);
      if (v === null || v === "") { delete merged[k]; changedFields.push(`-${k}`); }
      else {
        if (String(v).length > 4096) throw new Error(`Valor muito longo para ${k}.`);
        merged[k] = String(v);
        changedFields.push(k);
      }
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("integrations")
      .upsert({ category: data.category, provider: data.provider, credentials: merged, updated_by: context.userId }, { onConflict: "category,provider" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Invalida cache in-memory de credenciais MP (5s TTL) para refletir imediatamente.
    if (data.category === "payments" && data.provider === "mercadopago") {
      try {
        const { invalidateMercadoPagoCredentialsCache } = await import("@/lib/mercadopago-credentials.server");
        invalidateMercadoPagoCredentialsCache();
      } catch { /* noop */ }
    }

    await safeAudit(supabaseAdmin, {
      actor_id: context.userId,
      action: "integration.credentials.update",
      target_type: "integration",
      target_id: row?.id,
      metadata: { category: data.category, provider: data.provider, changed: changedFields },
    });
    return { ok: true };
  });

const ToggleInput = z.object({
  category: z.enum(["ai", "payments"]),
  provider: z.string(),
  enabled: z.boolean(),
});
export const toggleIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ToggleInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("integrations")
      .upsert({ category: data.category, provider: data.provider, enabled: data.enabled, updated_by: context.userId }, { onConflict: "category,provider" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await safeAudit(supabaseAdmin, {
      actor_id: context.userId,
      action: data.enabled ? "integration.enable" : "integration.disable",
      target_type: "integration",
      target_id: row?.id,
      metadata: { category: data.category, provider: data.provider },
    });
    return row;
  });

const TestInput = z.object({
  category: z.enum(["ai", "payments"]),
  provider: z.string(),
});
export const testIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TestInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const provider = getProvider(data.category as IntegrationCategory, data.provider);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("integrations")
      .select("*")
      .eq("category", data.category)
      .eq("provider", data.provider)
      .maybeSingle();

    const runtime: IntegrationRuntimeConfig = {
      enabled: (row as any)?.enabled ?? false,
      mode: (((row as any)?.mode as "sandbox" | "production" | null) ?? "production"),
      config: ((row as any)?.config ?? {}) as Record<string, unknown>,
      credentials_ref: ((row as any)?.credentials_ref ?? {}) as Record<string, string>,
    };
    for (const f of provider.meta.fields) {
      if (f.kind === "secret" && f.secretName && !runtime.credentials_ref[f.name]) {
        runtime.credentials_ref[f.name] = f.secretName;
      }
    }

    // Mescla credenciais salvas no DB no "env" passado ao provider,
    // priorizando o valor do DB sobre process.env.
    const dbCreds = ((row as any)?.credentials ?? {}) as Record<string, string>;
    const mergedEnv: Record<string, string | undefined> = { ...(process.env as Record<string, string | undefined>) };
    for (const [field, envName] of Object.entries(runtime.credentials_ref)) {
      const v = dbCreds[field];
      if (v) mergedEnv[envName] = v;
    }

    const startedAt = new Date().toISOString();
    const result = await provider.testConnection(runtime, mergedEnv);
    const details = {
      ok: result.ok,
      status: result.status ?? null,
      latency_ms: result.latency_ms ?? null,
      message: result.message,
      endpoint: (result.details as any)?.endpoint ?? null,
      environment: runtime.mode,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      extra: result.details ?? null,
    };

    await (supabaseAdmin as any)
      .from("integrations")
      .upsert({
        category: data.category,
        provider: data.provider,
        last_test_status: result.ok ? "ok" : "error",
        last_test_message: result.message,
        last_tested_at: new Date().toISOString(),
        last_test_details: details,
        updated_by: context.userId,
      }, { onConflict: "category,provider" });

    await safeAudit(supabaseAdmin, {
      actor_id: context.userId,
      action: "integration.test",
      target_type: "integration",
      target_id: (row as any)?.id ?? null,
      metadata: { category: data.category, provider: data.provider, ok: result.ok, status: result.status ?? null, latency_ms: result.latency_ms ?? null },
    });

    return { ...result, details };
  });
