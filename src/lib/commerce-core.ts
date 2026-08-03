/**
 * Núcleo puro do fluxo transacional (sem I/O) — precificação, taxas,
 * transições de status e regras de saque. Testado isoladamente.
 */

export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled"
  | "partially_refunded"
  | "refunded"
  | "chargeback";

export type WithdrawalStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "payment_processing"
  | "paid"
  | "rejected"
  | "cancelled";

export const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/* ---------------------------------------------------------------- preço */

export type PricedItem = {
  id: string;
  name: string;
  sku?: string | null;
  price: number;
  promo_price?: number | null;
  currency?: string | null;
  variants?: unknown;
  active?: boolean | null;
  track_stock?: boolean | null;
  stock_qty?: number | null;
  stock_status?: string | null;
};

export type CartLineInput = { item_id: string; qty: number; variant_label?: string | null };

export type PricedLine = {
  item_id: string;
  name: string;
  sku: string | null;
  variant_label: string | null;
  list_price: number;
  unit_price: number;
  qty: number;
  line_total: number;
};

export type PriceQuote = {
  lines: PricedLine[];
  removed: { item_id: string; reason: string }[];
  items_total: number;
  discount_total: number;
  delivery_fee: number;
  total: number;
  currency: string;
  affiliate_applied: boolean;
  minimum_order: number;
  meets_minimum: boolean;
};

/** Preço base do item (promoção vence preço cheio; variação vence ambos). */
export function unitListPrice(item: PricedItem, variantLabel?: string | null): number {
  const vs = Array.isArray(item.variants) ? (item.variants as any[]) : [];
  const v = variantLabel ? vs.find((x) => x?.label === variantLabel) : null;
  if (v && v.price != null) return money(Number(v.price));
  const promo = item.promo_price != null ? Number(item.promo_price) : null;
  const base = Number(item.price ?? 0);
  return money(promo != null && promo > 0 && promo < base ? promo : base);
}

/** Item indisponível → motivo; disponível → null. */
export function unavailableReason(item: PricedItem | undefined, qty: number): string | null {
  if (!item) return "Produto não está mais disponível";
  if (item.active === false) return "Produto desativado pela loja";
  if (item.stock_status === "out_of_stock") return "Produto esgotado";
  if (item.track_stock && item.stock_qty != null && qty > Number(item.stock_qty))
    return `Estoque insuficiente (restam ${item.stock_qty})`;
  return null;
}

/** Taxa de entrega: fixa + por km, zerada na retirada. */
export function deliveryFeeFor(opts: {
  fulfillment: "pickup" | "delivery";
  flat: number;
  perKm: number;
  distanceKm?: number | null;
}): number {
  if (opts.fulfillment !== "delivery") return 0;
  const km = Math.max(0, Number(opts.distanceKm ?? 0));
  return money(Number(opts.flat || 0) + Number(opts.perKm || 0) * km);
}

/** Distância aproximada em km (Haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/**
 * Cálculo autoritativo do pedido. O frontend nunca define preço, desconto,
 * taxa ou total — tudo é derivado dos dados publicados no banco.
 */
export function priceOrder(params: {
  items: PricedItem[];
  cart: CartLineInput[];
  isAffiliate: boolean;
  affiliateDiscountPercent: number;
  fulfillment: "pickup" | "delivery";
  deliveryFlat: number;
  deliveryPerKm: number;
  distanceKm?: number | null;
  minimumOrder?: number;
  currency?: string;
}): PriceQuote {
  const byId = new Map(params.items.map((i) => [i.id, i]));
  const lines: PricedLine[] = [];
  const removed: { item_id: string; reason: string }[] = [];
  const pct = params.isAffiliate ? Math.min(90, Math.max(0, Number(params.affiliateDiscountPercent || 0))) : 0;

  for (const l of params.cart) {
    const item = byId.get(l.item_id);
    const reason = unavailableReason(item, l.qty);
    if (reason || !item) {
      removed.push({ item_id: l.item_id, reason: reason ?? "Produto indisponível" });
      continue;
    }
    const list = unitListPrice(item, l.variant_label);
    const unit = money(list * (1 - pct / 100));
    lines.push({
      item_id: item.id,
      name: item.name,
      sku: item.sku ?? null,
      variant_label: l.variant_label ?? null,
      list_price: list,
      unit_price: unit,
      qty: l.qty,
      line_total: money(unit * l.qty),
    });
  }

  const items_total = money(lines.reduce((a, l) => a + l.line_total, 0));
  const gross = money(lines.reduce((a, l) => a + l.list_price * l.qty, 0));
  const discount_total = money(gross - items_total);
  const delivery_fee = deliveryFeeFor({
    fulfillment: params.fulfillment,
    flat: params.deliveryFlat,
    perKm: params.deliveryPerKm,
    distanceKm: params.distanceKm ?? 0,
  });
  const minimum_order = money(params.minimumOrder ?? 0);

  return {
    lines,
    removed,
    items_total,
    discount_total,
    delivery_fee,
    total: money(items_total + delivery_fee),
    currency: params.currency ?? "BRL",
    affiliate_applied: pct > 0 && lines.length > 0,
    minimum_order,
    meets_minimum: items_total >= minimum_order,
  };
}

/* ------------------------------------------------------------- taxas */

export type FeeBreakdown = { gross: number; platform_fee: number; gateway_fee: number; net: number };

/** Decomposição do líquido do lojista — nunca gravamos apenas o líquido. */
export function feeBreakdown(gross: number, platformPercent: number, gatewayPercent: number): FeeBreakdown {
  const g = money(gross);
  const platform_fee = money((g * Number(platformPercent || 0)) / 100);
  const gateway_fee = money((g * Number(gatewayPercent || 0)) / 100);
  return { gross: g, platform_fee, gateway_fee, net: money(g - platform_fee - gateway_fee) };
}

/* --------------------------------------------------------- transições */

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "completed", "cancelled"],
  out_for_delivery: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  requested: ["under_review", "cancelled"],
  under_review: ["approved", "rejected"],
  approved: ["payment_processing", "cancelled"],
  payment_processing: ["paid", "under_review"],
  paid: [],
  rejected: [],
  cancelled: [],
};

export function canTransitionWithdrawal(from: WithdrawalStatus, to: WithdrawalStatus): boolean {
  return (WITHDRAWAL_TRANSITIONS[from] ?? []).includes(to);
}

/** Estados que devolvem o saldo reservado ao lojista. */
export const WITHDRAWAL_REVERSING_STATES: WithdrawalStatus[] = ["rejected", "cancelled"];

/* ---------------------------------------------------------- fidelidade */

/** Carimbo só quando o pedido concluiu e o dinheiro está resolvido. */
export function shouldGrantStamp(params: {
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  settlementMode: "online_platform" | "on_delivery_direct";
  alreadyGrantedAt?: string | null;
}): boolean {
  if (params.alreadyGrantedAt) return false;
  if (params.orderStatus !== "completed") return false;
  if (params.settlementMode === "online_platform") return params.paymentStatus === "approved";
  return true;
}

/** Data de liberação do saldo conforme o método de pagamento. */
export function releaseDateFor(method: string, cfg: { pixDays: number; cardDays: number }, from = new Date()): string {
  const days = method === "credit_card" || method === "card" ? cfg.cardDays : cfg.pixDays;
  return new Date(from.getTime() + Math.max(0, days) * 86400000).toISOString();
}
