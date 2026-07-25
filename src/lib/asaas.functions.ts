import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Wrapper Asaas: chamadas autenticadas usando o access_token do painel
 * (`/admin/integracoes` → Asaas). Nunca lê `process.env` diretamente aqui:
 * fluxo passa por `loadAsaasCredentials`, que já contempla env como fallback.
 */
async function asaasFetch(path: string, init: RequestInit = {}) {
  const { requireAsaasAccessToken } = await import("./asaas-credentials.server");
  const { token, base } = await requireAsaasAccessToken();
  const headers: Record<string, string> = {
    access_token: token,
    "Content-Type": "application/json",
    accept: "application/json",
    "User-Agent": "Fidelize/1.0 (+asaas)",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg =
      body?.errors?.[0]?.description ??
      body?.errors?.[0]?.code ??
      (typeof body === "string" ? body : JSON.stringify(body ?? {})) ??
      `Asaas ${res.status}`;
    throw new Error(`Asaas (${res.status}): ${msg}`);
  }
  return body;
}

/** Testa conexão e devolve dados da conta + ambiente detectado. */
export const testAsaasConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: admin } = await supabase
      .from("app_roles").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
    if (!admin) throw new Error("Apenas o Super Admin pode testar a conexão do Asaas.");

    const { loadAsaasCredentials } = await import("./asaas-credentials.server");
    const creds = await loadAsaasCredentials(true);
    if (!creds.access_token) {
      return { ok: false, mode: creds.mode, message: "ASAAS_ACCESS_TOKEN não configurado no painel." };
    }
    const account = await asaasFetch("/myAccount");
    return {
      ok: true,
      mode: creds.mode,
      account: {
        id: account?.id ?? null,
        name: account?.name ?? null,
        email: account?.email ?? null,
        walletId: account?.walletId ?? null,
      },
    };
  });

/** Garante/cria um customer no Asaas para um estabelecimento (idempotente por CPF/CNPJ). */
async function ensureAsaasCustomer(input: { name: string; email: string; cpfCnpj?: string | null; phone?: string | null }) {
  if (input.cpfCnpj) {
    const list = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}`);
    const found = list?.data?.[0];
    if (found?.id) return found.id as string;
  }
  const created = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj ?? undefined,
      mobilePhone: input.phone ?? undefined,
      notificationDisabled: false,
    }),
  });
  return created.id as string;
}

const createPaymentSchema = z.object({
  planSlug: z.string().min(1),
  establishmentId: z.string().uuid(),
  billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]),
  payer: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    cpfCnpj: z.string().min(11).max(18).optional(),
    phone: z.string().optional(),
  }),
  card: z.object({
    holderName: z.string(),
    number: z.string(),
    expiryMonth: z.string(),
    expiryYear: z.string(),
    ccv: z.string(),
  }).optional(),
});

/** Cria uma cobrança avulsa (PIX / BOLETO / CREDIT_CARD) para o plano indicado. */
export const createAsaasPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => createPaymentSchema.parse(v))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Autorização: apenas owner do estabelecimento.
    const { data: member } = await supabase
      .from("establishment_members")
      .select("role")
      .eq("establishment_id", data.establishmentId)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();
    if (!member || member.role !== "owner") throw new Error("Apenas o dono pode gerar cobranças.");

    const { data: plan } = await supabase
      .from("plans")
      .select("id, slug, tier, name, price_monthly, is_active, archived_at")
      .eq("slug", data.planSlug)
      .maybeSingle();
    if (!plan || !plan.is_active || plan.archived_at) throw new Error("Plano indisponível.");

    const { computeUpgradeCharge } = await import("@/lib/plan-proration.server");
    const quote = await computeUpgradeCharge(data.establishmentId, plan as never);

    const customerId = await ensureAsaasCustomer(data.payer);
    const dueDate = new Date(Date.now() + 3 * 24 * 3600_000).toISOString().slice(0, 10);

    const payload: Record<string, unknown> = {
      customer: customerId,
      billingType: data.billingType,
      value: quote.amount,
      dueDate,
      description: `Assinatura ${plan.name} — Fidelize`,
      externalReference: `est:${data.establishmentId}|plan:${plan.slug}`,
    };
    if (data.billingType === "CREDIT_CARD" && data.card) {
      payload.creditCard = {
        holderName: data.card.holderName,
        number: data.card.number,
        expiryMonth: data.card.expiryMonth,
        expiryYear: data.card.expiryYear,
        ccv: data.card.ccv,
      };
      payload.creditCardHolderInfo = {
        name: data.payer.name,
        email: data.payer.email,
        cpfCnpj: data.payer.cpfCnpj,
        postalCode: "00000000",
        addressNumber: "0",
      };
    }

    const charge = await asaasFetch("/payments", { method: "POST", body: JSON.stringify(payload) });

    let pixQrCode: string | null = null;
    let pixCopyPaste: string | null = null;
    if (data.billingType === "PIX") {
      try {
        const qr = await asaasFetch(`/payments/${charge.id}/pixQrCode`);
        pixQrCode = qr?.encodedImage ? `data:image/png;base64,${qr.encodedImage}` : null;
        pixCopyPaste = qr?.payload ?? null;
      } catch { /* ignore */ }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert({
      establishment_id: data.establishmentId,
      plan_id: plan.id,
      plan_slug: plan.slug,
      provider: "asaas",
      provider_payment_id: String(charge.id),
      amount: quote.amount,
      currency: "BRL",
      method: data.billingType === "PIX" ? "pix" : data.billingType === "BOLETO" ? "boleto" : "credit_card",
      status: mapAsaasStatus(String(charge.status ?? "PENDING")),
      status_detail: charge.status ?? null,
      pix_qr_code_base64: pixQrCode,
      pix_copy_paste: pixCopyPaste,
      boleto_url: charge.bankSlipUrl ?? null,
      receipt_url: charge.invoiceUrl ?? charge.transactionReceiptUrl ?? null,
      payer_email: data.payer.email,
      payer_doc: data.payer.cpfCnpj ?? null,
      raw: charge as never,
    } as never);

    return {
      id: String(charge.id),
      status: charge.status,
      invoiceUrl: charge.invoiceUrl ?? null,
      bankSlipUrl: charge.bankSlipUrl ?? null,
      pixQrCodeBase64: pixQrCode,
      pixCopyPaste,
    };
  });

export function mapAsaasStatus(s: string): "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "chargeback" {
  const u = s.toUpperCase();
  if (u === "CONFIRMED" || u === "RECEIVED" || u === "RECEIVED_IN_CASH") return "approved";
  if (u === "REFUNDED" || u === "REFUND_REQUESTED") return "refunded";
  if (u === "CHARGEBACK_REQUESTED" || u === "CHARGEBACK_DISPUTE" || u === "AWAITING_CHARGEBACK_REVERSAL") return "chargeback";
  if (u === "OVERDUE" || u === "PAYMENT_DELETED" || u === "DELETED") return "cancelled";
  return "pending";
}

export function mapAsaasBillingTypeToMethod(billingType: string): string {
  const u = billingType.toUpperCase();
  if (u === "PIX") return "pix";
  if (u === "BOLETO") return "boleto";
  if (u === "CREDIT_CARD") return "credit_card";
  if (u === "DEBIT_CARD") return "debit_card";
  return u.toLowerCase();
}
