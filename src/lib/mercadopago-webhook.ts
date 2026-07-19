import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify Mercado Pago's `x-signature` header.
 * Manifest template (per MP docs): `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * HMAC-SHA256 with the app's webhook secret, compared as hex in constant time.
 */
export function verifyMercadoPagoSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = opts;
  if (!signatureHeader || !secret) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId ?? ""};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const ALLOWED_STATUSES = new Set([
  "pending", "in_process", "approved", "authorized", "rejected", "cancelled", "refunded", "charged_back",
]);

/** Map MP payment status → our internal payments.status; unknowns fall back to `pending`. */
export function mapMpStatusToPaymentStatus(s: string | undefined | null): string {
  if (!s) return "pending";
  return ALLOWED_STATUSES.has(s) ? s : "pending";
}

/** Map MP payment_type_id → our internal payments.method. */
export function mapMpMethod(paymentTypeId: string | undefined | null): "credit_card" | "boleto" | "pix" {
  if (paymentTypeId === "credit_card") return "credit_card";
  if (paymentTypeId === "ticket") return "boleto";
  return "pix";
}
