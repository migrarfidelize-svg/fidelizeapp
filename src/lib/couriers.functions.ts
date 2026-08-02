import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Garante que quem chama é super admin. */
async function assertSuper(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_super_admin", { _user: userId });
  if (!data) throw new Error("Acesso restrito ao super administrador.");
}

/** Garante acesso do usuário ao estabelecimento. */
async function assertEst(supabase: any, userId: string, estId: string) {
  const { data } = await supabase.rpc("has_establishment_access", { _user: userId, _est: estId });
  if (!data) throw new Error("Sem acesso a este estabelecimento.");
}

// ------------------------------------------------------------------
// TRAVA DA ÁREA DE MOTOBOYS (código 9572)
// ------------------------------------------------------------------
export const unlockCourierArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pin: z.string().trim().min(3).max(12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { data: row } = await (supabase as any)
      .from("admin_area_locks")
      .select("pin")
      .eq("area", "motoboys")
      .maybeSingle();
    const expected = String(row?.pin ?? "9572");
    if (data.pin !== expected) return { ok: false as const };
    return { ok: true as const };
  });

export const setCourierAreaPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ pin: z.string().trim().regex(/^\d{4,8}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { error } = await (supabase as any)
      .from("admin_area_locks")
      .upsert({ area: "motoboys", pin: data.pin, updated_at: new Date().toISOString() }, { onConflict: "area" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------
// ADMIN — ENTREGADORES
// ------------------------------------------------------------------
export const adminListCouriers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "pending", "approved", "rejected", "suspended"]).default("all"),
        search: z.string().trim().max(80).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    let q = (supabase as any)
      .from("couriers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.status !== "all") q = q.eq("status", data.status);
    if (data.search) q = q.or(`full_name.ilike.%${data.search}%,cpf.ilike.%${data.search}%,phone.ilike.%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const counts = { pending: 0, approved: 0, rejected: 0, suspended: 0 };
    const { data: all } = await (supabase as any).from("couriers").select("status");
    for (const r of all ?? []) {
      const k = r.status as keyof typeof counts;
      if (k in counts) counts[k] += 1;
    }
    return { couriers: rows ?? [], counts };
  });

export const adminGetCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ courier_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const [{ data: courier }, { data: docs }, { data: reviews }, { data: deliveries }, { data: withdrawals }] =
      await Promise.all([
        (supabase as any).from("couriers").select("*").eq("id", data.courier_id).maybeSingle(),
        (supabase as any).from("courier_documents").select("*").eq("courier_id", data.courier_id).order("created_at"),
        (supabase as any)
          .from("courier_reviews")
          .select("*")
          .eq("courier_id", data.courier_id)
          .order("created_at", { ascending: false })
          .limit(50),
        (supabase as any)
          .from("deliveries")
          .select("id, status, fee_cents, courier_net_cents, delivered_at, created_at")
          .eq("courier_id", data.courier_id)
          .order("created_at", { ascending: false })
          .limit(30),
        (supabase as any)
          .from("courier_withdrawals")
          .select("*")
          .eq("courier_id", data.courier_id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
    if (!courier) throw new Error("Entregador não encontrado");
    return {
      courier,
      documents: docs ?? [],
      reviews: reviews ?? [],
      deliveries: deliveries ?? [],
      withdrawals: withdrawals ?? [],
    };
  });

export const adminSetCourierStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        courier_id: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected", "suspended"]),
        reason: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { error } = await (supabase as any)
      .from("couriers")
      .update({
        status: data.status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: data.status === "rejected" || data.status === "suspended" ? (data.reason ?? null) : null,
      })
      .eq("id", data.courier_id);
    if (error) throw new Error(error.message);

    await (supabase as any).from("audit_logs").insert({
      user_id: userId,
      action: `courier.${data.status}`,
      entity_type: "courier",
      entity_id: data.courier_id,
      metadata: { reason: data.reason ?? null },
    });
    return { ok: true };
  });

/**
 * Gera um link temporário (60s) para o super admin visualizar um documento
 * que fica no balde privado. O arquivo NUNCA é copiado para a nossa estrutura.
 */
export const adminSignCourierDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { data: doc } = await (supabase as any)
      .from("courier_documents")
      .select("id, storage_path, courier_id")
      .eq("id", data.document_id)
      .maybeSingle();
    if (!doc) throw new Error("Documento não encontrado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("courier-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error) throw new Error(error.message);

    await (supabase as any).from("audit_logs").insert({
      user_id: userId,
      action: "courier.document_viewed",
      entity_type: "courier_document",
      entity_id: doc.id,
      metadata: { courier_id: doc.courier_id },
    });
    return { url: signed?.signedUrl ?? null, expires_in: 60 };
  });

// ------------------------------------------------------------------
// ADMIN — NÍVEIS
// ------------------------------------------------------------------
export const listCourierLevels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("courier_levels")
      .select("*")
      .order("sort_order");
    return data ?? [];
  });

export const upsertCourierLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(2).max(30),
        name: z.string().trim().min(2).max(60),
        min_deliveries: z.number().int().min(0).max(1000000),
        min_rating: z.number().min(0).max(5),
        color: z.string().trim().max(20),
        raffle_eligible: z.boolean(),
        sort_order: z.number().int().min(0).max(99),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { error } = await (supabase as any).from("courier_levels").upsert(data, { onConflict: "code" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------
// ADMIN — CENTRAL DE TAXAS
// ------------------------------------------------------------------
export const listPlatformFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: fees }, { data: plans }] = await Promise.all([
      (context.supabase as any).from("platform_fees").select("*").order("sort_order"),
      (context.supabase as any).from("courier_plans").select("*").order("sort_order"),
    ]);
    return { fees: fees ?? [], plans: plans ?? [] };
  });

export const upsertPlatformFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        key: z.string().trim().min(2).max(60),
        label: z.string().trim().min(2).max(80),
        description: z.string().trim().max(240).optional().nullable(),
        category: z.enum(["delivery", "product_sale", "service", "withdrawal", "subscription", "other"]),
        percent: z.number().min(0).max(100),
        fixed_cents: z.number().int().min(0).max(1000000),
        min_cents: z.number().int().min(0).max(1000000),
        max_cents: z.number().int().min(0).max(10000000).optional().nullable(),
        applies_to: z.string().trim().max(40),
        is_active: z.boolean(),
        sort_order: z.number().int().min(0).max(99),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { error } = await (supabase as any).from("platform_fees").upsert(data, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await (supabase as any).from("audit_logs").insert({
      user_id: userId,
      action: "fees.updated",
      entity_type: "platform_fee",
      entity_id: null,
      metadata: { key: data.key, percent: data.percent, fixed_cents: data.fixed_cents },
    });
    return { ok: true };
  });

export const upsertCourierPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(2).max(30),
        name: z.string().trim().min(2).max(60),
        description: z.string().trim().max(200).optional().nullable(),
        price_cents: z.number().int().min(0).max(1000000),
        fee_percent: z.number().min(0).max(100),
        fee_min_cents: z.number().int().min(0).max(100000),
        daily_limit_cents: z.number().int().min(0).max(100000000),
        weekly_withdrawals: z.number().int().min(0).max(14),
        free_withdrawals_month: z.number().int().min(0).max(31),
        sort_order: z.number().int().min(0).max(99),
        is_active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuper(supabase, userId);
    const { error } = await (supabase as any).from("courier_plans").upsert(data, { onConflict: "code" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------
// LOJISTA — ENTREGADORES DISPONÍVEIS E CHAMADA
// ------------------------------------------------------------------
export const listAvailableCouriers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), city: z.string().trim().max(80).optional().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertEst(supabase, userId, data.establishment_id);

    const cols =
      "id, full_name, avatar_url, vehicle_type, vehicle_plate, city, rating_avg, rating_count, deliveries_count, level_code, is_online, last_seen_at, is_test";

    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    let q = (supabase as any)
      .from("couriers")
      .select(cols)
      .eq("status", "approved")
      .eq("is_online", true)
      .eq("is_test", false)
      .gte("last_seen_at", cutoff)
      .order("rating_avg", { ascending: false })
      .limit(50);
    if (data.city) q = q.ilike("city", data.city);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Entregadores de teste ficam sempre disponíveis (qualquer cidade) para validação do mapa.
    const { data: testRows } = await (supabase as any)
      .from("couriers")
      .select(cols)
      .eq("status", "approved")
      .eq("is_test", true)
      .limit(5);

    const couriers = [...(rows ?? []), ...(testRows ?? [])];
    return { couriers, total: couriers.length, refreshed_at: new Date().toISOString() };
  });


export const requestCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        establishment_id: z.string().uuid(),
        order_id: z.string().uuid().optional().nullable(),
        courier_id: z.string().uuid().optional().nullable(),
        fee_cents: z.number().int().min(0).max(1000000).default(0),
        dropoff_address: z.string().trim().max(240).optional().nullable(),
        notes: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertEst(supabase, userId, data.establishment_id);

    // Taxa da plataforma vem sempre do banco (central de taxas), nunca do cliente.
    const { data: fee } = await (supabase as any)
      .from("platform_fees")
      .select("percent, fixed_cents, min_cents, is_active")
      .eq("key", "delivery_platform")
      .maybeSingle();

    let platformFee = 0;
    if (fee?.is_active) {
      platformFee = Math.round((data.fee_cents * Number(fee.percent ?? 0)) / 100) + Number(fee.fixed_cents ?? 0);
      platformFee = Math.max(platformFee, Number(fee.min_cents ?? 0));
      platformFee = Math.min(platformFee, data.fee_cents);
    }

    let order: any = null;
    if (data.order_id) {
      const { data: o } = await (supabase as any)
        .from("orders")
        .select("id, customer_name, customer_phone, address, establishment_id")
        .eq("id", data.order_id)
        .maybeSingle();
      if (o && o.establishment_id === data.establishment_id) order = o;
    }

    const { data: est } = await (supabase as any)
      .from("establishments")
      .select("name, address, city")
      .eq("id", data.establishment_id)
      .maybeSingle();

    const pickupAddress = est?.address ?? null;
    const dropoffAddress = data.dropoff_address ?? order?.address ?? null;

    // Geocodifica os endereços (quando o Google Maps estiver configurado) para o mapa em tempo real.
    let pickup: { lat: number; lng: number } | null = null;
    let dropoff: { lat: number; lng: number } | null = null;
    try {
      const { geocodeAddress } = await import("./maps.server");
      const compose = (addr: string | null) =>
        addr ? [addr, est?.city].filter(Boolean).join(", ") : null;
      const [p, d] = await Promise.all([
        compose(pickupAddress) ? geocodeAddress(compose(pickupAddress)!) : Promise.resolve(null),
        compose(dropoffAddress) ? geocodeAddress(compose(dropoffAddress)!) : Promise.resolve(null),
      ]);
      pickup = p;
      dropoff = d;
    } catch {
      /* mapas opcionais */
    }

    const { data: created, error } = await (supabase as any)
      .from("deliveries")
      .insert({
        establishment_id: data.establishment_id,
        order_id: data.order_id ?? null,
        courier_id: data.courier_id ?? null,
        customer_name: order?.customer_name ?? null,
        customer_phone: order?.customer_phone ?? null,
        status: data.courier_id ? "assigned" : "pending",
        assigned_at: data.courier_id ? new Date().toISOString() : null,
        pickup_address: pickupAddress,
        dropoff_address: dropoffAddress,
        pickup_lat: pickup?.lat ?? null,
        pickup_lng: pickup?.lng ?? null,
        dropoff_lat: dropoff?.lat ?? null,
        dropoff_lng: dropoff?.lng ?? null,
        fee_cents: data.fee_cents,
        platform_fee_cents: platformFee,
        courier_net_cents: Math.max(data.fee_cents - platformFee, 0),
        notes: data.notes ?? null,
      })
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Entregador de teste "segue" o endereço atual: fica na coleta da entrega solicitada.
    if (data.courier_id && created?.id) {
      const { data: courier } = await (supabase as any)
        .from("couriers")
        .select("id, is_test")
        .eq("id", data.courier_id)
        .maybeSingle();
      if (courier?.is_test) {
        const now = new Date().toISOString();
        await (supabase as any)
          .from("couriers")
          .update({ city: est?.city ?? null, is_online: true, last_seen_at: now, updated_at: now })
          .eq("id", courier.id);
        if (pickup) {
          await (supabase as any).from("courier_locations").insert({
            courier_id: courier.id,
            delivery_id: created.id,
            lat: pickup.lat,
            lng: pickup.lng,
            recorded_at: now,
          });
        }
      }
    }

    return { ok: true, delivery: created, platform_fee_cents: platformFee };

  });

/** Entregas em andamento do estabelecimento (para o dock e o mapa). */
export const listEstablishmentDeliveries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertEst(supabase, userId, data.establishment_id);
    const { data: rows, error } = await (supabase as any)
      .from("deliveries")
      .select("*, couriers(id, full_name, avatar_url, phone, rating_avg, rating_count, level_code, vehicle_plate)")
      .eq("establishment_id", data.establishment_id)
      .in("status", ["pending", "assigned", "accepted", "picked_up", "in_transit"])
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
