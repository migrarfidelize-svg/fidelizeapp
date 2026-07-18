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
  name: z.string().min(2).max(80),
  description: z.string().max(400).nullable().optional(),
  price_monthly: z.number().min(0).nullable().optional(),
  price_yearly: z.number().min(0).nullable().optional(),
  customer_limit: z.number().int().min(0).nullable().optional(),
  employee_limit: z.number().int().min(0).nullable().optional(),
  campaign_limit: z.number().int().min(0).nullable().optional(),
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
    // strip undefined; keep nulls (except for price_monthly which is non-null in schema)
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

// ---------- Admin: toggle a feature on a plan ----------
export const adminToggleFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    plan_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
    feature_name: z.string().min(1).max(120),
    enabled: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { data: upsert, error } = await context.supabase.from("plan_features")
      .upsert({
        plan_id: data.plan_id,
        feature_key: data.feature_key,
        feature_name: data.feature_name,
        enabled: data.enabled,
      }, { onConflict: "plan_id,feature_key" })
      .select("*").single();
    if (error) throw new Error(error.message);
    return upsert;
  });

// ---------- Merchant: change plan (upgrade / downgrade) ----------
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };

export const changeEstablishmentPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only owner can change billing plans
    const { data: role } = await supabase.from("establishment_members")
      .select("role").eq("establishment_id", data.establishment_id).eq("user_id", userId).maybeSingle();
    if (!role || role.role !== "owner") throw new Error("Apenas o dono da empresa pode alterar o plano.");

    const { data: est } = await supabase.from("establishments")
      .select("id, name, plan").eq("id", data.establishment_id).maybeSingle();
    if (!est) throw new Error("Empresa não encontrada.");

    const { data: newPlan } = await supabase.from("plans")
      .select("id, tier, slug, name, price_monthly, is_active, archived_at")
      .eq("slug", data.plan_slug).maybeSingle();
    if (!newPlan || !newPlan.is_active || newPlan.archived_at) throw new Error("Plano indisponível.");

    const fromTier: string = est.plan;
    const toTier: string = newPlan.tier;
    if (fromTier === toTier) {
      return { ok: true, unchanged: true, tier: toTier as any, kind: "same" as const };
    }

    const fromRank = PLAN_RANK[fromTier] ?? 0;
    const toRank = PLAN_RANK[toTier] ?? 0;
    const kind: "upgrade" | "downgrade" | "plan_change" =
      toRank > fromRank ? "upgrade" : toRank < fromRank ? "downgrade" : "plan_change";

    // 1) Update establishment plan (trigger tg_establishment_subscription_events logs a subscription_events row automatically with actor_id = auth.uid())
    const { error: updErr } = await supabase.from("establishments")
      .update({ plan: toTier }).eq("id", data.establishment_id);
    if (updErr) throw new Error(updErr.message);

    // 2) Upsert current subscription row (subscriptions table). RLS only exposes SELECT to members, so we use the admin client after ownership was verified above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const { data: existingSub } = await supabaseAdmin.from("subscriptions")
      .select("id").eq("establishment_id", data.establishment_id).maybeSingle();

    if (existingSub) {
      await supabaseAdmin.from("subscriptions").update({
        plan_id: newPlan.id,
        tier: toTier as any,
        status: "active",
        provider: "manual",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        metadata: { last_change_by: userId, last_change_kind: kind, last_change_at: now.toISOString() } as never,
      }).eq("id", existingSub.id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        establishment_id: data.establishment_id,
        plan_id: newPlan.id,
        tier: toTier as any,
        status: "active",
        provider: "manual",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        metadata: { created_by: userId, created_kind: kind } as never,
      });
    }

    // 3) Enrich the subscription_events row the trigger just wrote (add human message + actor for audit clarity).
    // Trigger message is generic; we replace with an intent-rich one when possible.
    const nice = `${kind === "upgrade" ? "Upgrade" : kind === "downgrade" ? "Downgrade" : "Alteração"} de plano: ${fromTier} → ${toTier} realizado pelo dono da empresa.`;
    await supabaseAdmin.from("subscription_events")
      .update({ message: nice, actor_id: userId })
      .eq("establishment_id", data.establishment_id)
      .eq("from_plan", fromTier)
      .eq("to_plan", toTier)
      .is("acknowledged_at", null)
      .gte("created_at", new Date(now.getTime() - 60_000).toISOString());

    // 4) Audit log
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      action: kind === "upgrade" ? "plan_upgrade" : kind === "downgrade" ? "plan_downgrade" : "plan_change",
      entity_type: "subscription",
      entity_id: data.establishment_id,
      metadata: { from_plan: fromTier, to_plan: toTier, plan_id: newPlan.id, plan_name: newPlan.name } as never,
    });

    return { ok: true, tier: toTier as any, kind, from: fromTier, to: toTier, plan_name: newPlan.name };
  });

// ---------- Feature gating (backend) ----------
export async function hasFeature(supabase: any, establishmentId: string, featureKey: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_plan_feature", { _est: establishmentId, _feature: featureKey });
  if (error) return false;
  return !!data;
}

const FEATURE_LABELS: Record<string, string> = {
  customer_import: "Importação de clientes (CSV)",
  customer_export: "Exportação de clientes",
  csv_pdf_export: "Exportação CSV / PDF",
  auto_campaigns: "Campanhas automáticas",
  advanced_reports: "Relatórios avançados",
  api: "Acesso à API",
  webhooks: "Webhooks",
  custom_branding: "Personalização de marca",
  custom_stamp_icons: "Ícones de carimbo personalizados",
  multi_units: "Múltiplas unidades",
  email_marketing: "E-mail marketing",
  whatsapp_notifications: "Notificações via WhatsApp",
};

export async function assertFeature(supabase: any, establishmentId: string, featureKey: string) {
  const ok = await hasFeature(supabase, establishmentId, featureKey);
  if (!ok) {
    const label = FEATURE_LABELS[featureKey] ?? featureKey;
    throw new Error(`Recurso indisponível no seu plano: ${label}. Faça upgrade em /app/planos para liberar.`);
  }
}

// Client-callable feature check (used to hide/disable UI)
export const checkMyFeature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    feature_key: z.string().min(1).max(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const ok = await hasFeature(context.supabase, data.establishment_id, data.feature_key);
    return { allowed: ok, feature_key: data.feature_key };
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
