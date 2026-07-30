/**
 * Lógica pura do webhook do Asaas — sem I/O, para ser testável isoladamente.
 * A rota `/api/public/webhooks/asaas` consome estas funções.
 */

export type AsaasAuthDecision =
  | { ok: true; signatureValid: boolean }
  | { ok: false; status: number; error: string; reason: string };

/**
 * Autoriza o webhook. Se o admin configurou um `webhook_token`, exigimos match
 * exato do header `asaas-access-token`. Sem token configurado, aceitamos e
 * marcamos a assinatura como não verificada (fica registrado em payment_logs).
 */
export function authorizeAsaasWebhook(params: {
  expectedToken: string | null | undefined;
  providedToken: string | null | undefined;
}): AsaasAuthDecision {
  const expected = params.expectedToken?.trim() || null;
  const provided = params.providedToken?.trim() || null;

  if (!expected) return { ok: true, signatureValid: false };
  if (!provided || provided !== expected) {
    return {
      ok: false,
      status: 401,
      error: "invalid_asaas_token",
      reason: "Header asaas-access-token ausente ou diferente do configurado no painel.",
    };
  }
  return { ok: true, signatureValid: true };
}

/** externalReference: "est:<uuid>|plan:<slug>" */
export function parseAsaasExternalReference(
  ref: unknown,
): { establishmentId: string; planSlug: string } | null {
  const m = String(ref ?? "").match(/est:([0-9a-f-]{8,})\|plan:([\w-]+)/i);
  if (!m || !m[1] || !m[2]) return null;
  return { establishmentId: m[1], planSlug: m[2] };
}

/** Só eventos PAYMENT_* com id de cobrança têm reconciliação dedicada. */
export function isReconcilableAsaasEvent(event: string, paymentId: string | null): boolean {
  return !!paymentId && event.startsWith("PAYMENT_");
}

/** Período de assinatura mensal a partir de `now` (mesmo dia do mês seguinte). */
export function buildSubscriptionPeriod(now: Date = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
  return { start: now.toISOString(), end: end.toISOString() };
}

/**
 * Idempotência: ativa o plano em toda aprovação (é idempotente no banco),
 * mas só notifica venda quando a cobrança ainda não estava aprovada.
 */
export function decidePaymentTransition(params: {
  previousStatus: string | null | undefined;
  newStatus: string;
  establishmentId: string | null;
  planSlug: string | null;
}) {
  const approved = params.newStatus === "approved";
  const canActivate = approved && !!params.establishmentId && !!params.planSlug;
  return {
    shouldActivate: canActivate,
    shouldNotifySale: approved && params.previousStatus !== "approved",
  };
}
