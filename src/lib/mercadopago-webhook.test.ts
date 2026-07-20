import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyMercadoPagoSignature,
  mapMpStatusToPaymentStatus,
  mapMpMethod,
  classifyMercadoPagoRequest,
} from "@/lib/mercadopago-webhook";

const SECRET = "test_webhook_secret_123";

function signManifest(dataId: string, requestId: string, ts: string, secret = SECRET) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return `ts=${ts},v1=${v1}`;
}

// Testes desativam replay guard (maxAgeMs: 0) exceto onde exigido.
const noReplay = { maxAgeMs: 0 };

describe("verifyMercadoPagoSignature", () => {
  it("accepts a well-formed signature matching the manifest", () => {
    const dataId = "1234567890";
    const requestId = "abcd-1234";
    const ts = "1737300000";
    const header = signManifest(dataId, requestId, ts);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret: SECRET, ...noReplay }),
    ).toBe(true);
  });

  it("normaliza data.id para lowercase antes de verificar", () => {
    const requestId = "abcd-1234";
    const ts = "1737300000";
    // Assinatura gerada com id lowercase; header recebido com id em uppercase → ainda válido.
    const header = signManifest("abc123", requestId, ts);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId: "ABC123", secret: SECRET, ...noReplay }),
    ).toBe(true);
  });

  it("rejects when the payload id is tampered with", () => {
    const requestId = "abcd-1234";
    const ts = "1737300000";
    const header = signManifest("1234567890", requestId, ts);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId: "9999999999", secret: SECRET, ...noReplay }),
    ).toBe(false);
  });

  it("rejects when signed with a different secret", () => {
    const dataId = "1", requestId = "r", ts = "10";
    const header = signManifest(dataId, requestId, ts, "other_secret");
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret: SECRET, ...noReplay }),
    ).toBe(false);
  });

  it("rejects when the signature header is missing pieces", () => {
    expect(verifyMercadoPagoSignature({ signatureHeader: null, requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: "ts=1", requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: "v1=abc", requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
  });

  it("rejects when secret is empty (production safety)", () => {
    const header = signManifest("1", "r", "10");
    expect(verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: "", ...noReplay })).toBe(false);
  });

  it("tolerates additional key/value pairs in the header", () => {
    const dataId = "1", requestId = "r", ts = "10";
    const v1 = createHmac("sha256", SECRET).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
    const header = `ts=${ts},v1=${v1},extra=zzz`;
    expect(verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret: SECRET, ...noReplay })).toBe(true);
  });

  it("does not crash on invalid hex in v1", () => {
    const header = "ts=1,v1=zzznothex";
    expect(verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: SECRET, ...noReplay })).toBe(false);
  });

  it("rejeita ts fora da janela (replay guard)", () => {
    const now = 1_737_300_000_000;
    const stale = String(now - 30 * 60 * 1000); // 30 min no passado
    const header = signManifest("1", "r", stale);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: SECRET, now: () => now }),
    ).toBe(false);
  });

  it("aceita ts dentro da janela padrão", () => {
    const now = 1_737_300_000_000;
    const ts = String(now - 60 * 1000); // 1 min atrás
    const header = signManifest("1", "r", ts);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId: "r", dataId: "1", secret: SECRET, now: () => now }),
    ).toBe(true);
  });
});

describe("mapMpStatusToPaymentStatus (billing state machine)", () => {
  it.each([
    ["pending"], ["in_process"], ["approved"], ["authorized"],
    ["rejected"], ["cancelled"], ["refunded"], ["charged_back"],
  ])("passes through canonical status %s", (s) => {
    expect(mapMpStatusToPaymentStatus(s)).toBe(s);
  });

  it("falls back to pending for unknown / missing status", () => {
    expect(mapMpStatusToPaymentStatus("wobble")).toBe("pending");
    expect(mapMpStatusToPaymentStatus(null)).toBe("pending");
    expect(mapMpStatusToPaymentStatus(undefined)).toBe("pending");
  });
});

describe("mapMpMethod", () => {
  it("maps credit_card / ticket / everything else", () => {
    expect(mapMpMethod("credit_card")).toBe("credit_card");
    expect(mapMpMethod("ticket")).toBe("boleto");
    expect(mapMpMethod("pix")).toBe("pix");
    expect(mapMpMethod(undefined)).toBe("pix");
  });
});
