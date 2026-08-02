import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Custo real de uma transferência PIX no gateway (repassado ao entregador). */
export const WITHDRAWAL_COST_CENTS = 349;
const MIN_WITHDRAWAL_CENTS = 1000;

async function myCourier(supabase: any, userId: string) {
  const { data } = await supabase
    .from("couriers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

function weekStart() {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
function monthStart() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

// ------------------------------------------------------------------
// PERFIL
// ------------------------------------------------------------------
export const getMyCourier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) return { courier: null, plan: null, level: null, documents: [], active: null };

    const [{ data: plan }, { data: level }, { data: documents }, { data: active }] = await Promise.all([
      (supabase as any).from("courier_plans").select("*").eq("code", courier.plan_code).maybeSingle(),
      (supabase as any).from("courier_levels").select("*").eq("code", courier.level_code).maybeSingle(),
      (supabase as any)
        .from("courier_documents")
        .select("id, doc_type, status, file_name, notes, created_at")
        .eq("courier_id", courier.id)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("deliveries")
        .select("*")
        .eq("courier_id", courier.id)
        .in("status", ["assigned", "accepted", "picked_up", "in_transit"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return { courier, plan: plan ?? null, level: level ?? null, documents: documents ?? [], active: active ?? null };
  });

export const saveCourierProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        full_name: z.string().trim().min(3).max(120),
        cpf: z.string().trim().max(20).optional().nullable(),
        phone: z.string().trim().max(24).optional().nullable(),
        birth_date: z.string().trim().max(12).optional().nullable(),
        vehicle_type: z.enum(["moto", "bike", "carro", "a_pe"]).default("moto"),
        vehicle_plate: z.string().trim().max(12).optional().nullable(),
        vehicle_model: z.string().trim().max(60).optional().nullable(),
        city: z.string().trim().max(80).optional().nullable(),
        state: z.string().trim().max(4).optional().nullable(),
        pix_key: z.string().trim().max(140).optional().nullable(),
        avatar_url: z.string().trim().max(500).optional().nullable(),
        bio: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const existing = await myCourier(supabase, userId);
    const payload: Record<string, unknown> = {
      ...data,
      birth_date: data.birth_date || null,
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (!existing) {
      const { data: created, error } = await (supabase as any)
        .from("couriers")
        .insert({ ...payload, status: "pending" })
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      // Marca o tipo de conta no perfil para o roteamento pós-login.
      await (supabase as any).from("profiles").upsert(
        { id: userId, full_name: data.full_name, phone: data.phone ?? null },
        { onConflict: "id" },
      );
      return { courier: created, created: true };
    }

    const { data: updated, error } = await (supabase as any)
      .from("couriers")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { courier: updated, created: false };
  });

export const registerCourierDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        doc_type: z.enum(["cnh", "crlv", "selfie", "proof_address", "criminal_record", "other"]),
        storage_path: z.string().trim().min(8).max(400),
        file_name: z.string().trim().max(160).optional().nullable(),
        mime_type: z.string().trim().max(80).optional().nullable(),
        size_bytes: z.number().int().min(0).max(20_000_000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) throw new Error("Complete seu cadastro antes de enviar documentos.");
    if (!data.storage_path.startsWith(`${courier.id}/`)) throw new Error("Caminho de arquivo inválido.");

    const { error } = await (supabase as any).from("courier_documents").insert({
      courier_id: courier.id,
      doc_type: data.doc_type,
      storage_path: data.storage_path,
      file_name: data.file_name ?? null,
      mime_type: data.mime_type ?? null,
      size_bytes: data.size_bytes ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------
// OPERAÇÃO
// ------------------------------------------------------------------
export const setCourierOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ online: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) throw new Error("Cadastro não encontrado.");
    if (courier.status !== "approved" && data.online) throw new Error("Seu cadastro ainda está em análise.");
    const { error } = await (supabase as any)
      .from("couriers")
      .update({ is_online: data.online, last_seen_at: new Date().toISOString() })
      .eq("id", courier.id);
    if (error) throw new Error(error.message);
    return { ok: true, online: data.online };
  });

export const pingCourierLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        delivery_id: z.string().uuid().optional().nullable(),
        speed_kmh: z.number().min(0).max(300).optional().nullable(),
        accuracy_m: z.number().min(0).max(100000).optional().nullable(),
        battery: z.number().int().min(0).max(100).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) throw new Error("Cadastro não encontrado.");
    await (supabase as any).from("courier_locations").insert({
      courier_id: courier.id,
      delivery_id: data.delivery_id ?? null,
      lat: data.lat,
      lng: data.lng,
      speed_kmh: data.speed_kmh ?? null,
      accuracy_m: data.accuracy_m ?? null,
      battery: data.battery ?? null,
    });
    await (supabase as any)
      .from("couriers")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", courier.id);
    return { ok: true };
  });

/** Corridas em aberto (sem entregador) + as que foram direcionadas para mim. */
export const listCourierOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier || courier.status !== "approved") return { offers: [], mine: [] };

    const select =
      "id, status, fee_cents, courier_net_cents, platform_fee_cents, pickup_address, dropoff_address, customer_name, customer_phone, distance_m, notes, created_at, establishment_id, establishments(name, city, logo_url, phone)";

    const [{ data: open }, { data: mine }] = await Promise.all([
      (supabase as any)
        .from("deliveries")
        .select(select)
        .eq("status", "pending")
        .is("courier_id", null)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("deliveries")
        .select(select)
        .eq("courier_id", courier.id)
        .in("status", ["assigned", "accepted", "picked_up", "in_transit"])
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return { offers: open ?? [], mine: mine ?? [] };
  });

export const acceptDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ delivery_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier || courier.status !== "approved") throw new Error("Cadastro não aprovado.");

    const now = new Date().toISOString();
    const { data: row, error } = await (supabase as any)
      .from("deliveries")
      .update({ courier_id: courier.id, status: "accepted", accepted_at: now, assigned_at: now })
      .eq("id", data.delivery_id)
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Essa corrida já foi aceita por outro entregador.");
    return { ok: true, delivery: row };
  });

export const updateDeliveryProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        delivery_id: z.string().uuid(),
        status: z.enum(["accepted", "picked_up", "in_transit", "delivered", "cancelled"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) throw new Error("Cadastro não encontrado.");

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: data.status, updated_at: now };
    if (data.status === "picked_up") patch.picked_up_at = now;
    if (data.status === "delivered") patch.delivered_at = now;
    if (data.status === "cancelled") {
      patch.cancelled_at = now;
      patch.courier_id = null;
      patch.status = "pending";
    }

    const { error } = await (supabase as any)
      .from("deliveries")
      .update(patch)
      .eq("id", data.delivery_id)
      .eq("courier_id", courier.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) return [];
    const { data } = await (supabase as any)
      .from("deliveries")
      .select("id, status, fee_cents, courier_net_cents, dropoff_address, created_at, delivered_at, establishments(name)")
      .eq("courier_id", courier.id)
      .order("created_at", { ascending: false })
      .limit(60);
    return data ?? [];
  });

// ------------------------------------------------------------------
// CARTEIRA
// ------------------------------------------------------------------
export const getCourierWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) return null;

    const [{ data: plan }, { data: withdrawals }, { data: weekRows }, { data: monthRows }, { data: plans }] =
      await Promise.all([
        (supabase as any).from("courier_plans").select("*").eq("code", courier.plan_code).maybeSingle(),
        (supabase as any)
          .from("courier_withdrawals")
          .select("*")
          .eq("courier_id", courier.id)
          .order("created_at", { ascending: false })
          .limit(20),
        (supabase as any)
          .from("courier_withdrawals")
          .select("id")
          .eq("courier_id", courier.id)
          .gte("created_at", weekStart()),
        (supabase as any)
          .from("courier_withdrawals")
          .select("id, fee_cents")
          .eq("courier_id", courier.id)
          .gte("created_at", monthStart()),
        (supabase as any).from("courier_plans").select("*").eq("is_active", true).order("sort_order"),
      ]);

    const weekCount = (weekRows ?? []).length;
    const monthCount = (monthRows ?? []).length;
    const freeLeft = Math.max(Number(plan?.free_withdrawals_month ?? 0) - monthCount, 0);

    return {
      balance_cents: courier.balance_cents ?? 0,
      pix_key: courier.pix_key ?? null,
      plan: plan ?? null,
      plans: plans ?? [],
      withdrawals: withdrawals ?? [],
      week_count: weekCount,
      week_limit: Number(plan?.weekly_withdrawals ?? 2),
      free_withdrawals_left: freeLeft,
      next_fee_cents: freeLeft > 0 ? 0 : WITHDRAWAL_COST_CENTS,
      min_cents: MIN_WITHDRAWAL_CENTS,
      daily_limit_cents: Number(plan?.daily_limit_cents ?? 0),
    };
  });

export const requestCourierWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amount_cents: z.number().int().min(MIN_WITHDRAWAL_CENTS).max(5_000_000),
        pix_key: z.string().trim().min(4).max(140),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) throw new Error("Cadastro não encontrado.");
    if (courier.status !== "approved") throw new Error("Seu cadastro ainda não foi aprovado.");
    if ((courier.balance_cents ?? 0) < data.amount_cents) throw new Error("Saldo insuficiente.");

    const { data: plan } = await (supabase as any)
      .from("courier_plans")
      .select("*")
      .eq("code", courier.plan_code)
      .maybeSingle();

    const [{ data: weekRows }, { data: monthRows }, { data: dayRows }] = await Promise.all([
      (supabase as any).from("courier_withdrawals").select("id").eq("courier_id", courier.id).gte("created_at", weekStart()),
      (supabase as any).from("courier_withdrawals").select("id").eq("courier_id", courier.id).gte("created_at", monthStart()),
      (supabase as any)
        .from("courier_withdrawals")
        .select("amount_cents")
        .eq("courier_id", courier.id)
        .gte("created_at", new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString()),
    ]);

    const weekLimit = Number(plan?.weekly_withdrawals ?? 2);
    if ((weekRows ?? []).length >= weekLimit) {
      throw new Error(`Seu plano permite ${weekLimit} saque(s) por semana. Tente novamente na próxima semana.`);
    }

    const dailyLimit = Number(plan?.daily_limit_cents ?? 0);
    const todayTotal = (dayRows ?? []).reduce((s: number, r: any) => s + Number(r.amount_cents ?? 0), 0);
    if (dailyLimit > 0 && todayTotal + data.amount_cents > dailyLimit) {
      throw new Error("Limite diário de saque do seu plano atingido.");
    }

    const freeLeft = Math.max(Number(plan?.free_withdrawals_month ?? 0) - (monthRows ?? []).length, 0);
    const fee = freeLeft > 0 ? 0 : WITHDRAWAL_COST_CENTS;
    const net = data.amount_cents - fee;
    if (net <= 0) throw new Error("Valor menor que a taxa de transferência.");

    const { error } = await (supabase as any).from("courier_withdrawals").insert({
      courier_id: courier.id,
      amount_cents: data.amount_cents,
      fee_cents: fee,
      net_cents: net,
      pix_key: data.pix_key,
      status: "requested",
    });
    if (error) throw new Error(error.message);

    await (supabase as any)
      .from("couriers")
      .update({
        balance_cents: Math.max((courier.balance_cents ?? 0) - data.amount_cents, 0),
        pix_key: data.pix_key,
        updated_at: new Date().toISOString(),
      })
      .eq("id", courier.id);

    return { ok: true, fee_cents: fee, net_cents: net };
  });

export const changeCourierPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ plan_code: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const courier = await myCourier(supabase, userId);
    if (!courier) throw new Error("Cadastro não encontrado.");
    const { data: plan } = await (supabase as any)
      .from("courier_plans")
      .select("code, price_cents, is_active")
      .eq("code", data.plan_code)
      .maybeSingle();
    if (!plan?.is_active) throw new Error("Plano indisponível.");
    // Planos pagos passam pelo checkout; aqui só o gratuito é aplicado direto.
    if (Number(plan.price_cents ?? 0) > 0) {
      return { ok: false as const, requires_payment: true, plan_code: plan.code };
    }
    await (supabase as any).from("couriers").update({ plan_code: plan.code }).eq("id", courier.id);
    return { ok: true as const, requires_payment: false };
  });
