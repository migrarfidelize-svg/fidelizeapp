import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canTransition, type AdStatus } from "@/lib/sponsored-ads-core";

const CREATIVE_TTL = 60 * 60;

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

async function logAudit(userId: string, action: string, meta: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: userId,
    action,
    entity: "sponsored_ad_campaign",
    entity_id: String(meta.campaign_id ?? ""),
    metadata: meta as never,
  } as never);
}

export const adminAdsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("sponsored_ads_admin_overview");
    if (error) throw new Error(error.message);
    return (data ?? {}) as never;
  });

export const adminListAdCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.string().max(40).nullable().optional(),
        search: z.string().trim().max(80).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("sponsored_ad_campaigns")
      .select("*, establishment:establishments(id, name, slug, logo_url, city, primary_color)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const filtered = data.search
      ? (rows ?? []).filter((r: any) =>
          `${r.title} ${r.establishment?.name ?? ""}`.toLowerCase().includes(data.search!.toLowerCase()),
        )
      : (rows ?? []);

    const storage = supabaseAdmin.storage.from("sponsored-ads");
    return Promise.all(
      filtered.map(async (r: any) => {
        let image_url: string | null = null;
        if (r.image_path) {
          const { data: signed } = await storage.createSignedUrl(r.image_path, CREATIVE_TTL);
          image_url = signed?.signedUrl ?? null;
        }
        return { ...r, image_url };
      }),
    );
  });

export const adminReviewAdCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        campaign_id: z.string().uuid(),
        action: z.enum(["approve", "request_changes", "reject", "pause", "resume", "expire"]),
        reason: z.string().trim().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: campaign } = await supabaseAdmin
      .from("sponsored_ad_campaigns")
      .select("id, status, ends_at, paused_at, total_paused_seconds")
      .eq("id", data.campaign_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");

    const from = campaign.status as AdStatus;
    const now = new Date();
    const patch: Record<string, any> = { updated_by: userId, updated_at: now.toISOString() };
    let to: AdStatus;

    switch (data.action) {
      case "approve":
        to = "approved_awaiting_payment";
        patch.approved_at = now.toISOString();
        patch.approved_by = userId;
        patch.changes_requested_reason = null;
        break;
      case "request_changes":
        if (!data.reason) throw new Error("Descreva o que precisa ser ajustado.");
        to = "changes_requested";
        patch.changes_requested_reason = data.reason;
        break;
      case "reject":
        if (!data.reason) throw new Error("Informe o motivo da rejeição.");
        to = "rejected";
        patch.rejected_at = now.toISOString();
        patch.rejected_by = userId;
        patch.rejection_reason = data.reason;
        break;
      case "pause":
        to = "paused";
        patch.paused_at = now.toISOString();
        patch.pause_origin = "admin";
        patch.pause_reason = data.reason ?? null;
        break;
      case "resume": {
        to = "active";
        const pausedSeconds = campaign.paused_at
          ? Math.max(0, Math.round((now.getTime() - new Date(campaign.paused_at).getTime()) / 1000))
          : 0;
        patch.paused_at = null;
        patch.pause_origin = null;
        patch.pause_reason = null;
        patch.total_paused_seconds = (campaign.total_paused_seconds ?? 0) + pausedSeconds;
        if (campaign.ends_at) {
          patch.ends_at = new Date(new Date(campaign.ends_at).getTime() + pausedSeconds * 1000).toISOString();
        }
        break;
      }
      case "expire":
        to = "expired";
        patch.ends_at = now.toISOString();
        break;
    }

    if (!canTransition(from, to)) {
      throw new Error(`Transição inválida: ${from} → ${to}.`);
    }
    patch.status = to;

    const { error } = await supabaseAdmin.from("sponsored_ad_campaigns").update(patch as never).eq("id", data.campaign_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sponsored_ad_reviews").insert({
      campaign_id: data.campaign_id,
      admin_user_id: userId,
      action: data.action,
      from_status: from,
      to_status: to,
      reason: data.reason ?? null,
    });
    await logAudit(userId, `sponsored_ad.${data.action}`, { campaign_id: data.campaign_id, from, to, reason: data.reason });

    return { ok: true as const, status: to };
  });

export const adminGrantCourtesyAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        campaign_id: z.string().uuid(),
        days: z.number().int().min(1).max(90),
        reason: z.string().trim().min(3).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const endsAt = new Date(now.getTime() + data.days * 86_400_000);
    const { error } = await supabaseAdmin
      .from("sponsored_ad_campaigns")
      .update({
        is_courtesy: true,
        courtesy_reason: data.reason,
        status: "active",
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        approved_at: now.toISOString(),
        approved_by: userId,
        price_cents_snapshot: 0,
        duration_days_snapshot: data.days,
        updated_by: userId,
      })
      .eq("id", data.campaign_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("sponsored_ad_reviews").insert({
      campaign_id: data.campaign_id,
      admin_user_id: userId,
      action: "courtesy_granted",
      to_status: "active",
      reason: data.reason,
    });
    await logAudit(userId, "sponsored_ad.courtesy", { campaign_id: data.campaign_id, days: data.days, reason: data.reason });
    return { ok: true as const };
  });

export const adminGetAdsSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [settings, packages] = await Promise.all([
      supabaseAdmin.from("sponsored_ad_settings").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("sponsored_ad_packages").select("*").order("display_order", { ascending: true }),
    ]);
    return { settings: settings.data ?? null, packages: packages.data ?? [] };
  });

export const adminSaveAdsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        max_ads_per_category: z.number().int().min(1).max(10),
        max_impressions_per_session_24h: z.number().int().min(1).max(200),
        impression_dedupe_minutes: z.number().int().min(1).max(720),
        click_dedupe_minutes: z.number().int().min(1).max(720),
        pix_expiration_minutes: z.number().int().min(5).max(1440),
        allow_self_pause: z.boolean(),
        self_pause_extends_period: z.boolean(),
        allowed_categories: z.array(z.string().max(40)).max(30),
        advertiser_terms: z.string().max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await supabaseAdmin
      .from("sponsored_ad_settings")
      .select("advertiser_terms, advertiser_terms_version")
      .eq("id", true)
      .maybeSingle();
    const termsChanged = (current?.advertiser_terms ?? "") !== data.advertiser_terms;

    const { error } = await supabaseAdmin
      .from("sponsored_ad_settings")
      .update({
        ...data,
        advertiser_terms_version: (current?.advertiser_terms_version ?? 1) + (termsChanged ? 1 : 0),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) throw new Error(error.message);
    await logAudit(userId, "sponsored_ad.settings_updated", { terms_changed: termsChanged });
    return { ok: true as const };
  });

export const adminSaveAdPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(60),
        description: z.string().trim().max(200).nullable().optional(),
        duration_days: z.number().int().min(1).max(365),
        price_cents: z.number().int().min(0).max(10_000_000),
        display_order: z.number().int().min(0).max(99).default(0),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data, updated_by: userId, updated_at: new Date().toISOString() };
    if (data.id) {
      const { error } = await supabaseAdmin.from("sponsored_ad_packages").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("sponsored_ad_packages")
        .insert({ ...payload, created_by: userId });
      if (error) throw new Error(error.message);
    }
    await logAudit(userId, "sponsored_ad.package_saved", { name: data.name, price_cents: data.price_cents });
    return { ok: true as const };
  });
