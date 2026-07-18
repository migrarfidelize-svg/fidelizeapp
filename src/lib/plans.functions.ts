import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Types ----------
export type PlanRow = {
  id: string;
  tier: string;
  slug: string;
  name: string;
  description: string | null;
  price_monthly: number | null;
  price_yearly: number | null;
  currency: string;
  customer_limit: number | null;
  employee_limit: number | null;
  campaign_limit: number | null;
  unit_limit: number | null;
  stamp_limit: number | null;
  email_limit: number | null;
  storage_limit_mb: number | null;
  ticket_limit: number | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  trial_days: number;
  button_text: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlanFeature = {
  id: string;
  plan_id: string;
  feature_key: string;
  feature_name: string;
  enabled: boolean;
  limit_value: number | null;
};

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("app_roles").select("id").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores da plataforma.");
}

// ---------- Public: list active plans (marketing + merchant view) ----------
export const listActivePlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: plans, error } = await supabase.from("plans")
      .select("*").eq("is_active", true).order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (plans ?? []).map((p: any) => p.id);
    const { data: features } = ids.length
      ? await supabase.from("plan_features").select("*").in("plan_id", ids).eq("enabled", true)
      : { data: [] as PlanFeature[] };
    const byPlan = new Map<string, PlanFeature[]>();
    for (const f of (features ?? []) as PlanFeature[]) {
      const arr = byPlan.get(f.plan_id) ?? [];
      arr.push(f);
      byPlan.set(f.plan_id, arr);
    }
    return (plans as PlanRow[]).map(p => ({ ...p, features: byPlan.get(p.id) ?? [] }));
  });

// ---------- Admin: list ALL plans ----------
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: plans, error } = await context.supabase.from("plans")
      .select("*").order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (plans ?? []).map((p: any) => p.id);
    const { data: features } = ids.length
      ? await context.supabase.from("plan_features").select("*").in("plan_id", ids)
      : { data: [] as PlanFeature[] };
    const byPlan = new Map<string, PlanFeature[]>();
    for (const f of (features ?? []) as PlanFeature[]) {
      const arr = byPlan.get(f.plan_id) ?? [];
      arr.push(f);
      byPlan.set(f.plan_id, arr);
    }
    // count subscribers per tier
    const { data: subs } = await context.supabase.from("establishments").select("plan");
    const subsByTier = new Map<string, number>();
    for (const s of subs ?? []) {
      subsByTier.set(s.plan, (subsByTier.get(s.plan) ?? 0) + 1);
    }
    return (plans as PlanRow[]).map(p => ({
      ...p,
      features: byPlan.get(p.id) ?? [],
      subscribers: subsByTier.get(p.tier) ?? 0,
    }));
  });

// ---------- Admin: update plan basic fields ----------
const planUpdateSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "slug inválido").optional(),
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(400).nullable().optional(),
  currency: z.string().min(3).max(3).optional(),
  price_monthly: z.number().min(0).nullable().optional(),
  price_yearly: z.number().min(0).nullable().optional(),
  customer_limit: z.number().int().min(0).nullable().optional(),
  employee_limit: z.number().int().min(0).nullable().optional(),
  campaign_limit: z.number().int().min(0).nullable().optional(),
  unit_limit: z.number().int().min(0).nullable().optional(),
  stamp_limit: z.number().int().min(0).nullable().optional(),
  email_limit: z.number().int().min(0).nullable().optional(),
  storage_limit_mb: z.number().int().min(0).nullable().optional(),
  ticket_limit: z.number().int().min(0).nullable().optional(),
  is_featured: z.boolean().optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  button_text: z.string().max(40).nullable().optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
});

export const adminUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { id, ...patch } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (k === "price_monthly" && v === null) continue;
      clean[k] = v;
    }
    const { data: upd, error } = await context.supabase.from("plans")
      .update(clean as any).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return upd;
  });

// ---------- Admin: create a new plan ----------
export const adminCreatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    tier: z.enum(["free", "starter", "pro", "enterprise"]),
    slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2).max(80),
    price_monthly: z.number().min(0).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: created, error } = await context.supabase.from("plans")
      .insert({ tier: data.tier, slug: data.slug, name: data.name, price_monthly: data.price_monthly, currency: "BRL", is_active: true, display_order: 99 })
      .select("*").single();
    if (error) throw new Error(error.message);
    return created;
  });

// ---------- Admin: archive/unarchive plan ----------
export const adminArchivePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("plans")
      .update({ archived_at: data.archived ? new Date().toISOString() : null, is_active: !data.archived })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: delete a feature from a plan ----------
export const adminDeleteFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("plan_features").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: toggle/upsert a feature on a plan ----------
export const adminToggleFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    plan_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
    feature_name: z.string().min(1).max(120),
    enabled: z.boolean(),
    limit_value: z.number().int().min(0).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const payload: any = {
      plan_id: data.plan_id,
      feature_key: data.feature_key,
      feature_name: data.feature_name,
      enabled: data.enabled,
    };
    if (data.limit_value !== undefined) payload.limit_value = data.limit_value;
    const { data: upsert, error } = await context.supabase.from("plan_features")
      .upsert(payload, { onConflict: "plan_id,feature_key" })
      .select("*").single();
    if (error) throw new Error(error.message);
    return upsert;
  });


// ---------- Merchant: change plan for their own establishment ----------
export const changeEstablishmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // check ownership
    const { data: role } = await supabase.from("establishment_members")
      .select("role").eq("establishment_id", data.establishment_id).eq("user_id", context.userId).maybeSingle();
    if (!role || !["owner", "manager"].includes(role.role)) throw new Error("Sem permissão para alterar o plano.");
    const { data: plan } = await supabase.from("plans").select("id, tier, slug, is_active").eq("slug", data.plan_slug).maybeSingle();
    if (!plan || !plan.is_active) throw new Error("Plano indisponível.");
    const { error } = await supabase.from("establishments")
      .update({ plan: plan.tier }).eq("id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true, tier: plan.tier };
  });

// ---------- Usage vs limits ----------
export const getMyPlanUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: est } = await supabase.from("establishments").select("plan").eq("id", data.establishment_id).maybeSingle();
    if (!est) throw new Error("Empresa não encontrada.");
    const { data: plan } = await supabase.from("plans").select("*").eq("tier", est.plan).maybeSingle();
    const [{ count: customers }, { count: campaigns }, { count: employees }] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("establishment_id", data.establishment_id),
      supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("establishment_id", data.establishment_id),
      supabase.from("establishment_members").select("id", { count: "exact", head: true }).eq("establishment_id", data.establishment_id).eq("active", true),
    ]);
    return {
      plan: plan as PlanRow | null,
      usage: {
        customers: customers ?? 0,
        campaigns: campaigns ?? 0,
        employees: employees ?? 0,
      },
    };
  });

// ---------- Internal helper: enforce a limit ----------
// Not a server fn — imported by other server fns (loyalty.functions.ts).
export async function enforceLimit(
  supabase: any,
  establishmentId: string,
  kind: "customers" | "campaigns" | "employees",
  incrementBy = 1,
) {
  const { data: est } = await supabase.from("establishments").select("plan").eq("id", establishmentId).maybeSingle();
  if (!est) throw new Error("Empresa não encontrada.");
  const { data: plan } = await supabase.from("plans").select("customer_limit, campaign_limit, employee_limit, name").eq("tier", est.plan).maybeSingle();
  if (!plan) return; // no plan row → don't block
  const table = kind === "customers" ? "customers" : kind === "campaigns" ? "campaigns" : "establishment_members";
  const limit = kind === "customers" ? plan.customer_limit : kind === "campaigns" ? plan.campaign_limit : plan.employee_limit;
  if (limit === null || limit === undefined) return; // ilimitado
  let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("establishment_id", establishmentId);
  if (table === "establishment_members") query = query.eq("active", true);
  const { count } = await query;
  const current = count ?? 0;
  if (current + incrementBy > limit) {
    const label = kind === "customers" ? "clientes" : kind === "campaigns" ? "campanhas" : "funcionários";
    throw new Error(`Limite do plano ${plan.name} atingido: ${limit} ${label}. Faça upgrade para adicionar mais.`);
  }
}
