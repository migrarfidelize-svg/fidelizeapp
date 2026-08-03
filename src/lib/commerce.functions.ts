import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Fluxo transacional do cliente final: loja → carrinho → checkout → pedido. */

export const getStorefront = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadStorefront } = await import("@/lib/commerce.server");
    return (await loadStorefront(context.userId, data.slug)) as any;

  });

export const joinStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        name: z.string().trim().max(80).optional().nullable(),
        phone: z.string().trim().max(30).optional().nullable(),
        via: z.string().max(30).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { joinEstablishment } = await import("@/lib/commerce.server");
    return joinEstablishment({
      profileId: context.userId,
      establishmentId: data.establishment_id,
      name: data.name ?? context.claims?.email ?? null,
      phone: data.phone ?? null,
      via: data.via,
    });
  });

export const setCartItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        item_id: z.string().uuid(),
        variant_label: z.string().max(60).nullable().optional(),
        qty: z.number().int().min(0).max(99),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { setCartLine } = await import("@/lib/commerce.server");
    return setCartLine({
      profileId: context.userId,
      establishmentId: data.establishment_id,
      itemId: data.item_id,
      variantLabel: data.variant_label ?? null,
      qty: data.qty,
    });
  });

export const emptyCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { clearCart } = await import("@/lib/commerce.server");
    return clearCart(context.userId, data.establishment_id);
  });

export const getCheckoutQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        fulfillment: z.enum(["pickup", "delivery"]),
        address_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { quoteCheckout } = await import("@/lib/commerce.server");
    return quoteCheckout({
      profileId: context.userId,
      slug: data.slug,
      fulfillment: data.fulfillment,
      addressId: data.address_id ?? null,
    });
  });

export const submitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(80),
        fulfillment: z.enum(["pickup", "delivery"]),
        address_id: z.string().uuid().nullable().optional(),
        payment_option: z.string().min(2).max(30),
        note: z.string().max(500).nullable().optional(),
        customer_name: z.string().trim().min(2).max(80),
        customer_phone: z.string().trim().max(30).nullable().optional(),
        idempotency_key: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { placeOrder } = await import("@/lib/commerce.server");
    return placeOrder({
      profileId: context.userId,
      email: context.claims?.email ?? null,
      slug: data.slug,
      fulfillment: data.fulfillment,
      addressId: data.address_id ?? null,
      paymentOption: data.payment_option,
      note: data.note ?? null,
      customerName: data.customer_name,
      customerPhone: data.customer_phone ?? null,
      idempotencyKey: data.idempotency_key,
    });
  });

export const getMyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { readMyOrder } = await import("@/lib/commerce.server");
    return readMyOrder(context.userId, data.order_id);
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listMyOrders } = await import("@/lib/commerce.server");
    return listMyOrders(context.userId);
  });

export const renewOrderPix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { refreshOrderPix } = await import("@/lib/commerce.server");
    return refreshOrderPix(context.userId, data.order_id, context.claims?.email ?? null);
  });
