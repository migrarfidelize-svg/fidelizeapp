/**
 * Cobrança PIX de pedidos de consumidor (distinta da cobrança de assinatura).
 * Server-only: só pode ser importada dentro de handlers.
 */

import { getPublicAppUrl } from "@/lib/app-url";
import { money } from "@/lib/commerce-core";

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

function webhookUrl() {
  return `${getPublicAppUrl().replace(/\/$/, "")}/api/public/webhooks/mercadopago`;
}

export type OrderPixCharge = {
  payment_id: string;
  provider_payment_id: string;
  status: string;
  amount: number;
  qr_code: string | null;
  qr_code_base64: string | null;
  ticket_url: string | null;
  expires_at: string;
};

/**
 * Cria (ou reaproveita) a cobrança PIX de um pedido.
 * Reaproveitar evita PIX duplicado em clique duplo/refresh.
 */
export async function createOrderPixCharge(params: {
  orderId: string;
  establishmentId: string;
  customerProfileId: string;
  amount: number;
  payerEmail: string;
  description: string;
  expirationMinutes?: number;
}): Promise<OrderPixCharge> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: alive } = await db
    .from("order_payments")
    .select("*")
    .eq("order_id", params.orderId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (alive) {
    return {
      payment_id: alive.id,
      provider_payment_id: alive.provider_payment_id ?? "",
      status: alive.status,
      amount: Number(alive.amount),
      qr_code: alive.qr_code,
      qr_code_base64: alive.qr_code_base64,
      ticket_url: alive.ticket_url,
      expires_at: alive.expires_at,
    };
  }

  const amount = money(params.amount);
  if (!(amount > 0)) throw new Error("Valor do pedido inválido para cobrança PIX.");

  const idempotencyKey = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Math.max(5, params.expirationMinutes ?? 30) * 60_000).toISOString();

  const mp = await mpFetch("/v1/payments", {
    method: "POST",
    idempotencyKey,
    body: JSON.stringify({
      transaction_amount: amount,
      description: params.description.slice(0, 120),
      payment_method_id: "pix",
      date_of_expiration: expiresAt,
      payer: { email: params.payerEmail },
      external_reference: `order:${params.orderId}`,
      metadata: {
        kind: "customer_order",
        order_id: params.orderId,
        establishment_id: params.establishmentId,
      },
      notification_url: webhookUrl(),
    }),
  });

  const qr = mp?.point_of_interaction?.transaction_data ?? {};
  const { data: row, error } = await db
    .from("order_payments")
    .insert({
      order_id: params.orderId,
      establishment_id: params.establishmentId,
      customer_profile_id: params.customerProfileId,
      provider: "mercadopago",
      provider_payment_id: String(mp?.id ?? ""),
      payment_method: "pix",
      status: "pending",
      amount,
      currency: mp?.currency_id ?? "BRL",
      external_reference: `order:${params.orderId}`,
      idempotency_key: idempotencyKey,
      raw_status: mp?.status ?? "pending",
      qr_code: qr.qr_code ?? null,
      qr_code_base64: qr.qr_code_base64 ?? null,
      ticket_url: mp?.point_of_interaction?.transaction_data?.ticket_url ?? null,
      expires_at: expiresAt,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await db.from("orders").update({ payment_status: "pending" }).eq("id", params.orderId);

  return {
    payment_id: row.id,
    provider_payment_id: String(mp?.id ?? ""),
    status: "pending",
    amount,
    qr_code: qr.qr_code ?? null,
    qr_code_base64: qr.qr_code_base64 ?? null,
    ticket_url: mp?.point_of_interaction?.transaction_data?.ticket_url ?? null,
    expires_at: expiresAt,
  };
}
