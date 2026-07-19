import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getPublicAppUrl } from "@/lib/app-url";

const MP_API = "https://api.mercadopago.com";

function getAccessToken(): string {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado. Peça ao Super Administrador para configurar a integração.");
  return t;
}

function getPublicKey(): string | null {
  return process.env.MERCADOPAGO_PUBLIC_KEY ?? null;
}

async function mpFetch(path: string, init: RequestInit & { idempotencyKey?: string } = {}) {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  const res = await fetch(`${MP_API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = body?.message ?? body?.error ?? text ?? `MP ${res.status}`;
    throw new Error(`Mercado Pago (${res.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
  }
  return body;
}

async function assertOwner(supabase: any, userId: string, establishmentId: string) {
  const { data } = await supabase.from("establishment_members")
    .select("role").eq("establishment_id", establishmentId).eq("user_id", userId).eq("active", true).maybeSingle();
  if (!data || data.role !== "owner") throw new Error("Apenas o dono da empresa pode gerenciar a assinatura.");
}

async function getPlanOrThrow(supabase: any, slug: string) {
  const { data: plan } = await supabase.from("plans")
    .select("id, slug, tier, name, price_monthly, is_active, archived_at")
    .eq("slug", slug).maybeSingle();
  if (!plan || !plan.is_active || plan.archived_at) throw new Error("Plano indisponível.");
  return plan;
}

// ----------- Public key (client-safe) -----------
export const getMercadoPagoPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { public_key: getPublicKey() };
});

// ----------- PIX -----------
export const createPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    payer_email: z.string().email().optional(),
    payer_doc: z.string().min(6).max(20).optional(),
    payer_first_name: z.string().max(60).optional(),
    payer_last_name: z.string().max(60).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const plan = await getPlanOrThrow(supabase, data.plan_slug);
    const amount = Number(plan.price_monthly ?? 0);
    if (!(amount > 0)) throw new Error("Este plano não é cobrado (grátis) — nada a pagar.");

    const idempotencyKey = crypto.randomUUID();
    const payerEmail = data.payer_email ?? claims?.email ?? `pagador+${data.establishment_id}@fidelize.app`;
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();

    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura ${plan.name} — Fidelize`,
        payment_method_id: "pix",
        date_of_expiration: expiresAt,
        payer: {
          email: payerEmail,
          first_name: data.payer_first_name,
          last_name: data.payer_last_name,
          identification: data.payer_doc ? { type: data.payer_doc.length > 11 ? "CNPJ" : "CPF", number: data.payer_doc.replace(/\D/g, "") } : undefined,
        },
        metadata: {
          establishment_id: data.establishment_id,
          plan_slug: data.plan_slug,
          plan_id: plan.id,
        },
        notification_url: publicWebhookUrl(),
      }),
    });

    const qr = mp?.point_of_interaction?.transaction_data ?? {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishment_id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      mp_payment_id: String(mp.id),
      mp_order_id: mp.order?.id ? String(mp.order.id) : null,
      amount,
      currency: mp.currency_id ?? "BRL",
      method: "pix",
      status: mp.status ?? "pending",
      status_detail: mp.status_detail ?? null,
      pix_qr_code: qr.qr_code ?? null,
      pix_qr_code_base64: qr.qr_code_base64 ?? null,
      pix_copy_paste: qr.qr_code ?? null,
      pix_expires_at: expiresAt,
      payer_email: payerEmail,
      payer_doc: data.payer_doc ?? null,
      idempotency_key: idempotencyKey,
      raw: mp,
    } as never);

    return {
      mp_payment_id: String(mp.id),
      status: mp.status as string,
      amount,
      qr_code: qr.qr_code ?? null,
      qr_code_base64: qr.qr_code_base64 ?? null,
      ticket_url: qr.ticket_url ?? null,
      expires_at: expiresAt,
    };
  });

// ----------- Cartão de crédito -----------
export const createCardPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    token: z.string().min(10),                       // gerado pelo SDK no browser
    payment_method_id: z.string().min(2),            // ex: 'visa','master'
    installments: z.number().int().min(1).max(12),
    issuer_id: z.string().optional(),
    payer_email: z.string().email(),
    payer_doc_type: z.enum(["CPF","CNPJ"]).default("CPF"),
    payer_doc_number: z.string().min(6).max(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const plan = await getPlanOrThrow(supabase, data.plan_slug);
    const amount = Number(plan.price_monthly ?? 0);
    if (!(amount > 0)) throw new Error("Este plano não é cobrado (grátis) — nada a pagar.");

    const idempotencyKey = crypto.randomUUID();

    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura ${plan.name} — Fidelize`,
        token: data.token,
        installments: data.installments,
        payment_method_id: data.payment_method_id,
        issuer_id: data.issuer_id,
        payer: {
          email: data.payer_email,
          identification: { type: data.payer_doc_type, number: data.payer_doc_number.replace(/\D/g, "") },
        },
        statement_descriptor: "FIDELIZE",
        metadata: {
          establishment_id: data.establishment_id,
          plan_slug: data.plan_slug,
          plan_id: plan.id,
        },
        notification_url: publicWebhookUrl(),
      }),
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishment_id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      mp_payment_id: String(mp.id),
      mp_order_id: mp.order?.id ? String(mp.order.id) : null,
      amount,
      currency: mp.currency_id ?? "BRL",
      method: "credit_card",
      status: mp.status ?? "pending",
      status_detail: mp.status_detail ?? null,
      card_last4: mp.card?.last_four_digits ?? null,
      card_brand: mp.payment_method_id ?? null,
      installments: data.installments,
      payer_email: data.payer_email,
      payer_doc: data.payer_doc_number,
      idempotency_key: idempotencyKey,
      raw: mp,
    } as never);

    return {
      mp_payment_id: String(mp.id),
      status: mp.status as string,
      status_detail: mp.status_detail as string,
      amount,
    };
  });

// ----------- Boleto -----------
export const createBoletoPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    plan_slug: z.string().min(1),
    payer_email: z.string().email(),
    payer_first_name: z.string().max(60),
    payer_last_name: z.string().max(60),
    payer_doc_number: z.string().min(11).max(14),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const plan = await getPlanOrThrow(supabase, data.plan_slug);
    const amount = Number(plan.price_monthly ?? 0);
    if (!(amount > 0)) throw new Error("Este plano não é cobrado (grátis).");

    const idempotencyKey = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 24 * 3600_000).toISOString();

    const mp = await mpFetch("/v1/payments", {
      method: "POST",
      idempotencyKey,
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Assinatura ${plan.name} — Fidelize`,
        payment_method_id: "bolbradesco",
        date_of_expiration: expiresAt,
        payer: {
          email: data.payer_email,
          first_name: data.payer_first_name,
          last_name: data.payer_last_name,
          identification: { type: data.payer_doc_number.length > 11 ? "CNPJ" : "CPF", number: data.payer_doc_number.replace(/\D/g, "") },
        },
        metadata: {
          establishment_id: data.establishment_id,
          plan_slug: data.plan_slug,
          plan_id: plan.id,
        },
        notification_url: publicWebhookUrl(),
      }),
    });

    const boletoUrl = mp?.transaction_details?.external_resource_url ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishment_id,
      plan_id: plan.id,
      plan_slug: plan.slug,
      mp_payment_id: String(mp.id),
      amount,
      currency: mp.currency_id ?? "BRL",
      method: "boleto",
      status: mp.status ?? "pending",
      status_detail: mp.status_detail ?? null,
      boleto_url: boletoUrl,
      pix_expires_at: expiresAt,
      payer_email: data.payer_email,
      payer_doc: data.payer_doc_number,
      idempotency_key: idempotencyKey,
      raw: mp,
    } as never);

    return { mp_payment_id: String(mp.id), status: mp.status, boleto_url: boletoUrl, expires_at: expiresAt, amount };
  });

// ----------- Status polling -----------
export const getPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    mp_payment_id: z.string().min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // valida acesso ao pagamento (RLS)
    const { data: pay } = await supabase.from("payments")
      .select("id, establishment_id, status, method, amount, plan_slug, receipt_url, pix_qr_code, pix_qr_code_base64, pix_copy_paste, pix_expires_at, boleto_url, mp_payment_id")
      .eq("mp_payment_id", data.mp_payment_id).maybeSingle();
    if (!pay) throw new Error("Pagamento não encontrado.");
    await assertOwner(supabase, userId, pay.establishment_id);

    // consulta autoritativa no MP
    const mp = await mpFetch(`/v1/payments/${data.mp_payment_id}`);
    // atualiza status espelho (o webhook é a fonte da verdade para ativar plano)
    if (mp.status && mp.status !== pay.status) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payments").update({
        status: mp.status,
        status_detail: mp.status_detail ?? null,
        raw: mp,
        approved_at: mp.status === "approved" ? new Date().toISOString() : null,
        receipt_url: mp?.transaction_details?.external_resource_url ?? pay.receipt_url,
      } as never).eq("id", pay.id);
    }
    return {
      mp_payment_id: String(mp.id),
      status: mp.status,
      status_detail: mp.status_detail,
      amount: mp.transaction_amount,
    };
  });

// ----------- Histórico -----------
export const listMyPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(25),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("payments")
      .select("*", { count: "exact" })
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false });
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const fromIdx = (data.page - 1) * data.page_size;
    const toIdx = fromIdx + data.page_size - 1;
    const { data: rows, count } = await q.range(fromIdx, toIdx);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// ----------- Cancelar assinatura -----------
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase, userId, data.establishment_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({
      status: "cancelled",
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
    } as never).eq("establishment_id", data.establishment_id);
    await supabase.from("audit_logs").insert({
      establishment_id: data.establishment_id,
      user_id: userId,
      action: "subscription_cancelled",
      entity_type: "subscription",
      entity_id: data.establishment_id,
      metadata: { at: new Date().toISOString() } as never,
    });
    return { ok: true };
  });

// ----------- Admin: test connection -----------
export const adminTestMercadoPagoConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Apenas Super Administradores podem testar.");
    try {
      const me = await mpFetch("/users/me");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payment_settings").update({
        last_tested_at: new Date().toISOString(),
        last_test_status: "ok",
        last_test_message: `Conectado como ${me.nickname ?? me.email ?? me.id}`,
        webhook_url: publicWebhookUrl(),
      } as never).neq("id", "00000000-0000-0000-0000-000000000000");
      return { ok: true, account: { id: me.id, email: me.email, nickname: me.nickname, site_id: me.site_id, live_mode: !me.tags?.includes("test_user") } };
    } catch (e: any) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payment_settings").update({
        last_tested_at: new Date().toISOString(),
        last_test_status: "error",
        last_test_message: e?.message ?? String(e),
      } as never).neq("id", "00000000-0000-0000-0000-000000000000");
      throw e;
    }
  });

export const adminGetPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { data } = await supabase.from("payment_settings").select("*").order("created_at").limit(1).maybeSingle();
    const hasToken = !!process.env.MERCADOPAGO_ACCESS_TOKEN;
    const hasSecret = !!process.env.MERCADOPAGO_WEBHOOK_SECRET;
    return {
      settings: data,
      webhook_url: publicWebhookUrl(),
      credentials: {
        has_access_token: hasToken,
        has_webhook_secret: hasSecret,
        has_public_key: !!process.env.MERCADOPAGO_PUBLIC_KEY,
      },
    };
  });

export const adminUpdatePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    environment: z.enum(["sandbox","production"]),
    public_key: z.string().max(200).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payment_settings").update({
      environment: data.environment,
      public_key: data.public_key ?? null,
      webhook_url: publicWebhookUrl(),
    } as never).neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });

function publicWebhookUrl(): string {
  return `${getPublicAppUrl()}/api/public/webhooks/mercadopago`;
}

// ----------- Admin: recommended webhook events -----------
export const RECOMMENDED_MP_EVENTS: Array<{ key: string; label: string; required: boolean; description: string }> = [
  { key: "payment", label: "Pagamentos (payment)", required: true, description: "Cobre PIX, cartão e boleto — indispensável para ativar planos após aprovação." },
  { key: "merchant_order", label: "Ordens (merchant_order)", required: true, description: "Reconciliação de pedidos (útil para renovações e estornos parciais)." },
  { key: "subscription_preapproval", label: "Assinaturas recorrentes (opcional)", required: false, description: "Só habilite quando migrar para preapproval/recorrência automática." },
  { key: "chargebacks", label: "Chargebacks (opcional)", required: false, description: "Recebe eventos de contestação; recomendado ativar em produção." },
];

export const adminGetWebhookGuide = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    return { events: RECOMMENDED_MP_EVENTS, webhook_url: publicWebhookUrl() };
  });

// ----------- Admin: webhook delivery logs -----------
export const adminListWebhookLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    page: z.number().int().min(1).default(1),
    page_size: z.number().int().min(1).max(100).default(50),
    only_errors: z.boolean().default(false),
    event_type: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("payment_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (data.only_errors) q = q.not("error", "is", null);
    if (data.event_type) q = q.eq("event_type", data.event_type);
    const from = (data.page - 1) * data.page_size;
    const to = from + data.page_size - 1;
    const { data: rows, count } = await q.range(from, to);
    return { rows: rows ?? [], total: count ?? 0, page: data.page, page_size: data.page_size };
  });

// ----------- Admin: validate webhook URL (handshake) -----------
export const adminValidateWebhookUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Sem permissão.");
    const url = publicWebhookUrl();
    const started = Date.now();
    const result: {
      url: string; ok: boolean; status: number | null; latency_ms: number;
      https: boolean; reachable: boolean; message: string; body_snippet?: string | null;
    } = { url, ok: false, status: null, latency_ms: 0, https: url.startsWith("https://"), reachable: false, message: "" };

    if (!result.https) {
      result.message = "URL não é HTTPS. Mercado Pago exige HTTPS público (localhost não é aceito).";
      return result;
    }
    try {
      const res = await fetch(url, { method: "GET", headers: { "user-agent": "Fidelize-Webhook-Handshake/1.0" } });
      const text = await res.text();
      result.status = res.status;
      result.reachable = true;
      result.latency_ms = Date.now() - started;
      result.body_snippet = text.slice(0, 200);
      result.ok = res.status >= 200 && res.status < 300;
      result.message = result.ok
        ? `Endpoint respondeu ${res.status} em ${result.latency_ms}ms. Pronto para o Mercado Pago.`
        : res.status === 404
          ? `Endpoint respondeu 404. A URL configurada (${url}) provavelmente ainda não está publicada — publique o app ou aponte PUBLIC_APP_URL para a URL de preview (…-dev.lovable.app).`
          : `Endpoint respondeu ${res.status}. Verifique se a rota está publicada.`;
    } catch (e: any) {
      result.latency_ms = Date.now() - started;
      result.message = `Falha ao alcançar o endpoint: ${e?.message ?? String(e)}. Publique o app antes de validar o webhook em produção.`;
    }

    // Auditar handshake
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "mp_webhook_handshake",
        entity_type: "payment_settings",
        metadata: { url, ok: result.ok, status: result.status, latency_ms: result.latency_ms } as never,
      } as never);
    } catch { /* noop */ }

    return result;
  });

