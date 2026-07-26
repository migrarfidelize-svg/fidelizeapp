import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const cartSchema = z.object({
  slug: z.string().min(1).max(80),
  customer_name: z.string().trim().min(2).max(80),
  customer_phone: z.string().trim().max(30).optional().nullable(),
  fulfillment: z.enum(["pickup", "delivery"]).default("pickup"),
  address: z.string().trim().max(240).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  payment_method: z.string().trim().max(40).optional().nullable(),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        qty: z.number().int().min(1).max(99),
        variant_label: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1)
    .max(60),
});

/**
 * Registra um pedido feito na vitrine pública (catálogo).
 * Público por natureza — os preços NUNCA vêm do cliente: são recalculados
 * a partir dos itens publicados no banco.
 */
export const createCatalogOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => cartSchema.parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();

    const { data: est } = await s
      .from("establishments")
      .select("id, name, whatsapp, phone")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (!est) throw new Error("Loja não encontrada");

    const { data: menu } = await s
      .from("restaurant_menus")
      .select("id, currency")
      .eq("establishment_id", est.id)
      .eq("kind", "catalog")
      .eq("status", "published")
      .maybeSingle();
    if (!menu) throw new Error("Catálogo indisponível");

    const ids = [...new Set(data.items.map((i) => i.item_id))];
    const { data: dbItems } = await s
      .from("menu_items")
      .select("id, name, sku, price, promo_price, currency")
      .eq("menu_id", menu.id)
      .eq("active", true)
      .in("id", ids);

    const byId = new Map((dbItems ?? []).map((i) => [i.id, i]));
    const lines = data.items
      .filter((l) => byId.has(l.item_id))
      .map((l) => {
        const it = byId.get(l.item_id)!;
        const unit = Number(it.promo_price ?? it.price ?? 0);
        return {
          item_id: it.id,
          name: it.name,
          sku: it.sku ?? null,
          variant_label: l.variant_label ?? null,
          unit_price: unit,
          qty: l.qty,
          line_total: Number((unit * l.qty).toFixed(2)),
        };
      });
    if (lines.length === 0) throw new Error("Nenhum produto válido no carrinho");

    const total = Number(lines.reduce((a, l) => a + l.line_total, 0).toFixed(2));
    const currency = (dbItems?.[0] as any)?.currency ?? "BRL";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        establishment_id: est.id,
        menu_id: menu.id,
        kind: "catalog",
        customer_name: data.customer_name,
        customer_phone: data.customer_phone || null,
        fulfillment: data.fulfillment,
        address: data.fulfillment === "delivery" ? data.address || null : null,
        note: data.note || null,
        payment_method: data.payment_method || null,
        items_total: total,
        total,
        currency,
        source: "whatsapp",
      })
      .select("id, order_number, total, currency")
      .single();
    if (error) throw new Error(error.message);

    const { error: liErr } = await supabaseAdmin
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (liErr) throw new Error(liErr.message);

    return {
      order_id: order.id as string,
      order_number: order.order_number as number,
      total,
      currency,
      lines,
      establishment: { name: est.name, whatsapp: est.whatsapp, phone: est.phone },
    };
  });

/** Lista de pedidos do estabelecimento (painel do lojista). */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        status: z.string().max(20).optional(),
        search: z.string().max(60).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("establishment_id", data.establishment_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status && data.status !== "all") q = q.eq("status", data.status as any);
    if (data.search?.trim()) {
      const t = data.search.trim();
      q = q.or(`customer_name.ilike.%${t}%,customer_phone.ilike.%${t}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Resumo para os cards de KPI. */
export const getMyOrdersStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("orders")
      .select("status, total, created_at")
      .eq("establishment_id", data.establishment_id)
      .gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString());
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const valid = list.filter((o) => o.status !== "cancelled");
    return {
      open: list.filter((o) => ["new", "confirmed", "preparing", "ready"].includes(o.status as string)).length,
      today: list.filter((o) => String(o.created_at).slice(0, 10) === today).length,
      total30: valid.length,
      revenue30: Number(valid.reduce((a, o) => a + Number(o.total ?? 0), 0).toFixed(2)),
      ticket: valid.length ? Number((valid.reduce((a, o) => a + Number(o.total ?? 0), 0) / valid.length).toFixed(2)) : 0,
    };
  });

/** Atualiza o status de um pedido. */
export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        order_id: z.string().uuid(),
        status: z.enum(["new", "confirmed", "preparing", "ready", "completed", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.order_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
