import { createFileRoute } from "@tanstack/react-router";
import { verifyMercadoPagoSignature, mapMpStatusToPaymentStatus, mapMpMethod } from "@/lib/mercadopago-webhook";

// Webhook oficial do Mercado Pago.
// Ref: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
//
// Validação de assinatura (obrigatória em produção):
//   Header: x-signature: ts=<timestamp>,v1=<hex_hmac_sha256>
//   Header: x-request-id: <uuid>
//   Query:  data.id=<resource_id>
//   Template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
//   Chave HMAC = MERCADOPAGO_WEBHOOK_SECRET (segredo da assinatura da app)
//
// A rota está sob /api/public/*, portanto passa o gate de autenticação:
// segurança vem da validação HMAC + consulta autoritativa no MP com Access Token.

const MP_API = "https://api.mercadopago.com";

async function fetchPaymentFromMP(paymentId: string, accessToken: string) {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MP GET /v1/payments/${paymentId} ${res.status}: ${text}`);
  return JSON.parse(text) as any;
}




async function processPaymentEvent(paymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

  const mp = await fetchPaymentFromMP(paymentId, accessToken);

  // Localiza pagamento no banco (foi criado no ato do createPix/Card)
  const { data: pay } = await supabaseAdmin
    .from("payments")
    .select("id, establishment_id, plan_id, plan_slug, subscription_id, status")
    .eq("mp_payment_id", String(mp.id))
    .maybeSingle();

  const newStatus = mapMpStatusToPaymentStatus(mp.status);
  const approvedAt = newStatus === "approved" ? new Date().toISOString() : null;

  const updatePayload: any = {
    status: newStatus,
    status_detail: mp.status_detail ?? null,
    mp_order_id: mp.order?.id ? String(mp.order.id) : null,
    raw: mp,
    updated_at: new Date().toISOString(),
  };
  if (approvedAt) updatePayload.approved_at = approvedAt;
  if (mp.transaction_details?.external_resource_url) updatePayload.receipt_url = mp.transaction_details.external_resource_url;

  if (pay) {
    await supabaseAdmin.from("payments").update(updatePayload).eq("id", pay.id);
  } else {
    // Fallback: pagamento chegou pelo webhook sem registro prévio (raro; ex: cobrança externa) — grava mesmo assim.
    await supabaseAdmin.from("payments").insert({
      mp_payment_id: String(mp.id),
      amount: mp.transaction_amount ?? 0,
      currency: mp.currency_id ?? "BRL",
      method: mp.payment_type_id === "credit_card" ? "credit_card" : mp.payment_type_id === "ticket" ? "boleto" : "pix",
      status: newStatus,
      status_detail: mp.status_detail ?? null,
      payer_email: mp.payer?.email ?? null,
      establishment_id: mp.metadata?.establishment_id ?? null,
      plan_slug: mp.metadata?.plan_slug ?? null,
      raw: mp,
    });
  }

  // Se aprovado, ativa o plano pela metadata do MP (fonte da verdade).
  if (newStatus === "approved") {
    const estId: string | null = pay?.establishment_id ?? mp.metadata?.establishment_id ?? null;
    const planSlug: string | null = pay?.plan_slug ?? mp.metadata?.plan_slug ?? null;
    if (estId && planSlug) {
      await activatePlan(estId, planSlug, String(mp.id));
    }
  }
}

async function activatePlan(establishmentId: string, planSlug: string, mpPaymentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("id, tier, name, price_monthly")
    .eq("slug", planSlug)
    .maybeSingle();
  if (!plan) return;

  const { data: est } = await supabaseAdmin
    .from("establishments")
    .select("id, name, plan")
    .eq("id", establishmentId)
    .maybeSingle();
  if (!est) return;

  const fromTier = est.plan as string;
  const toTier = plan.tier as string;

  await supabaseAdmin.from("establishments").update({ plan: toTier as any }).eq("id", establishmentId);

  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  const { data: existingSub } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  const subPayload: any = {
    plan_id: plan.id,
    tier: toTier as any,
    status: "active",
    provider: "mercadopago",
    current_period_start: now.toISOString(),
    current_period_end: nextMonth.toISOString(),
    next_billing_date: nextMonth.toISOString(),
    mp_last_payment_id: mpPaymentId,
    cancel_at_period_end: false,
  };

  let subscriptionId: string | null = null;
  if (existingSub) {
    subscriptionId = existingSub.id;
    await supabaseAdmin.from("subscriptions").update(subPayload).eq("id", existingSub.id);
  } else {
    const { data: newSub } = await supabaseAdmin
      .from("subscriptions")
      .insert({ establishment_id: establishmentId, ...subPayload })
      .select("id")
      .maybeSingle();
    subscriptionId = newSub?.id ?? null;
  }

  if (subscriptionId) {
    await supabaseAdmin.from("payments")
      .update({ subscription_id: subscriptionId, plan_id: plan.id })
      .eq("mp_payment_id", mpPaymentId);
  }

  // Audit
  await supabaseAdmin.from("audit_logs").insert({
    establishment_id: establishmentId,
    action: fromTier === toTier ? "subscription_renewed" : "plan_activated",
    entity_type: "subscription",
    entity_id: establishmentId,
    metadata: { from_plan: fromTier, to_plan: toTier, mp_payment_id: mpPaymentId, provider: "mercadopago" } as any,
  });

  // Enfileira e-mail de confirmação (Resend via email_queue)
  const { data: owner } = await supabaseAdmin
    .from("establishment_members")
    .select("user_id")
    .eq("establishment_id", establishmentId)
    .eq("role", "owner")
    .eq("active", true)
    .maybeSingle();
  let ownerEmail: string | null = null;
  if (owner?.user_id) {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
    ownerEmail = u?.user?.email ?? null;
  }
  if (ownerEmail) {
    await supabaseAdmin.from("email_queue").insert({
      to_email: ownerEmail,
      subject: `Pagamento aprovado — Plano ${plan.name}`,
      html: `<p>Olá!</p><p>Recebemos seu pagamento e o plano <strong>${plan.name}</strong> já está ativo em <strong>${est.name}</strong>.</p><p>Próxima cobrança: ${nextMonth.toLocaleDateString("pt-BR")}</p><p>Obrigado por usar a Fidelize!</p>`,
      status: "queued",
      metadata: { kind: "payment_approved", establishment_id: establishmentId, plan_slug: planSlug, mp_payment_id: mpPaymentId } as never,
    } as never);
  }
}

async function logWebhook(row: {
  event_type: string;
  mp_resource: string | null;
  mp_id: string | null;
  action: string | null;
  live_mode: boolean | null;
  signature_valid: boolean;
  processed: boolean;
  error: string | null;
  payload: any;
  headers: any;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_logs").insert(row);
  } catch (e) {
    console.error("payment_logs insert failed", e);
  }
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  server: {
    handlers: {
      GET: async () => new Response("Mercado Pago webhook OK", { status: 200 }),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const rawBody = await request.text();
        const requestId = request.headers.get("x-request-id");
        const signatureHeader = request.headers.get("x-signature");
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "";

        // Parse body
        let body: any = {};
        try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }

        const eventType: string = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "unknown";
        const dataId: string | null =
          body?.data?.id?.toString() ??
          url.searchParams.get("data.id") ??
          url.searchParams.get("id") ??
          null;
        const action: string | null = body?.action ?? null;

        const signatureValid = verifyMercadoPagoSignature({
          signatureHeader, requestId, dataId, secret,
        });

        // Log everything up front
        const logRow = {
          event_type: eventType,
          mp_resource: eventType,
          mp_id: dataId,
          action,
          live_mode: typeof body?.live_mode === "boolean" ? body.live_mode : null,
          signature_valid: signatureValid,
          processed: false,
          error: null as string | null,
          payload: body,
          headers: {
            "x-request-id": requestId,
            "x-signature": signatureHeader ? "present" : null,
            "user-agent": request.headers.get("user-agent"),
          },
        };

        // Se secret está configurado e assinatura inválida, rejeita (produção).
        if (secret && !signatureValid) {
          await logWebhook({ ...logRow, error: "invalid_signature" });
          return new Response("invalid signature", { status: 401 });
        }

        try {
          if ((eventType === "payment" || eventType.startsWith("payment")) && dataId) {
            await processPaymentEvent(dataId);
          }
          // merchant_order / subscription: apenas logamos por enquanto
          await logWebhook({ ...logRow, processed: true });
          return new Response("ok", { status: 200 });
        } catch (e: any) {
          await logWebhook({ ...logRow, error: e?.message ?? String(e) });
          // Retorna 200 para não gerar loop de retry em erro nosso; auditoria fica em payment_logs.
          return new Response("logged", { status: 200 });
        }
      },
    },
  },
});
