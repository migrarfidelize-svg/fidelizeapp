/**
 * Liquidação de pedidos: confirma pagamento, escreve no ledger, concede carimbo
 * e notifica. Chamado apenas pelo servidor (webhook ou conclusão de pedido).
 */

import { money, shouldGrantStamp, type OrderStatus, type PaymentStatus } from "@/lib/commerce-core";
import {
  appendOrderEvent,
  recordOfflineSale,
  recordOnlineSaleApproved,
  recordRefundOrChargeback,
} from "@/lib/commerce-ledger.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getCheckoutSettings(establishmentId: string) {
  const db = await admin();
  const { data } = await db
    .from("establishment_checkout_settings")
    .select("*")
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  return (
    data ?? {
      establishment_id: establishmentId,
      pix_online_enabled: false,
      card_online_enabled: false,
      pay_on_delivery_enabled: true,
      pay_on_pickup_enabled: true,
      cash_enabled: true,
      card_on_delivery_enabled: true,
      pix_on_delivery_enabled: true,
      delivery_enabled: true,
      pickup_enabled: true,
      minimum_order: 0,
      delivery_fee_flat: 0,
      delivery_fee_per_km: 0,
      delivery_radius_km: 10,
      eta_minutes: 45,
      platform_fee_percent: 5,
      gateway_fee_percent: 0.99,
      release_days_pix: 1,
      release_days_card: 14,
      affiliate_discount_percent: 0,
      paused: false,
    }
  );
}

/**
 * Aplica o status vindo do gateway a um pagamento de pedido.
 * Idempotente: reprocessar o mesmo webhook não duplica ledger nem notificação.
 */
export async function applyOrderPaymentStatus(params: {
  provider: string;
  providerPaymentId: string;
  status: PaymentStatus;
  rawStatus?: string | null;
  amount?: number | null;
}) {
  const db = await admin();
  const { data: pay } = await db
    .from("order_payments")
    .select("*")
    .eq("provider", params.provider)
    .eq("provider_payment_id", params.providerPaymentId)
    .maybeSingle();
  if (!pay) return { handled: false as const, reason: "pagamento de pedido não encontrado" };

  const previous: PaymentStatus = pay.status;
  const now = new Date().toISOString();

  // Nunca aceita valor aprovado maior que o cobrado.
  if (params.status === "approved" && params.amount != null && money(params.amount) > money(pay.amount) + 0.01) {
    await appendOrderEvent({
      order_id: pay.order_id,
      event_type: "payment_amount_mismatch",
      reason: `Gateway informou ${params.amount} para uma cobrança de ${pay.amount}`,
    });
    return { handled: false as const, reason: "valor divergente" };
  }

  const patch: Record<string, unknown> = { status: params.status, raw_status: params.rawStatus ?? null };
  if (params.status === "approved") patch.paid_at = pay.paid_at ?? now;
  if (params.status === "rejected") patch.failed_at = now;
  if (params.status === "expired") patch.expired_at = now;
  if (params.status === "cancelled") patch.cancelled_at = now;
  if (params.status === "refunded" || params.status === "partially_refunded") patch.refunded_at = now;
  await db.from("order_payments").update(patch).eq("id", pay.id);

  const { data: order } = await db.from("orders").select("*").eq("id", pay.order_id).maybeSingle();
  if (!order) return { handled: false as const, reason: "pedido não encontrado" };

  await appendOrderEvent({
    order_id: order.id,
    event_type: `payment_${params.status}`,
    previous_status: previous,
    new_status: params.status,
    metadata: { provider: params.provider, provider_payment_id: params.providerPaymentId },
  });

  if (params.status === "approved" && previous !== "approved") {
    const cfg = await getCheckoutSettings(order.establishment_id);
    const fees = await recordOnlineSaleApproved({
      establishmentId: order.establishment_id,
      orderId: order.id,
      paymentId: pay.id,
      gross: Number(order.total ?? 0),
      deliveryFee: Number(order.delivery_fee ?? 0),
      method: pay.payment_method,
      platformPercent: Number(cfg.platform_fee_percent),
      gatewayPercent: Number(cfg.gateway_fee_percent),
      releasePixDays: Number(cfg.release_days_pix),
      releaseCardDays: Number(cfg.release_days_card),
    });

    await db
      .from("orders")
      .update({
        payment_status: "approved",
        paid_at: now,
        status: order.status === "new" ? "confirmed" : order.status,
        platform_fee_total: fees.platform_fee,
        gateway_fee_total: fees.gateway_fee,
        net_to_establishment: money(fees.net + Number(order.delivery_fee ?? 0)),
      })
      .eq("id", order.id);

    try {
      const { notifyOrderEvent } = await import("@/lib/orders-notify.server");
      await notifyOrderEvent({ order_id: order.id, event: "status_changed" });
    } catch {
      /* best-effort */
    }
    await maybeGrantOrderStamp(order.id);
    return { handled: true as const, status: "approved" as const };
  }

  if (params.status === "refunded" || params.status === "partially_refunded" || params.status === "chargeback") {
    const amount = params.amount != null ? money(params.amount) : Number(pay.amount);
    await recordRefundOrChargeback({
      establishmentId: order.establishment_id,
      orderId: order.id,
      paymentId: pay.id,
      amount,
      kind: params.status === "chargeback" ? "chargeback" : params.status,
    });
    await db
      .from("orders")
      .update({ payment_status: params.status, refunded_total: money(Number(order.refunded_total ?? 0) + amount) })
      .eq("id", order.id);
    try {
      const { notifySuperAdminsFinancialAlert } = await import("@/lib/finance-notify.server");
      await notifySuperAdminsFinancialAlert({
        title: params.status === "chargeback" ? "Chargeback recebido" : "Reembolso registrado",
        body: `Pedido #${order.order_number} — R$ ${amount.toFixed(2)}`,
      });
    } catch {
      /* best-effort */
    }
    return { handled: true as const, status: params.status };
  }

  if (["pending", "rejected", "expired", "cancelled"].includes(params.status)) {
    await db.from("orders").update({ payment_status: params.status }).eq("id", order.id);
  }
  return { handled: true as const, status: params.status };
}

/**
 * Concede o carimbo do pedido quando as condições são atendidas.
 * A unicidade em `stamps.order_id` garante idempotência absoluta.
 */
export async function maybeGrantOrderStamp(orderId: string) {
  const db = await admin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { granted: false, reason: "pedido não encontrado" };

  const ok = shouldGrantStamp({
    orderStatus: order.status as OrderStatus,
    paymentStatus: order.payment_status as PaymentStatus,
    settlementMode: order.settlement_mode,
    alreadyGrantedAt: order.stamp_granted_at,
  });
  if (!ok) return { granted: false, reason: "condições não atendidas" };

  const { data: campaign } = await db
    .from("campaigns")
    .select("id, stamps_required, reward_validity_days")
    .eq("establishment_id", order.establishment_id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!campaign) return { granted: false, reason: "sem campanha ativa" };

  // Localiza/cria o cliente da loja a partir do perfil ou telefone.
  let customerId: string | null = order.customer_id ?? null;
  if (!customerId && order.customer_profile_id) {
    const { data: c } = await db
      .from("customers")
      .select("id")
      .eq("establishment_id", order.establishment_id)
      .eq("user_id", order.customer_profile_id)
      .maybeSingle();
    customerId = c?.id ?? null;
  }
  if (!customerId && order.customer_phone) {
    const { data: c } = await db
      .from("customers")
      .select("id")
      .eq("establishment_id", order.establishment_id)
      .eq("phone", order.customer_phone)
      .maybeSingle();
    customerId = c?.id ?? null;
  }
  if (!customerId) return { granted: false, reason: "pedido sem cliente identificado" };

  let { data: card } = await db
    .from("loyalty_cards")
    .select("*")
    .eq("customer_id", customerId)
    .eq("campaign_id", campaign.id)
    .maybeSingle();
  if (!card) {
    const { data: nc } = await db
      .from("loyalty_cards")
      .insert({
        customer_id: customerId,
        campaign_id: campaign.id,
        establishment_id: order.establishment_id,
        stamps: 0,
        cycle: 1,
      })
      .select("*")
      .single();
    card = nc;
  }

  const { error: stampErr } = await db.from("stamps").insert({
    card_id: card.id,
    establishment_id: order.establishment_id,
    cycle: card.cycle,
    order_id: order.id,
  });
  if (stampErr) {
    // 23505 = já existe carimbo para este pedido → idempotente.
    if (String(stampErr.code) === "23505") return { granted: false, reason: "carimbo já concedido" };
    throw new Error(stampErr.message);
  }

  const next = Number(card.stamps) + 1;
  const completed = next >= Number(campaign.stamps_required);
  if (completed) {
    const expires = campaign.reward_validity_days
      ? new Date(Date.now() + Number(campaign.reward_validity_days) * 86400000).toISOString()
      : null;
    await db.from("rewards").insert({
      card_id: card.id,
      campaign_id: campaign.id,
      establishment_id: order.establishment_id,
      cycle: card.cycle,
      expires_at: expires,
    });
    await db.from("loyalty_cards").update({ stamps: 0, cycle: Number(card.cycle) + 1 }).eq("id", card.id);
  } else {
    await db.from("loyalty_cards").update({ stamps: next }).eq("id", card.id);
  }

  await db
    .from("orders")
    .update({ stamp_granted_at: new Date().toISOString(), customer_id: customerId })
    .eq("id", order.id);
  await appendOrderEvent({
    order_id: order.id,
    event_type: "stamp_granted",
    metadata: { card_id: card.id, campaign_id: campaign.id, completed },
  });

  return { granted: true, completed };
}

/** Conclusão do pedido: registra venda offline (informativa) e carimba. */
export async function finalizeOrderCompletion(orderId: string) {
  const db = await admin();
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return;
  if (order.settlement_mode === "on_delivery_direct") {
    await recordOfflineSale({
      establishmentId: order.establishment_id,
      orderId: order.id,
      amount: Number(order.total ?? 0),
      method: order.payment_method,
    });
  }
  await maybeGrantOrderStamp(orderId);
}
