/**
 * Escrita no livro financeiro (append-only). Somente o servidor escreve aqui.
 * Toda entrada carrega `idempotency_key` — reprocessar webhook nunca duplica saldo.
 */

import { feeBreakdown, money, releaseDateFor } from "@/lib/commerce-core";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type EntryInput = {
  establishment_id: string;
  order_id?: string | null;
  payment_id?: string | null;
  withdrawal_id?: string | null;
  entry_type: string;
  direction: "credit" | "debit";
  status: "pending" | "available" | "reserved" | "settled" | "cancelled";
  amount: number;
  settles_to_platform?: boolean;
  description: string;
  available_at?: string | null;
  idempotency_key: string;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
};

/** Insere ignorando conflito de idempotência (webhook repetido = no-op). */
export async function appendLedger(entries: EntryInput[]) {
  if (entries.length === 0) return;
  const db = await admin();
  const { error } = await (db as any)
    .from("establishment_ledger_entries")
    .upsert(
      entries.map((e) => ({
        settles_to_platform: true,
        metadata: {},
        ...e,
        amount: money(e.amount),
      })),
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
  if (error) throw new Error(`Ledger: ${error.message}`);
}

export async function appendOrderEvent(row: {
  order_id: string;
  event_type: string;
  previous_status?: string | null;
  new_status?: string | null;
  actor_user_id?: string | null;
  actor_type?: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const db = await admin();
  await (db as any).from("order_events").insert({ actor_type: "system", metadata: {}, ...row });
}

/**
 * Pagamento online aprovado: credita a venda bruta e debita as taxas,
 * em entradas separadas, com data de liberação configurável.
 */
export async function recordOnlineSaleApproved(params: {
  establishmentId: string;
  orderId: string;
  paymentId: string;
  gross: number;
  deliveryFee: number;
  method: string;
  platformPercent: number;
  gatewayPercent: number;
  releasePixDays: number;
  releaseCardDays: number;
}) {
  const merchandise = money(params.gross - params.deliveryFee);
  const fees = feeBreakdown(merchandise, params.platformPercent, params.gatewayPercent);
  const availableAt = releaseDateFor(params.method, {
    pixDays: params.releasePixDays,
    cardDays: params.releaseCardDays,
  });
  const base = {
    establishment_id: params.establishmentId,
    order_id: params.orderId,
    payment_id: params.paymentId,
    status: "pending" as const,
    available_at: availableAt,
  };

  const entries: EntryInput[] = [
    {
      ...base,
      entry_type: "sale",
      direction: "credit",
      amount: merchandise,
      description: "Venda online aprovada",
      idempotency_key: `sale:${params.paymentId}`,
    },
  ];
  if (params.deliveryFee > 0) {
    entries.push({
      ...base,
      entry_type: "delivery_fee",
      direction: "credit",
      amount: params.deliveryFee,
      description: "Taxa de entrega repassada ao lojista",
      idempotency_key: `delivery:${params.paymentId}`,
    });
  }
  if (fees.platform_fee > 0) {
    entries.push({
      ...base,
      entry_type: "platform_fee",
      direction: "debit",
      amount: fees.platform_fee,
      description: `Taxa Fidelize (${params.platformPercent}%)`,
      idempotency_key: `platfee:${params.paymentId}`,
    });
  }
  if (fees.gateway_fee > 0) {
    entries.push({
      ...base,
      entry_type: "gateway_fee",
      direction: "debit",
      amount: fees.gateway_fee,
      description: `Taxa do gateway (${params.gatewayPercent}%)`,
      idempotency_key: `gwfee:${params.paymentId}`,
    });
  }

  await appendLedger(entries);
  return { ...fees, delivery_fee: params.deliveryFee, available_at: availableAt };
}

/** Venda recebida direto pelo lojista: informativa, nunca sacável. */
export async function recordOfflineSale(params: {
  establishmentId: string;
  orderId: string;
  amount: number;
  method: string | null;
}) {
  await appendLedger([
    {
      establishment_id: params.establishmentId,
      order_id: params.orderId,
      entry_type: "offline_sale_info",
      direction: "credit",
      status: "settled",
      amount: params.amount,
      settles_to_platform: false,
      description: `Venda recebida diretamente pelo lojista${params.method ? ` (${params.method})` : ""}`,
      idempotency_key: `offline:${params.orderId}`,
    },
  ]);
}

/** Reembolso/estorno: sempre entrada compensatória, jamais alteração da original. */
export async function recordRefundOrChargeback(params: {
  establishmentId: string;
  orderId: string;
  paymentId: string;
  amount: number;
  kind: "refund" | "partial_refund" | "chargeback";
}) {
  await appendLedger([
    {
      establishment_id: params.establishmentId,
      order_id: params.orderId,
      payment_id: params.paymentId,
      entry_type: params.kind,
      direction: "debit",
      status: "available",
      amount: params.amount,
      description:
        params.kind === "chargeback" ? "Chargeback recebido do gateway" : "Reembolso ao cliente",
      idempotency_key: `${params.kind}:${params.paymentId}:${money(params.amount)}`,
    },
  ]);
}

/** Saque pago pelo super admin: liquida a reserva. */
export async function recordWithdrawalPaid(params: {
  establishmentId: string;
  withdrawalId: string;
  amount: number;
  actorId: string;
  reference?: string | null;
}) {
  await appendLedger([
    {
      establishment_id: params.establishmentId,
      withdrawal_id: params.withdrawalId,
      entry_type: "withdrawal_paid",
      direction: "debit",
      status: "settled",
      amount: params.amount,
      description: `Saque pago via Pix${params.reference ? ` — ref ${params.reference}` : ""}`,
      idempotency_key: `wd_paid:${params.withdrawalId}`,
      created_by: params.actorId,
    },
  ]);
}

/** Saque recusado/cancelado: devolve o valor reservado ao saldo disponível. */
export async function recordWithdrawalReversed(params: {
  establishmentId: string;
  withdrawalId: string;
  amount: number;
  actorId: string;
  reason: string;
}) {
  await appendLedger([
    {
      establishment_id: params.establishmentId,
      withdrawal_id: params.withdrawalId,
      entry_type: "withdrawal_reversed",
      direction: "credit",
      status: "available",
      amount: params.amount,
      description: `Devolução de saldo reservado — ${params.reason}`,
      idempotency_key: `wd_rev:${params.withdrawalId}`,
      created_by: params.actorId,
    },
  ]);
}

/** Ajuste administrativo auditado (sempre nova entrada, com motivo). */
export async function recordAdminAdjustment(params: {
  establishmentId: string;
  direction: "credit" | "debit";
  amount: number;
  reason: string;
  actorId: string;
}) {
  await appendLedger([
    {
      establishment_id: params.establishmentId,
      entry_type: params.direction === "credit" ? "adjustment_credit" : "adjustment_debit",
      direction: params.direction,
      status: "available",
      amount: params.amount,
      description: `Ajuste administrativo: ${params.reason}`,
      idempotency_key: `adj:${params.establishmentId}:${Date.now()}`,
      created_by: params.actorId,
      metadata: { reason: params.reason },
    },
  ]);
}
