import { describe, expect, it } from "vitest";
import {
  canTransitionOrder,
  canTransitionWithdrawal,
  deliveryFeeFor,
  distanceKm,
  feeBreakdown,
  priceOrder,
  releaseDateFor,
  shouldGrantStamp,
  unavailableReason,
  unitListPrice,
} from "./commerce-core";

const item = (o: Partial<Parameters<typeof unitListPrice>[0]> = {}) =>
  ({ id: "i1", name: "Produto", price: 100, active: true, ...o }) as any;

describe("preço unitário", () => {
  it("usa promoção quando menor", () => {
    expect(unitListPrice(item({ promo_price: 80 }))).toBe(80);
  });
  it("ignora promoção maior que o preço cheio", () => {
    expect(unitListPrice(item({ promo_price: 120 }))).toBe(100);
  });
  it("variação vence promoção", () => {
    expect(unitListPrice(item({ promo_price: 80, variants: [{ label: "G", price: 150 }] }), "G")).toBe(150);
  });
});

describe("disponibilidade", () => {
  it("bloqueia esgotado, inativo e estoque insuficiente", () => {
    expect(unavailableReason(undefined, 1)).toBeTruthy();
    expect(unavailableReason(item({ active: false }), 1)).toBeTruthy();
    expect(unavailableReason(item({ stock_status: "out_of_stock" }), 1)).toBeTruthy();
    expect(unavailableReason(item({ track_stock: true, stock_qty: 2 }), 3)).toBeTruthy();
    expect(unavailableReason(item({ track_stock: true, stock_qty: 5 }), 3)).toBeNull();
  });
});

describe("priceOrder", () => {
  const base = {
    items: [item({ id: "a", price: 50 }), item({ id: "b", price: 30 })],
    cart: [
      { item_id: "a", qty: 2 },
      { item_id: "b", qty: 1 },
    ],
    isAffiliate: false,
    affiliateDiscountPercent: 10,
    fulfillment: "pickup" as const,
    deliveryFlat: 8,
    deliveryPerKm: 1.5,
  };

  it("soma itens sem desconto para não afiliado", () => {
    const q = priceOrder(base);
    expect(q.items_total).toBe(130);
    expect(q.discount_total).toBe(0);
    expect(q.total).toBe(130);
    expect(q.affiliate_applied).toBe(false);
  });

  it("aplica desconto de afiliado", () => {
    const q = priceOrder({ ...base, isAffiliate: true });
    expect(q.items_total).toBe(117);
    expect(q.discount_total).toBe(13);
    expect(q.affiliate_applied).toBe(true);
  });

  it("cobra entrega apenas no delivery", () => {
    const q = priceOrder({ ...base, fulfillment: "delivery", distanceKm: 4 });
    expect(q.delivery_fee).toBe(14);
    expect(q.total).toBe(144);
  });

  it("remove itens indisponíveis do cálculo", () => {
    const q = priceOrder({ ...base, cart: [...base.cart, { item_id: "zzz", qty: 1 }] });
    expect(q.removed).toHaveLength(1);
    expect(q.items_total).toBe(130);
  });

  it("valida pedido mínimo", () => {
    expect(priceOrder({ ...base, minimumOrder: 200 }).meets_minimum).toBe(false);
    expect(priceOrder({ ...base, minimumOrder: 100 }).meets_minimum).toBe(true);
  });
});

describe("taxas", () => {
  it("explica o líquido do lojista", () => {
    expect(feeBreakdown(100, 5, 3.5)).toEqual({ gross: 100, platform_fee: 5, gateway_fee: 3.5, net: 91.5 });
  });
});

describe("entrega e distância", () => {
  it("retirada não tem taxa", () => {
    expect(deliveryFeeFor({ fulfillment: "pickup", flat: 10, perKm: 2, distanceKm: 5 })).toBe(0);
  });
  it("distância aproximada é positiva", () => {
    expect(distanceKm({ lat: -23.55, lng: -46.63 }, { lat: -23.6, lng: -46.65 })).toBeGreaterThan(0);
  });
});

describe("transições", () => {
  it("pedido segue o fluxo operacional", () => {
    expect(canTransitionOrder("new", "confirmed")).toBe(true);
    expect(canTransitionOrder("new", "completed")).toBe(false);
    expect(canTransitionOrder("completed", "cancelled")).toBe(false);
  });
  it("saque não pula etapas", () => {
    expect(canTransitionWithdrawal("requested", "under_review")).toBe(true);
    expect(canTransitionWithdrawal("requested", "paid")).toBe(false);
    expect(canTransitionWithdrawal("paid", "cancelled")).toBe(false);
    expect(canTransitionWithdrawal("payment_processing", "paid")).toBe(true);
  });
});

describe("carimbo", () => {
  const b = { orderStatus: "completed", paymentStatus: "approved", settlementMode: "online_platform" } as const;
  it("concede na conclusão com pagamento aprovado", () => {
    expect(shouldGrantStamp(b)).toBe(true);
  });
  it("não concede duas vezes", () => {
    expect(shouldGrantStamp({ ...b, alreadyGrantedAt: "2026-01-01" })).toBe(false);
  });
  it("não concede em pedido cancelado ou pendente", () => {
    expect(shouldGrantStamp({ ...b, orderStatus: "cancelled" })).toBe(false);
    expect(shouldGrantStamp({ ...b, paymentStatus: "pending" })).toBe(false);
  });
  it("pagamento direto concede na conclusão", () => {
    expect(shouldGrantStamp({ ...b, settlementMode: "on_delivery_direct", paymentStatus: "unpaid" })).toBe(true);
  });
});

describe("liberação de saldo", () => {
  it("cartão espera mais que Pix", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    expect(releaseDateFor("pix", { pixDays: 1, cardDays: 14 }, from)).toBe("2026-01-02T00:00:00.000Z");
    expect(releaseDateFor("credit_card", { pixDays: 1, cardDays: 14 }, from)).toBe("2026-01-15T00:00:00.000Z");
  });
});
