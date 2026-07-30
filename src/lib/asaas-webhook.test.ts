import { describe, expect, it } from "vitest";
import {
  authorizeAsaasWebhook,
  buildSubscriptionPeriod,
  decidePaymentTransition,
  isReconcilableAsaasEvent,
  parseAsaasExternalReference,
} from "./asaas-webhook";
import { mapAsaasStatus, mapAsaasBillingTypeToMethod } from "./asaas.functions";

describe("authorizeAsaasWebhook", () => {
  it("rejeita quando o token configurado não bate", () => {
    const r = authorizeAsaasWebhook({ expectedToken: "abc", providedToken: "xyz" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("rejeita quando o header está ausente", () => {
    expect(authorizeAsaasWebhook({ expectedToken: "abc", providedToken: null }).ok).toBe(false);
  });

  it("aceita com token correto e marca assinatura válida", () => {
    const r = authorizeAsaasWebhook({ expectedToken: "abc", providedToken: " abc " });
    expect(r).toEqual({ ok: true, signatureValid: true });
  });

  it("aceita sem token configurado, porém sem validar assinatura", () => {
    expect(authorizeAsaasWebhook({ expectedToken: null, providedToken: null })).toEqual({
      ok: true,
      signatureValid: false,
    });
  });
});

describe("parseAsaasExternalReference", () => {
  it("extrai estabelecimento e plano", () => {
    expect(parseAsaasExternalReference("est:11111111-2222-3333-4444-555555555555|plan:premium")).toEqual({
      establishmentId: "11111111-2222-3333-4444-555555555555",
      planSlug: "premium",
    });
  });

  it("retorna null para referência inválida", () => {
    expect(parseAsaasExternalReference("qualquer coisa")).toBeNull();
    expect(parseAsaasExternalReference(undefined)).toBeNull();
  });
});

describe("isReconcilableAsaasEvent", () => {
  it("aceita PAYMENT_* com id", () => {
    expect(isReconcilableAsaasEvent("PAYMENT_CONFIRMED", "pay_1")).toBe(true);
  });
  it("ignora eventos sem id ou fora de PAYMENT_*", () => {
    expect(isReconcilableAsaasEvent("PAYMENT_CONFIRMED", null)).toBe(false);
    expect(isReconcilableAsaasEvent("TRANSFER_CREATED", "pay_1")).toBe(false);
  });
});

describe("mapeamento de status/método", () => {
  it("mapeia o ciclo completo de cobrança", () => {
    expect(mapAsaasStatus("PENDING")).toBe("pending");
    expect(mapAsaasStatus("CONFIRMED")).toBe("approved");
    expect(mapAsaasStatus("RECEIVED")).toBe("approved");
    expect(mapAsaasStatus("OVERDUE")).toBe("cancelled");
    expect(mapAsaasStatus("REFUNDED")).toBe("refunded");
    expect(mapAsaasStatus("CHARGEBACK_DISPUTE")).toBe("chargeback");
  });
  it("mapeia billing types", () => {
    expect(mapAsaasBillingTypeToMethod("PIX")).toBe("pix");
    expect(mapAsaasBillingTypeToMethod("CREDIT_CARD")).toBe("credit_card");
    expect(mapAsaasBillingTypeToMethod("BOLETO")).toBe("boleto");
  });
});

describe("decidePaymentTransition", () => {
  it("ativa e notifica na primeira aprovação", () => {
    expect(
      decidePaymentTransition({ previousStatus: "pending", newStatus: "approved", establishmentId: "e1", planSlug: "pro" }),
    ).toEqual({ shouldActivate: true, shouldNotifySale: true });
  });

  it("é idempotente: reenvio de webhook aprovado não notifica de novo", () => {
    expect(
      decidePaymentTransition({ previousStatus: "approved", newStatus: "approved", establishmentId: "e1", planSlug: "pro" }),
    ).toEqual({ shouldActivate: true, shouldNotifySale: false });
  });

  it("não ativa plano sem estabelecimento/plano identificados", () => {
    expect(
      decidePaymentTransition({ previousStatus: null, newStatus: "approved", establishmentId: null, planSlug: null })
        .shouldActivate,
    ).toBe(false);
  });

  it("não ativa em status não aprovado", () => {
    expect(
      decidePaymentTransition({ previousStatus: "pending", newStatus: "cancelled", establishmentId: "e1", planSlug: "pro" }),
    ).toEqual({ shouldActivate: false, shouldNotifySale: false });
  });
});

describe("buildSubscriptionPeriod", () => {
  it("gera um ciclo de um mês", () => {
    const p = buildSubscriptionPeriod(new Date("2026-01-15T10:00:00.000Z"));
    expect(new Date(p.end).getTime()).toBeGreaterThan(new Date(p.start).getTime());
    expect(new Date(p.end).getMonth()).toBe((new Date(p.start).getMonth() + 1) % 12);
  });

  it("lida com virada de ano", () => {
    const p = buildSubscriptionPeriod(new Date("2026-12-31T12:00:00.000Z"));
    expect(new Date(p.end).getFullYear()).toBe(2027);
  });
});
