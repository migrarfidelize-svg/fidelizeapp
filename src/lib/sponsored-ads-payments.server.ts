/**
 * Cobrança avulsa (one-off) dos anúncios patrocinados via PIX.
 *
 * Server-only: nunca deve ser importado no topo de um módulo alcançável
 * pelo cliente. Todas as funções assumem que o chamador já autorizou o
 * usuário e a campanha.
 */

import { getPublicAppUrl } from "@/lib/app-url";

const MP_API = "https://api.mercadopago.com";

async function mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const { requireMercadoPagoAccessToken } = await import("./mercadopago-credentials.server");
  const token = await requireMercadoPagoAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Fidelize/1.0",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${MP_API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const raw = body?.message ?? body?.error ?? `MP ${res.status}`;
    throw new Error(`Mercado Pago (${res.status}): ${typeof raw === "string" ? raw : JSON.stringify(raw)}`);
  }
  return body;
}

function adsWebhookUrl(): string {
  return `${getPublicAppUrl().replace(/\/$/, "")}/api/public/webhooks/mercadopago`;
}

export type AdPixResult = {
  order_id: string;
  external_payment_id: string;
  status: string;
  amount_cents: number;
  pix_code: string | null;
  pix_qr_code: string | null;
  expires_at: string;
};

/**
 * Cria (ou reaproveita) a cobrança PIX de uma campanha.
 * A campanha precisa estar aprovada e com preço congelado (snapshot).
 */
export async function createAdPixCharge(params: {
  campaignId: string;
  establishmentId: string;
  amountCents: number;
  currency: string;
  packageName: string;
  payerEmail: string;
  expirationMinutes: number;
}): Promise<AdPixResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Reaproveita cobrança viva para não gerar PIX duplicado.
  const { data: existing } = await supabaseAdmin
    .from("sponsored_ad_orders")
    .select("*")
    .eq("campaign_id", params.campaignId)
    .eq("status", "pending")
    .gt("pix_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      order_id: existing.id,
      external_payment_id: existing.external_payment_id ?? "",
      status: existing.status,
      amount_cents: existing.amount_cents,
      pix_code: existing.pix_code,
      pix_qr_code: existing.pix_qr_code,
      expires_at: existing.pix_expires_at ?? "",
    };
  }

  if (!(params.amountCents > 0)) throw new Error("Valor do anúncio inválido.");

  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(5, params.expirationMinutes) * 60_000).toISOString();

  const mp = await mpFetch("/v1/payments", {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      transaction_amount: Number((params.amountCents / 100).toFixed(2)),
      description: `Destaque patrocinado — ${params.packageName}`,
      payment_method_id: "pix",
      date_of_expiration: expiresAt,
      payer: { email: params.payerEmail },
      metadata: {
        kind: "sponsored_ad",
        campaign_id: params.campaignId,
        establishment_id: params.establishmentId,
      },
      notification_url: adsWebhookUrl(),
    }),
  });

  const qr = mp?.point_of_interaction?.transaction_data ?? {};

  const { data: order, error } = await supabaseAdmin
    .from("sponsored_ad_orders")
    .insert({
      campaign_id: params.campaignId,
      establishment_id: params.establishmentId,
      gateway: "mercadopago",
      payment_method: "pix",
      amount_cents: params.amountCents,
      currency: params.currency || "BRL",
      status: "pending",
      gateway_status: mp?.status ?? "pending",
      external_payment_id: String(mp?.id ?? ""),
      idempotency_key: idempotencyKey,
      pix_code: qr.qr_code ?? null,
      pix_qr_code: qr.qr_code_base64 ?? null,
      pix_expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("sponsored_ad_campaigns")
    .update({ status: "payment_pending", updated_at: new Date().toISOString() })
    .eq("id", params.campaignId)
    .eq("status", "approved_awaiting_payment");

  return {
    order_id: order.id,
    external_payment_id: String(mp?.id ?? ""),
    status: "pending",
    amount_cents: params.amountCents,
    pix_code: qr.qr_code ?? null,
    pix_qr_code: qr.qr_code_base64 ?? null,
    expires_at: expiresAt,
  };
}

/**
 * Confirma o pagamento de um anúncio e agenda/ativa a campanha.
 * Idempotente: chamada repetida pelo webhook não duplica período.
 */
export async function settleAdOrderPaid(externalPaymentId: string, gatewayStatus: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: order } = await supabaseAdmin
    .from("sponsored_ad_orders")
    .select("id, campaign_id, status")
    .eq("external_payment_id", externalPaymentId)
    .maybeSingle();
  if (!order) return { handled: false as const };
  if (order.status === "paid") return { handled: true as const, alreadyPaid: true };

  const now = new Date();
  await supabaseAdmin
    .from("sponsored_ad_orders")
    .update({ status: "paid", gateway_status: gatewayStatus, paid_at: now.toISOString() })
    .eq("id", order.id);

  const { data: campaign } = await supabaseAdmin
    .from("sponsored_ad_campaigns")
    .select("id, duration_days_snapshot, requested_start_at, status")
    .eq("id", order.campaign_id)
    .maybeSingle();
  if (!campaign) return { handled: true as const };

  const days = campaign.duration_days_snapshot ?? 7;
  const requested = campaign.requested_start_at ? new Date(campaign.requested_start_at) : null;
  const startsAt = requested && requested.getTime() > now.getTime() ? requested : now;
  const endsAt = new Date(startsAt.getTime() + days * 86_400_000);
  const scheduled = startsAt.getTime() > now.getTime();

  await supabaseAdmin
    .from("sponsored_ad_campaigns")
    .update({
      status: scheduled ? "scheduled" : "active",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", campaign.id);

  await supabaseAdmin.from("sponsored_ad_reviews").insert({
    campaign_id: campaign.id,
    action: "payment_confirmed",
    from_status: campaign.status,
    to_status: scheduled ? "scheduled" : "active",
    note: `Pagamento ${externalPaymentId} confirmado.`,
  });

  return { handled: true as const, campaignId: campaign.id };
}
