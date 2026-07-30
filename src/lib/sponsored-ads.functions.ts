import { assertActiveSubscription } from "@/lib/subscription-guard";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  AD_DESCRIPTION_MAX,
  AD_TITLE_MAX,
  CTA_LABELS,
  DESTINATION_TYPES,
  canTransition,
  isEditable,
  sanitizeAdText,
  type AdStatus,
} from "@/lib/sponsored-ads-core";

const CREATIVE_TTL = 60 * 60 * 24; // 24h — o painel revalida sozinho.

/** Garante que o usuário pode gerenciar anúncios do estabelecimento. */
async function assertAdsPermission(supabase: any, userId: string, establishmentId: string) {
  const { data, error } = await supabase.rpc("member_can", {
    _user: userId,
    _est: establishmentId,
    _action: "ads.manage",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Você não tem permissão para gerenciar anúncios deste estabelecimento.");
}

async function signCreative(supabase: any, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("sponsored-ads").createSignedUrl(path, CREATIVE_TTL);
  return data?.signedUrl ?? null;
}

// ---------------------------------------------------------------- Leitura

export const getAdsWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);

    const [packagesRes, settingsRes, campaignsRes, estRes] = await Promise.all([
      supabase
        .from("sponsored_ad_packages")
        .select("id, name, description, duration_days, price_cents, currency, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("sponsored_ad_settings")
        .select("allowed_categories, advertiser_terms, advertiser_terms_version, allow_self_pause, self_pause_extends_period, max_ads_per_category")
        .eq("id", true)
        .maybeSingle(),
      supabase
        .from("sponsored_ad_campaigns")
        .select("*")
        .eq("establishment_id", data.establishment_id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("establishments")
        .select("id, name, slug, logo_url, primary_color, city, description, category")
        .eq("id", data.establishment_id)
        .maybeSingle(),
    ]);

    const campaigns = await Promise.all(
      (campaignsRes.data ?? []).map(async (c: any) => ({
        ...c,
        image_url: await signCreative(supabase, c.image_path),
      })),
    );

    const ids = campaigns.map((c: any) => c.id);
    let metrics: Record<string, { impressions: number; clicks: number }> = {};
    if (ids.length) {
      const { data: rows } = await supabase
        .from("sponsored_ad_daily_metrics")
        .select("campaign_id, unique_impressions, unique_clicks")
        .in("campaign_id", ids);
      for (const r of rows ?? []) {
        const acc = (metrics[r.campaign_id] ??= { impressions: 0, clicks: 0 });
        acc.impressions += r.unique_impressions ?? 0;
        acc.clicks += r.unique_clicks ?? 0;
      }
    }

    return {
      packages: packagesRes.data ?? [],
      settings: settingsRes.data ?? null,
      campaigns,
      metrics,
      establishment: estRes.data ?? null,
    };
  });

export const getAdCampaignMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), campaign_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);

    const { data: campaign } = await supabase
      .from("sponsored_ad_campaigns")
      .select("id")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");

    const [daily, reviews, orders] = await Promise.all([
      supabase
        .from("sponsored_ad_daily_metrics")
        .select("metric_date, unique_impressions, unique_clicks")
        .eq("campaign_id", data.campaign_id)
        .order("metric_date", { ascending: true }),
      supabase
        .from("sponsored_ad_reviews")
        .select("action, from_status, to_status, reason, note, created_at")
        .eq("campaign_id", data.campaign_id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("sponsored_ad_orders")
        .select("id, status, amount_cents, currency, payment_method, pix_code, pix_qr_code, pix_expires_at, paid_at, created_at")
        .eq("campaign_id", data.campaign_id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return { daily: daily.data ?? [], reviews: reviews.data ?? [], orders: orders.data ?? [] };
  });

// ---------------------------------------------------------------- Escrita

const upsertSchema = z.object({
  establishment_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  package_id: z.string().uuid(),
  category_id: z.string().min(2).max(40),
  title: z.string().max(200),
  description: z.string().max(400),
  cta_label: z.enum(CTA_LABELS),
  destination_type: z.enum(DESTINATION_TYPES),
  destination_slug: z.string().trim().min(1).max(120),
  image_path: z.string().max(500).nullable().optional(),
  image_source: z.enum(["upload", "logo", "none"]).default("logo"),
  requested_start_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const saveAdCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);

    const { data: settings } = await supabase
      .from("sponsored_ad_settings")
      .select("allowed_categories")
      .eq("id", true)
      .maybeSingle();
    const allowed: string[] = settings?.allowed_categories ?? [];
    if (allowed.length && !allowed.includes(data.category_id)) {
      throw new Error("Esta categoria não está aberta para anúncios no momento.");
    }

    // O criativo só pode apontar para páginas do próprio estabelecimento.
    const { data: est } = await supabase
      .from("establishments")
      .select("slug")
      .eq("id", data.establishment_id)
      .maybeSingle();
    if (!est?.slug || est.slug !== data.destination_slug) {
      throw new Error("O destino do anúncio precisa ser uma página do seu próprio estabelecimento.");
    }

    // A imagem enviada precisa estar na pasta do próprio estabelecimento.
    if (data.image_path && !data.image_path.startsWith(`est_${data.establishment_id}/`)) {
      throw new Error("Arquivo de criativo inválido.");
    }

    const payload = {
      establishment_id: data.establishment_id,
      package_id: data.package_id,
      category_id: data.category_id,
      title: sanitizeAdText(data.title, AD_TITLE_MAX),
      description: sanitizeAdText(data.description, AD_DESCRIPTION_MAX),
      cta_label: data.cta_label,
      destination_type: data.destination_type,
      destination_slug: data.destination_slug,
      image_path: data.image_path ?? null,
      image_source: data.image_source,
      requested_start_at: data.requested_start_at ?? null,
      updated_by: userId,
    };
    if (!payload.title) throw new Error("Informe um título para o anúncio.");

    if (data.id) {
      const { data: current } = await supabase
        .from("sponsored_ad_campaigns")
        .select("status")
        .eq("id", data.id)
        .eq("establishment_id", data.establishment_id)
        .maybeSingle();
      if (!current) throw new Error("Campanha não encontrada.");
      if (!isEditable(current.status as AdStatus)) {
        throw new Error("Esta campanha não pode mais ser editada.");
      }
      const { data: row, error } = await supabase
        .from("sponsored_ad_campaigns")
        .update(payload)
        .eq("id", data.id)
        .eq("establishment_id", data.establishment_id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }

    const { data: row, error } = await supabase
      .from("sponsored_ad_campaigns")
      .insert({ ...payload, created_by: userId, status: "draft" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const submitAdCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        campaign_id: z.string().uuid(),
        accept_terms: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);

    const { data: campaign } = await supabase
      .from("sponsored_ad_campaigns")
      .select("*")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");
    if (!canTransition(campaign.status as AdStatus, "pending_review")) {
      throw new Error("Esta campanha não pode ser enviada para análise agora.");
    }
    if (!campaign.title || !campaign.package_id) {
      throw new Error("Complete o criativo antes de enviar para análise.");
    }

    const { data: settings } = await supabase
      .from("sponsored_ad_settings")
      .select("advertiser_terms_version")
      .eq("id", true)
      .maybeSingle();
    const { data: pkg } = await supabase
      .from("sponsored_ad_packages")
      .select("name, duration_days, price_cents, currency, is_active")
      .eq("id", campaign.package_id)
      .maybeSingle();
    if (!pkg?.is_active) throw new Error("O pacote escolhido não está mais disponível.");

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sponsored_ad_campaigns")
      .update({
        status: "pending_review",
        submitted_at: now,
        changes_requested_reason: null,
        // Congela preço e duração no envio — o valor não muda depois disso.
        package_name_snapshot: pkg.name,
        duration_days_snapshot: pkg.duration_days,
        price_cents_snapshot: pkg.price_cents,
        currency_snapshot: pkg.currency,
        terms_accepted_at: now,
        terms_accepted_by: userId,
        terms_version: settings?.advertiser_terms_version ?? 1,
        updated_by: userId,
      })
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("sponsored_ad_reviews").insert({
      campaign_id: data.campaign_id,
      action: "submitted",
      from_status: campaign.status,
      to_status: "pending_review",
      creative_snapshot: {
        title: campaign.title,
        description: campaign.description,
        cta_label: campaign.cta_label,
        destination_type: campaign.destination_type,
        destination_slug: campaign.destination_slug,
        image_path: campaign.image_path,
      },
    });

    return { ok: true as const };
  });

export const cancelAdCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), campaign_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);
    const { data: campaign } = await supabase
      .from("sponsored_ad_campaigns")
      .select("status")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");
    if (!canTransition(campaign.status as AdStatus, "cancelled")) {
      throw new Error("Campanhas já veiculadas não podem ser canceladas — fale com o suporte.");
    }
    const { error } = await supabase
      .from("sponsored_ad_campaigns")
      .update({ status: "cancelled", updated_by: userId })
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const toggleAdPause = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        campaign_id: z.string().uuid(),
        pause: z.boolean(),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);

    const { data: settings } = await supabase
      .from("sponsored_ad_settings")
      .select("allow_self_pause, self_pause_extends_period")
      .eq("id", true)
      .maybeSingle();
    if (!settings?.allow_self_pause) throw new Error("A pausa pelo anunciante está desativada.");

    const { data: campaign } = await supabase
      .from("sponsored_ad_campaigns")
      .select("status, paused_at, ends_at, total_paused_seconds")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();

    if (data.pause) {
      if (!canTransition(campaign.status as AdStatus, "paused")) throw new Error("Só é possível pausar campanhas no ar.");
      const { error } = await supabaseAdmin
        .from("sponsored_ad_campaigns")
        .update({
          status: "paused",
          paused_at: now.toISOString(),
          pause_origin: "merchant",
          pause_reason: data.reason ?? null,
          updated_by: userId,
        })
        .eq("id", data.campaign_id);
      if (error) throw new Error(error.message);
      return { ok: true as const, status: "paused" as const };
    }

    if (campaign.status !== "paused") throw new Error("Esta campanha não está pausada.");
    const pausedSeconds = campaign.paused_at
      ? Math.max(0, Math.round((now.getTime() - new Date(campaign.paused_at).getTime()) / 1000))
      : 0;
    const extend = settings.self_pause_extends_period && campaign.ends_at;
    const { error } = await supabaseAdmin
      .from("sponsored_ad_campaigns")
      .update({
        status: "active",
        paused_at: null,
        pause_origin: null,
        pause_reason: null,
        total_paused_seconds: (campaign.total_paused_seconds ?? 0) + pausedSeconds,
        ends_at: extend
          ? new Date(new Date(campaign.ends_at as string).getTime() + pausedSeconds * 1000).toISOString()
          : campaign.ends_at,
        updated_by: userId,
      })
      .eq("id", data.campaign_id);
    if (error) throw new Error(error.message);
    return { ok: true as const, status: "active" as const };
  });

// ---------------------------------------------------------------- Pagamento

export const createAdPixOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), campaign_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertActiveSubscription(context.supabase, (data as any).establishment_id);
    const { supabase, userId, claims } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);

    const { data: campaign } = await supabase
      .from("sponsored_ad_campaigns")
      .select("id, status, price_cents_snapshot, currency_snapshot, package_name_snapshot, is_courtesy")
      .eq("id", data.campaign_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!campaign) throw new Error("Campanha não encontrada.");
    if (campaign.is_courtesy) throw new Error("Esta campanha é cortesia e não precisa de pagamento.");
    if (campaign.status !== "approved_awaiting_payment" && campaign.status !== "payment_pending") {
      throw new Error("O pagamento só é liberado depois da aprovação do anúncio.");
    }

    const { data: settings } = await supabase
      .from("sponsored_ad_settings")
      .select("pix_expiration_minutes")
      .eq("id", true)
      .maybeSingle();

    const { createAdPixCharge } = await import("@/lib/sponsored-ads-payments.server");
    return createAdPixCharge({
      campaignId: campaign.id,
      establishmentId: data.establishment_id,
      // O valor vem do snapshot do servidor — nunca do cliente.
      amountCents: campaign.price_cents_snapshot ?? 0,
      currency: campaign.currency_snapshot ?? "BRL",
      packageName: campaign.package_name_snapshot ?? "Destaque",
      payerEmail: claims?.email ?? `anuncios+${data.establishment_id}@fidelize.app`,
      expirationMinutes: settings?.pix_expiration_minutes ?? 30,
    });
  });

export const getAdOrderStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), order_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);
    const { data: order } = await supabase
      .from("sponsored_ad_orders")
      .select("id, status, paid_at, pix_expires_at, campaign_id")
      .eq("id", data.order_id)
      .eq("establishment_id", data.establishment_id)
      .maybeSingle();
    if (!order) throw new Error("Cobrança não encontrada.");
    const { data: campaign } = await supabase
      .from("sponsored_ad_campaigns")
      .select("status, starts_at, ends_at")
      .eq("id", order.campaign_id)
      .maybeSingle();
    return { ...order, campaign_status: campaign?.status ?? null, starts_at: campaign?.starts_at ?? null, ends_at: campaign?.ends_at ?? null };
  });

// ---------------------------------------------------------------- Upload

/** Devolve um caminho seguro para o upload do criativo (pasta do estabelecimento). */
export const getAdCreativeUploadPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), extension: z.enum(["jpg", "jpeg", "png", "webp"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdsPermission(supabase, userId, data.establishment_id);
    return { path: `est_${data.establishment_id}/${crypto.randomUUID()}.${data.extension}` };
  });
