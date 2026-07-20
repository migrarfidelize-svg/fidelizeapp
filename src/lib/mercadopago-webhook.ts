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
  /** Máx. idade do timestamp (ms) para bloquear replay. Default: 10min. 0 = desativa. */
  maxAgeMs?: number;
  /** Injeção para testes; default Date.now(). */
  now?: () => number;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = opts;
  const maxAgeMs = opts.maxAgeMs ?? 10 * 60 * 1000;
  const now = opts.now ?? Date.now;
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

  // Replay protection: MP `ts` vem em milissegundos. Rejeita se muito antigo/futuro.
  if (maxAgeMs > 0) {
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum)) return false;
    const delta = Math.abs(now() - tsNum);
    if (delta > maxAgeMs) return false;
  }

  // Per docs do MP, o `data.id` no manifest deve estar em lowercase.
  const idForManifest = (dataId ?? "").toLowerCase();
  const manifest = `id:${idForManifest};request-id:${requestId ?? ""};ts:${ts};`;
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
