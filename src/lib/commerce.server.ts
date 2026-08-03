/**
 * Núcleo de I/O do fluxo transacional do cliente final (Descobrir → pedido).
 * Server-only. Toda leitura/escrita é escopada explicitamente pelo profile_id
 * do usuário autenticado; o cliente nunca informa preço, taxa ou desconto.
 */

import {
  distanceKm as haversine,
  money,
  priceOrder,
  type CartLineInput,
  type PriceQuote,
  type PricedItem,
} from "@/lib/commerce-core";
import { getCheckoutSettings } from "@/lib/commerce-settle.server";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type PaymentOption = {
  id: string;
  label: string;
  online: boolean;
  settlement: "online_platform" | "on_delivery_direct";
};

/** Métodos habilitados pela loja, separando online x direto ao lojista. */
export function paymentOptionsFor(cfg: any, fulfillment: "pickup" | "delivery"): PaymentOption[] {
  const out: PaymentOption[] = [];
  if (cfg.pix_online_enabled)
    out.push({ id: "pix_online", label: "PIX online (pelo Fidelize)", online: true, settlement: "online_platform" });
  if (cfg.card_online_enabled)
    out.push({ id: "card_online", label: "Cartão online", online: true, settlement: "online_platform" });

  const direct = fulfillment === "delivery" ? cfg.pay_on_delivery_enabled : cfg.pay_on_pickup_enabled;
  if (direct) {
    if (cfg.pix_on_delivery_enabled)
      out.push({ id: "pix_direct", label: "PIX direto ao estabelecimento", online: false, settlement: "on_delivery_direct" });
    if (cfg.card_on_delivery_enabled)
      out.push({ id: "card_direct", label: "Cartão na entrega/retirada", online: false, settlement: "on_delivery_direct" });
    if (cfg.cash_enabled)
      out.push({ id: "cash", label: "Dinheiro", online: false, settlement: "on_delivery_direct" });
  }
  return out;
}

async function establishmentBySlug(slug: string) {
  const s = await db();
  const { data } = await s
    .from("establishments")
    .select("id, slug, name, logo_url, cover_url, primary_color, address, city, state, phone, whatsapp, latitude, longitude, active")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.active === false) throw new Error("Loja não encontrada ou indisponível.");
  return data;
}

async function publishedMenu(establishmentId: string) {
  const s = await db();
  const { data } = await s
    .from("restaurant_menus")
    .select("id, kind, display_name, status")
    .eq("establishment_id", establishmentId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function menuItems(menuId: string): Promise<PricedItem[]> {
  const s = await db();
  const { data } = await s
    .from("menu_items")
    .select(
      "id, name, short_desc, image_url, price, promo_price, currency, variants, active, track_stock, stock_qty, stock_status, sku, category_id, position",
    )
    .eq("menu_id", menuId)
    .eq("active", true)
    .order("position", { ascending: true });
  return (data ?? []) as PricedItem[];
}

/** Afiliação ativa do cliente na loja (ou null). */
export async function getAffiliation(profileId: string, establishmentId: string) {
  const s = await db();
  const { data } = await s
    .from("customer_links")
    .select("id, status, customer_id, joined_via, consent_at")
    .eq("profile_id", profileId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();
  return data && data.status === "active" ? data : null;
}

/**
 * Cria (ou reativa) a afiliação do cliente à loja, sempre reaproveitando um
 * `customers` existente — nunca duplica cadastro nem concede papel de equipe.
 */
export async function joinEstablishment(params: {
  profileId: string;
  establishmentId: string;
  name?: string | null;
  phone?: string | null;
  via?: string;
}) {
  const s = await db();

  let customerId: string | null = null;
  const { data: byUser } = await s
    .from("customers")
    .select("id")
    .eq("establishment_id", params.establishmentId)
    .eq("user_id", params.profileId)
    .maybeSingle();
  customerId = byUser?.id ?? null;

  if (!customerId && params.phone) {
    const { data: byPhone } = await s
      .from("customers")
      .select("id, user_id")
      .eq("establishment_id", params.establishmentId)
      .eq("phone", params.phone)
      .maybeSingle();
    if (byPhone && (!byPhone.user_id || byPhone.user_id === params.profileId)) {
      customerId = byPhone.id;
      await s.from("customers").update({ user_id: params.profileId }).eq("id", byPhone.id);
    }
  }

  if (!customerId) {
    const { data: created, error } = await s
      .from("customers")
      .insert({
        establishment_id: params.establishmentId,
        user_id: params.profileId,
        name: params.name?.trim() || "Cliente Fidelize",
        phone: params.phone || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    customerId = created.id;
  }

  const { error: linkErr } = await s.from("customer_links").upsert(
    {
      profile_id: params.profileId,
      establishment_id: params.establishmentId,
      customer_id: customerId,
      status: "active",
      joined_via: params.via ?? "discover",
      consent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,establishment_id" },
  );
  if (linkErr) throw new Error(linkErr.message);

  return { customer_id: customerId };
}

/* ------------------------------------------------------------- carrinho */

async function openCart(profileId: string, establishmentId: string, create = true) {
  const s = await db();
  const { data } = await s
    .from("carts")
    .select("id")
    .eq("profile_id", profileId)
    .eq("establishment_id", establishmentId)
    .eq("status", "open")
    .maybeSingle();
  if (data) return data.id as string;
  if (!create) return null;
  const { data: created, error } = await s
    .from("carts")
    .insert({ profile_id: profileId, establishment_id: establishmentId, status: "open" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function readCart(profileId: string, establishmentId: string): Promise<CartLineInput[]> {
  const s = await db();
  const cartId = await openCart(profileId, establishmentId, false);
  if (!cartId) return [];
  const { data } = await s.from("cart_items").select("item_id, qty, variant_label").eq("cart_id", cartId);
  return (data ?? []).map((l: any) => ({ item_id: l.item_id, qty: l.qty, variant_label: l.variant_label }));
}

/** Define a quantidade de uma linha (0 remove). Um carrinho aberto por loja. */
export async function setCartLine(params: {
  profileId: string;
  establishmentId: string;
  itemId: string;
  variantLabel?: string | null;
  qty: number;
}) {
  const s = await db();
  const cartId = await openCart(params.profileId, params.establishmentId);
  const variant = params.variantLabel ?? null;
  const qty = Math.max(0, Math.min(99, Math.trunc(params.qty)));

  const { data: existing } = await s
    .from("cart_items")
    .select("id")
    .eq("cart_id", cartId)
    .eq("item_id", params.itemId)
    .is("variant_label", variant === null ? null : undefined)
    .maybeSingle();

  let row = existing;
  if (variant !== null) {
    const { data } = await s
      .from("cart_items")
      .select("id")
      .eq("cart_id", cartId)
      .eq("item_id", params.itemId)
      .eq("variant_label", variant)
      .maybeSingle();
    row = data;
  }

  if (qty === 0) {
    if (row) await s.from("cart_items").delete().eq("id", row.id);
  } else if (row) {
    await s.from("cart_items").update({ qty, updated_at: new Date().toISOString() }).eq("id", row.id);
  } else {
    await s.from("cart_items").insert({ cart_id: cartId, item_id: params.itemId, variant_label: variant, qty });
  }
  await s.from("carts").update({ updated_at: new Date().toISOString() }).eq("id", cartId);
  return readCart(params.profileId, params.establishmentId);
}

export async function clearCart(profileId: string, establishmentId: string) {
  const s = await db();
  const cartId = await openCart(profileId, establishmentId, false);
  if (cartId) await s.from("cart_items").delete().eq("cart_id", cartId);
  return [];
}

/* ------------------------------------------------------------ storefront */

export async function loadStorefront(profileId: string, slug: string) {
  const est = await establishmentBySlug(slug);
  const [menu, cfg, affiliation] = await Promise.all([
    publishedMenu(est.id),
    getCheckoutSettings(est.id),
    getAffiliation(profileId, est.id),
  ]);
  const items = menu ? await menuItems(menu.id) : [];
  const cart = await readCart(profileId, est.id);

  return {
    establishment: est,
    menu,
    items,
    cart,
    affiliate: !!affiliation,
    affiliate_discount_percent: Number(cfg.affiliate_discount_percent ?? 0),
    checkout: {
      pickup_enabled: !!cfg.pickup_enabled,
      delivery_enabled: !!cfg.delivery_enabled,
      minimum_order: Number(cfg.minimum_order ?? 0),
      delivery_fee_flat: Number(cfg.delivery_fee_flat ?? 0),
      delivery_fee_per_km: Number(cfg.delivery_fee_per_km ?? 0),
      delivery_radius_km: Number(cfg.delivery_radius_km ?? 10),
      eta_minutes: Number(cfg.eta_minutes ?? 45),
      paused: !!cfg.paused,
      payment_options: {
        pickup: paymentOptionsFor(cfg, "pickup"),
        delivery: paymentOptionsFor(cfg, "delivery"),
      },
    },
  };
}

/* ------------------------------------------------------------- cotação */

export type CheckoutQuote = PriceQuote & {
  establishment_id: string;
  distance_km: number | null;
  out_of_radius: boolean;
  eta_minutes: number;
  payment_options: PaymentOption[];
};

export async function quoteCheckout(params: {
  profileId: string;
  slug: string;
  fulfillment: "pickup" | "delivery";
  addressId?: string | null;
}): Promise<CheckoutQuote> {
  const s = await db();
  const est = await establishmentBySlug(params.slug);
  const cfg = await getCheckoutSettings(est.id);
  const menu = await publishedMenu(est.id);
  const items = menu ? await menuItems(menu.id) : [];
  const cart = await readCart(params.profileId, est.id);
  const affiliation = await getAffiliation(params.profileId, est.id);

  let dist: number | null = null;
  if (params.fulfillment === "delivery" && params.addressId) {
    const { data: addr } = await s
      .from("customer_addresses")
      .select("lat, lng")
      .eq("id", params.addressId)
      .eq("user_id", params.profileId)
      .maybeSingle();
    if (addr?.lat != null && addr?.lng != null && est.latitude != null && est.longitude != null) {
      dist = haversine({ lat: Number(est.latitude), lng: Number(est.longitude) }, { lat: Number(addr.lat), lng: Number(addr.lng) });
    }
  }

  const quote = priceOrder({
    items,
    cart,
    isAffiliate: !!affiliation,
    affiliateDiscountPercent: Number(cfg.affiliate_discount_percent ?? 0),
    fulfillment: params.fulfillment,
    deliveryFlat: Number(cfg.delivery_fee_flat ?? 0),
    deliveryPerKm: Number(cfg.delivery_fee_per_km ?? 0),
    distanceKm: dist,
    minimumOrder: Number(cfg.minimum_order ?? 0),
  });

  return {
    ...quote,
    establishment_id: est.id,
    distance_km: dist,
    out_of_radius: params.fulfillment === "delivery" && dist != null && dist > Number(cfg.delivery_radius_km ?? 10),
    eta_minutes: Number(cfg.eta_minutes ?? 45),
    payment_options: paymentOptionsFor(cfg, params.fulfillment),
  };
}

/* --------------------------------------------------------------- pedido */

export async function placeOrder(params: {
  profileId: string;
  email?: string | null;
  slug: string;
  fulfillment: "pickup" | "delivery";
  addressId?: string | null;
  paymentOption: string;
  note?: string | null;
  customerName: string;
  customerPhone?: string | null;
  idempotencyKey: string;
}) {
  const s = await db();
  const est = await establishmentBySlug(params.slug);
  const cfg = await getCheckoutSettings(est.id);
  if (cfg.paused) throw new Error("A loja está temporariamente sem receber pedidos.");

  // Idempotência: clique duplo devolve o mesmo pedido.
  const { data: dup } = await s
    .from("orders")
    .select("id, order_number, total, payment_status, settlement_mode")
    .eq("idempotency_key", params.idempotencyKey)
    .maybeSingle();
  if (dup) return { order: dup, reused: true as const, pix: null as any };

  const options = paymentOptionsFor(cfg, params.fulfillment);
  const chosen = options.find((o) => o.id === params.paymentOption);
  if (!chosen) throw new Error("Forma de pagamento indisponível para esta loja.");
  if (params.fulfillment === "delivery" && !cfg.delivery_enabled) throw new Error("Entrega indisponível.");
  if (params.fulfillment === "pickup" && !cfg.pickup_enabled) throw new Error("Retirada indisponível.");

  const quote = await quoteCheckout({
    profileId: params.profileId,
    slug: params.slug,
    fulfillment: params.fulfillment,
    addressId: params.addressId ?? null,
  });
  if (quote.lines.length === 0) throw new Error("Carrinho vazio ou sem itens disponíveis.");
  if (!quote.meets_minimum) throw new Error(`Pedido mínimo de R$ ${quote.minimum_order.toFixed(2)} não atingido.`);
  if (quote.out_of_radius) throw new Error("Endereço fora da área de entrega desta loja.");

  let addressText: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  if (params.fulfillment === "delivery") {
    if (!params.addressId) throw new Error("Selecione um endereço de entrega.");
    const { data: addr } = await s
      .from("customer_addresses")
      .select("*")
      .eq("id", params.addressId)
      .eq("user_id", params.profileId)
      .maybeSingle();
    if (!addr) throw new Error("Endereço não encontrado.");
    addressText = [addr.street, addr.number, addr.complement, addr.district, addr.city, addr.state]
      .filter(Boolean)
      .join(", ");
    lat = addr.lat ?? null;
    lng = addr.lng ?? null;
  }

  const affiliation = await getAffiliation(params.profileId, est.id);
  const menu = await publishedMenu(est.id);

  const { data: order, error } = await s
    .from("orders")
    .insert({
      establishment_id: est.id,
      menu_id: menu?.id ?? null,
      kind: menu?.kind ?? "catalog",
      customer_name: params.customerName,
      customer_phone: params.customerPhone || null,
      customer_profile_id: params.profileId,
      customer_id: affiliation?.customer_id ?? null,
      fulfillment: params.fulfillment,
      address: addressText,
      delivery_address_id: params.addressId ?? null,
      delivery_latitude: lat,
      delivery_longitude: lng,
      note: params.note || null,
      payment_method: chosen.id,
      settlement_mode: chosen.settlement,
      payment_status: chosen.online ? "unpaid" : "unpaid",
      items_total: quote.items_total,
      discount_total: quote.discount_total,
      delivery_fee: quote.delivery_fee,
      total: quote.total,
      currency: quote.currency,
      status: "new",
      source: "fidelize",
      idempotency_key: params.idempotencyKey,
      minimum_order_validated_at: new Date().toISOString(),
    })
    .select("id, order_number, total, currency, payment_status, settlement_mode")
    .single();
  if (error) throw new Error(error.message);

  await s.from("order_items").insert(
    quote.lines.map((l) => ({
      order_id: order.id,
      item_id: l.item_id,
      name: l.name,
      sku: l.sku,
      variant_label: l.variant_label,
      unit_price: l.unit_price,
      qty: l.qty,
      line_total: l.line_total,
    })),
  );

  const { appendOrderEvent } = await import("@/lib/commerce-ledger.server");
  await appendOrderEvent({
    order_id: order.id,
    event_type: "order_created",
    new_status: "new",
    actor_user_id: params.profileId,
    actor_type: "customer",
    metadata: {
      payment_option: chosen.id,
      settlement_mode: chosen.settlement,
      affiliate: !!affiliation,
      discount_total: quote.discount_total,
    },
  });

  await clearCart(params.profileId, est.id);

  let pix: any = null;
  if (chosen.id === "pix_online") {
    const { createOrderPixCharge } = await import("@/lib/commerce-pix.server");
    pix = await createOrderPixCharge({
      orderId: order.id,
      establishmentId: est.id,
      customerProfileId: params.profileId,
      amount: money(quote.total),
      payerEmail: params.email || `cliente+${params.profileId}@fidelize.app`,
      description: `Pedido #${order.order_number} — ${est.name}`,
    });
  }

  try {
    const { notifyOrderEvent } = await import("@/lib/orders-notify.server");
    await notifyOrderEvent({ order_id: order.id, event: "created" });
  } catch {
    /* notificação é best-effort */
  }

  return { order, reused: false as const, pix };
}

/** Pedido do cliente com itens, pagamento e histórico. */
export async function readMyOrder(profileId: string, orderId: string) {
  const s = await db();
  const { data: order } = await s
    .from("orders")
    .select("*, establishments(name, slug, logo_url, phone, whatsapp)")
    .eq("id", orderId)
    .eq("customer_profile_id", profileId)
    .maybeSingle();
  if (!order) throw new Error("Pedido não encontrado.");
  const [{ data: items }, { data: payment }, { data: events }] = await Promise.all([
    s.from("order_items").select("*").eq("order_id", orderId),
    s
      .from("order_payments")
      .select("id, status, payment_method, amount, qr_code, qr_code_base64, ticket_url, expires_at, provider_payment_id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    s.from("order_events").select("event_type, new_status, reason, created_at").eq("order_id", orderId).order("created_at"),
  ]);
  return { order, items: items ?? [], payment: payment ?? null, events: events ?? [] };
}

export async function listMyOrders(profileId: string, limit = 30) {
  const s = await db();
  const { data } = await s
    .from("orders")
    .select("id, order_number, total, currency, status, payment_status, settlement_mode, created_at, fulfillment, establishments(name, slug, logo_url)")
    .eq("customer_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Gera novo PIX quando o anterior expirou. */
export async function refreshOrderPix(profileId: string, orderId: string, email?: string | null) {
  const s = await db();
  const { data: order } = await s
    .from("orders")
    .select("id, establishment_id, total, order_number, payment_status, customer_profile_id, establishments(name)")
    .eq("id", orderId)
    .eq("customer_profile_id", profileId)
    .maybeSingle();
  if (!order) throw new Error("Pedido não encontrado.");
  if (order.payment_status === "approved") throw new Error("Este pedido já está pago.");

  await s
    .from("order_payments")
    .update({ status: "expired", expired_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());

  const { createOrderPixCharge } = await import("@/lib/commerce-pix.server");
  return createOrderPixCharge({
    orderId: order.id,
    establishmentId: order.establishment_id,
    customerProfileId: profileId,
    amount: money(Number(order.total)),
    payerEmail: email || `cliente+${profileId}@fidelize.app`,
    description: `Pedido #${order.order_number} — ${(order as any).establishments?.name ?? "Fidelize"}`,
  });
}
