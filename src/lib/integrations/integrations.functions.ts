import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getProvider, providerCatalog } from "./registry";
import type { IntegrationCategory, IntegrationRuntimeConfig } from "./types";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

async function safeAudit(supabaseAdmin: any, row: Record<string, unknown>) {
  try { await (supabaseAdmin as any).from("audit_logs").insert(row); } catch { /* audit best-effort */ }
}

/** Catálogo estático (metadados) — seguro para o cliente. */
export const listIntegrationCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    return providerCatalog();
  });

/** Lista todas as integrações salvas + estado dos secrets referenciados. */
export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("integrations")
      .select("*")
      .order("category")
      .order("provider");
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as any[];
    return rows.map((row) => {
      const refs = (row.credentials_ref ?? {}) as Record<string, string>;
      const secretStatus: Record<string, boolean> = {};
      for (const [field, envName] of Object.entries(refs)) {
        secretStatus[field] = Boolean(process.env[envName]);
      }
      return { ...row, secret_status: secretStatus };
    });
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
    getProvider(data.category as IntegrationCategory, data.provider);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: Record<string, unknown> = { category: data.category, provider: data.provider };
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
      metadata: { category: data.category, provider: data.provider, enabled: data.enabled, mode: data.mode },
    });
    return row;
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
      .upsert({ category: data.category, provider: data.provider, enabled: data.enabled }, { onConflict: "category,provider" })
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

    const result = await provider.testConnection(runtime, process.env as Record<string, string | undefined>);

    await (supabaseAdmin as any)
      .from("integrations")
      .upsert({
        category: data.category,
        provider: data.provider,
        last_test_status: result.ok ? "ok" : "error",
        last_test_message: result.message,
        last_tested_at: new Date().toISOString(),
      }, { onConflict: "category,provider" });

    await safeAudit(supabaseAdmin, {
      actor_id: context.userId,
      action: "integration.test",
      target_type: "integration",
      target_id: (row as any)?.id ?? null,
      metadata: { category: data.category, provider: data.provider, ok: result.ok, status: result.status ?? null, latency_ms: result.latency_ms ?? null },
    });

    return result;
  });
