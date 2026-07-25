import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles")
    .select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}

export const adminListFeatureOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    feature_key: z.string().min(1).max(60).optional(),
    establishment_id: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("establishment_feature_overrides")
      .select("id, establishment_id, feature_key, enabled, note, expires_at, created_at, updated_at, establishments(id, name, slug, plan, active)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.feature_key) q = q.eq("feature_key", data.feature_key);
    if (data.establishment_id) q = q.eq("establishment_id", data.establishment_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSetFeatureOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
    enabled: z.boolean(),
    note: z.string().max(300).optional().nullable(),
    expires_at: z.string().datetime().optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("establishment_feature_overrides")
      .upsert({
        establishment_id: data.establishment_id,
        feature_key: data.feature_key,
        enabled: data.enabled,
        note: data.note ?? null,
        expires_at: data.expires_at ?? null,
        granted_by: context.userId,
      }, { onConflict: "establishment_id,feature_key" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { override: row };
  });

export const adminRemoveFeatureOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("establishment_feature_overrides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
