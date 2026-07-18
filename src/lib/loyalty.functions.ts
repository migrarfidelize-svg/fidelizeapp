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

// ---------- Public: get establishment by slug ----------
export const getEstablishmentBySlug = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const s = publicClient();
    const { data: est, error } = await s
      .from("establishments")
      .select("id, slug, name, description, address, phone, whatsapp, instagram, business_hours, logo_url, cover_url, primary_color, accent_color, plan, active")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!est) return null;
    const { data: campaigns } = await s
      .from("campaigns")
      .select("id, name, type, stamps_required, reward_title, reward_description, rules, stamp_icon, reward_validity_days")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .order("created_at", { ascending: true });
    return { establishment: est, campaigns: campaigns ?? [] };
  });

// ---------- Public: create or fetch customer + card ----------
export const registerOrLoginCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    campaign_id: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(10).max(11),
    email: z.string().email().max(120).optional().or(z.literal("")).transform(v => v || undefined),
    marketing_opt_in: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Try find existing
    const { data: existing } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .eq("phone", data.phone)
      .maybeSingle();

    let customer = existing;
    if (!customer) {
      const { data: created, error: e1 } = await supabaseAdmin
        .from("customers")
        .insert({
          establishment_id: data.establishment_id,
          name: data.name,
          phone: data.phone,
          email: data.email,
          marketing_opt_in: data.marketing_opt_in,
        })
        .select("*")
        .single();
      if (e1) throw new Error(e1.message);
      customer = created;
      await supabaseAdmin.from("consents").insert({
        customer_id: customer.id,
        establishment_id: data.establishment_id,
        marketing_opt_in: data.marketing_opt_in,
      });
    }

    // Ensure loyalty card exists
    const { data: card } = await supabaseAdmin
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer!.id)
      .eq("campaign_id", data.campaign_id)
      .maybeSingle();
    let cardRow = card;
    if (!cardRow) {
      const { data: nc, error: ec } = await supabaseAdmin
        .from("loyalty_cards")
        .insert({
          customer_id: customer!.id,
          campaign_id: data.campaign_id,
          establishment_id: data.establishment_id,
          stamps: 0, cycle: 1,
        }).select("*").single();
      if (ec) throw new Error(ec.message);
      cardRow = nc;
    }
    return { access_token: customer!.access_token, card_id: cardRow!.id };
  });

// ---------- Public: fetch card details by token ----------
export const getCardByToken = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(20).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: customer } = await supabaseAdmin
      .from("customers").select("*").eq("access_token", data.token).maybeSingle();
    if (!customer) return null;
    const { data: est } = await supabaseAdmin
      .from("establishments").select("id, slug, name, logo_url, primary_color, accent_color").eq("id", customer.establishment_id).single();
    const { data: cards } = await supabaseAdmin
      .from("loyalty_cards").select("*, campaigns(*)").eq("customer_id", customer.id);
    const { data: recentStamps } = await supabaseAdmin
      .from("stamps").select("id, created_at, cycle, reverted_at").in("card_id", (cards ?? []).map(c => c.id)).order("created_at", { ascending: false }).limit(20);
    const { data: rewards } = await supabaseAdmin
      .from("rewards").select("*").in("card_id", (cards ?? []).map(c => c.id)).order("unlocked_at", { ascending: false });
    return { customer, establishment: est, cards: cards ?? [], stamps: recentStamps ?? [], rewards: rewards ?? [] };
  });

// ---------- Authenticated: staff add stamp ----------
async function auditLog(estId: string, userId: string, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    establishment_id: estId, user_id: userId, action, entity_type: entity, entity_id: entityId,
    metadata: meta as never,
  });
}

export const addStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    card_id: z.string().uuid(),
    note: z.string().max(200).optional(),
    pin: z.string().regex(/^\d{4,6}$/).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: card, error } = await supabase.from("loyalty_cards").select("*, campaigns(*)").eq("id", data.card_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!card) throw new Error("Cartão não encontrado");
    // PIN gate (if enabled in settings)
    const { data: settings } = await supabase.from("establishment_settings").select("security").eq("establishment_id", card.establishment_id).maybeSingle();
    const requirePin = (settings as any)?.security?.require_pin_to_stamp === true;
    if (requirePin) {
      if (!data.pin) throw new Error("PIN obrigatório para carimbar");
      const { data: member } = await supabase.from("establishment_members").select("pin_hash").eq("establishment_id", card.establishment_id).eq("user_id", userId).maybeSingle();
      if (!member?.pin_hash) throw new Error("Você ainda não definiu seu PIN em Configurações › Segurança");
      const { scryptSync, timingSafeEqual } = await import("crypto");
      const [salt, hash] = String(member.pin_hash).split("$");
      const derived = scryptSync(data.pin, salt, 32);
      const okPin = derived.length === Buffer.from(hash, "hex").length && timingSafeEqual(derived, Buffer.from(hash, "hex"));
      if (!okPin) throw new Error("PIN incorreto");
    }


    // Rate limit: no stamp in last 10s
    const { data: last } = await supabase.from("stamps").select("created_at").eq("card_id", card.id).is("reverted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < 10_000) {
      throw new Error("Aguarde alguns segundos antes de adicionar outro carimbo.");
    }

    const campaign = card.campaigns as { stamps_required: number; reward_validity_days: number | null; id: string };
    const newStamps = card.stamps + 1;
    const completed = newStamps >= campaign.stamps_required;

    await supabase.from("stamps").insert({
      card_id: card.id, establishment_id: card.establishment_id, added_by: userId, cycle: card.cycle,
    });

    if (completed) {
      const expires = campaign.reward_validity_days ? new Date(Date.now() + campaign.reward_validity_days * 86400_000).toISOString() : null;
      await supabase.from("rewards").insert({
        card_id: card.id, campaign_id: campaign.id, establishment_id: card.establishment_id,
        cycle: card.cycle, expires_at: expires,
      });
      await supabase.from("loyalty_cards").update({ stamps: 0, cycle: card.cycle + 1 }).eq("id", card.id);
    } else {
      await supabase.from("loyalty_cards").update({ stamps: newStamps }).eq("id", card.id);
    }
    await supabase.from("customers").update({
      last_visit_at: new Date().toISOString(),
      visits_count: (await supabase.from("customers").select("visits_count").eq("id", card.customer_id).single()).data!.visits_count + 1,
    }).eq("id", card.customer_id);

    await auditLog(card.establishment_id, userId, "stamp_added", "loyalty_card", card.id, { completed });
    return { completed, stamps: completed ? 0 : newStamps, required: campaign.stamps_required, cycle: completed ? card.cycle + 1 : card.cycle };
  });

export const undoLastStamp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ card_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: last } = await supabase.from("stamps").select("*").eq("card_id", data.card_id).is("reverted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) throw new Error("Nenhum carimbo para desfazer");
    if (Date.now() - new Date(last.created_at).getTime() > 60_000) throw new Error("Prazo para desfazer expirou (60s)");
    await supabase.from("stamps").update({ reverted_at: new Date().toISOString(), reverted_by: userId }).eq("id", last.id);
    const { data: card } = await supabase.from("loyalty_cards").select("*").eq("id", data.card_id).single();
    await supabase.from("loyalty_cards").update({ stamps: Math.max(0, card!.stamps - 1) }).eq("id", data.card_id);
    await auditLog(card!.establishment_id, userId, "stamp_undone", "loyalty_card", data.card_id, {});
    return { ok: true };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reward_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: reward } = await supabase.from("rewards").select("*").eq("id", data.reward_id).maybeSingle();
    if (!reward) throw new Error("Recompensa não encontrada");
    if (reward.redeemed_at) throw new Error("Já resgatada");
    await supabase.from("rewards").update({ redeemed_at: new Date().toISOString(), redeemed_by: userId }).eq("id", data.reward_id);
    await auditLog(reward.establishment_id, userId, "reward_redeemed", "reward", data.reward_id, {});
    return { ok: true };
  });

// ---------- Authenticated: search customers ----------
export const searchCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    query: z.string().trim().min(1).max(80),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const q = data.query;
    const isPhone = /^\d+$/.test(q);
    const filter = isPhone
      ? `phone.ilike.%${q}%,code.ilike.%${q}%`
      : `name.ilike.%${q}%,phone.ilike.%${q}%,code.ilike.%${q}%,email.ilike.%${q}%`;
    const { data: customers, error } = await supabase.from("customers")
      .select("id, name, phone, code, email, visits_count, last_visit_at")
      .eq("establishment_id", data.establishment_id)
      .or(filter)
      .limit(20);
    if (error) throw new Error(error.message);
    return customers ?? [];
  });

export const getCustomerTokenByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    establishment_id: z.string().uuid(),
    code: z.string().trim().min(3).max(20),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase.from("customers")
      .select("access_token")
      .eq("establishment_id", data.establishment_id)
      .eq("code", data.code)
      .maybeSingle();
    return row?.access_token ?? null;
  });


// ---------- Onboarding ----------
const SLUG_RESERVED = new Set(["app", "admin", "auth", "onboarding", "api", "l", "c", "precos", "termos", "privacidade", "404", "bloqueado"]);

const establishmentSchema = z.object({
  name: z.string({ required_error: "Informe o nome da empresa." })
    .trim()
    .min(2, "O nome da empresa precisa ter pelo menos 2 caracteres.")
    .max(80, "O nome da empresa pode ter no máximo 80 caracteres."),
  slug: z.string({ required_error: "Informe o endereço público." })
    .trim()
    .toLowerCase()
    .min(3, "O endereço público precisa ter pelo menos 3 caracteres.")
    .max(60, "O endereço público pode ter no máximo 60 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens (sem espaços ou acentos).")
    .refine((v) => !SLUG_RESERVED.has(v), "Este endereço é reservado. Escolha outro."),
  description: z.string().max(500, "A descrição pode ter no máximo 500 caracteres.").optional(),
  address: z.string().max(200, "O endereço pode ter no máximo 200 caracteres.").optional(),
  phone: z.string().max(20, "Telefone inválido.").optional(),
  whatsapp: z.string().max(20, "WhatsApp inválido.").optional(),
  primary_color: z.string().max(20).default("#5B21B6"),
  accent_color: z.string().max(20).default("#F97066"),
  logo_url: z.string().max(2000, "Link do logo muito longo.").url("Link do logo inválido.").optional().or(z.literal("")).transform((v) => v || undefined),
  campaign_name: z.string().trim().min(2, "O nome da campanha precisa ter pelo menos 2 caracteres.").max(80).default("Cartão Fidelidade"),
  stamps_required: z.number({ invalid_type_error: "Número de carimbos inválido." }).int().min(2, "Mínimo de 2 carimbos.").max(50, "Máximo de 50 carimbos.").default(10),
  reward_title: z.string({ required_error: "Descreva a recompensa da campanha." }).trim().min(2, "Descreva a recompensa com pelo menos 2 caracteres.").max(120, "A recompensa pode ter no máximo 120 caracteres."),
  reward_description: z.string().max(500, "Os detalhes da recompensa podem ter no máximo 500 caracteres.").optional(),
});

function parseEstablishmentInput(d: unknown) {
  const r = establishmentSchema.safeParse(d);
  if (r.success) return r.data;
  // Retorna a primeira mensagem em pt-BR (sempre já traduzida acima).
  const first = r.error.errors[0];
  throw new Error(first?.message ?? "Dados inválidos. Revise o formulário.");
}

export const createEstablishment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseEstablishmentInput(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: est, error } = await supabase.from("establishments").insert({
      slug: data.slug, name: data.name, description: data.description, address: data.address, phone: data.phone, whatsapp: data.whatsapp,
      primary_color: data.primary_color, accent_color: data.accent_color, logo_url: data.logo_url, created_by: userId,
    }).select("*").single();
    if (error) {
      if (error.code === "23505") throw new Error("Este endereço já está em uso, escolha outro.");
      throw new Error("Não foi possível criar a empresa. Tente novamente em instantes.");
    }
    await supabase.from("establishment_members").insert({ establishment_id: est.id, user_id: userId, role: "owner" });
    const { data: camp, error: ce } = await supabase.from("campaigns").insert({
      establishment_id: est.id, name: data.campaign_name, stamps_required: data.stamps_required,
      reward_title: data.reward_title, reward_description: data.reward_description,
    }).select("id").single();
    if (ce) throw new Error(ce.message);
    return { establishment_id: est.id, slug: est.slug, campaign_id: camp.id };
  });

export const getMyEstablishments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("establishment_members")
      .select("role, establishment:establishments(*)")
      .eq("user_id", userId).eq("active", true);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getDashboardData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const est = data.establishment_id;
    const [{ count: customersCount }, { count: stampsCount }, { count: rewardsCount }, { count: redeemedCount }, { data: recentStamps }, { data: topCustomers }] = await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }).eq("establishment_id", est),
      supabase.from("stamps").select("*", { count: "exact", head: true }).eq("establishment_id", est).is("reverted_at", null),
      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("establishment_id", est),
      supabase.from("rewards").select("*", { count: "exact", head: true }).eq("establishment_id", est).not("redeemed_at", "is", null),
      supabase.from("stamps").select("id, created_at").eq("establishment_id", est).is("reverted_at", null).gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
      supabase.from("customers").select("id, name, visits_count, last_visit_at").eq("establishment_id", est).order("visits_count", { ascending: false }).limit(5),
    ]);
    // Build 30-day series
    const days: { day: string; carimbos: number }[] = [];
    const map = new Map<string, number>();
    (recentStamps ?? []).forEach((s) => {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      days.push({ day: d.slice(5), carimbos: map.get(d) ?? 0 });
    }
    return {
      customersCount: customersCount ?? 0,
      stampsCount: stampsCount ?? 0,
      rewardsCount: rewardsCount ?? 0,
      redeemedCount: redeemedCount ?? 0,
      series: days,
      topCustomers: topCustomers ?? [],
    };
  });

export const getEstablishmentCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.from("campaigns")
      .select("id, name, type, reward_title, reward_description, rules, stamps_required, stamp_icon, stamp_validity_days, reward_validity_days, active, created_at")
      .eq("establishment_id", data.establishment_id)
      .order("active", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map(r => r.id);
    if (ids.length === 0) return [];
    const [{ data: cards }, { data: rewards }] = await Promise.all([
      supabase.from("loyalty_cards").select("id, campaign_id").in("campaign_id", ids),
      supabase.from("rewards").select("id, campaign_id, redeemed_at").in("campaign_id", ids),
    ]);
    const cardCount = new Map<string, number>();
    (cards ?? []).forEach(c => cardCount.set(c.campaign_id, (cardCount.get(c.campaign_id) ?? 0) + 1));
    const rewardCount = new Map<string, { unlocked: number; redeemed: number }>();
    (rewards ?? []).forEach(r => {
      const cur = rewardCount.get(r.campaign_id) ?? { unlocked: 0, redeemed: 0 };
      cur.unlocked += 1;
      if (r.redeemed_at) cur.redeemed += 1;
      rewardCount.set(r.campaign_id, cur);
    });
    return (rows ?? []).map(r => ({
      ...r,
      cards_count: cardCount.get(r.id) ?? 0,
      rewards_unlocked: rewardCount.get(r.id)?.unlocked ?? 0,
      rewards_redeemed: rewardCount.get(r.id)?.redeemed ?? 0,
    }));
  });

// ---------- Campaign CRUD ----------
const campaignInput = z.object({
  name: z.string().trim().min(2, "Nome muito curto.").max(80, "Nome muito longo."),
  reward_title: z.string().trim().min(2, "Descreva a recompensa.").max(120),
  reward_description: z.string().max(500).optional().or(z.literal("")).transform(v => v || undefined),
  rules: z.string().max(1000).optional().or(z.literal("")).transform(v => v || undefined),
  stamps_required: z.number().int().min(2, "Mínimo de 2 carimbos.").max(50, "Máximo de 50 carimbos."),
  stamp_icon: z.enum(["star", "heart", "check", "coffee"]).default("star"),
  stamp_validity_days: z.number().int().min(0).max(3650).nullable().optional(),
  reward_validity_days: z.number().int().min(0).max(3650).nullable().optional(),
});

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ establishment_id: z.string().uuid() }).and(campaignInput).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { establishment_id, ...rest } = data;
    const { data: row, error } = await supabase.from("campaigns").insert({
      establishment_id,
      name: rest.name,
      reward_title: rest.reward_title,
      reward_description: rest.reward_description,
      rules: rest.rules,
      stamps_required: rest.stamps_required,
      stamp_icon: rest.stamp_icon,
      stamp_validity_days: rest.stamp_validity_days ?? null,
      reward_validity_days: rest.reward_validity_days ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await auditLog(establishment_id, userId, "campaign_created", "campaign", row.id, { name: rest.name });
    return row;
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).and(campaignInput).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...rest } = data;
    const { data: cur } = await supabase.from("campaigns").select("establishment_id").eq("id", id).maybeSingle();
    if (!cur) throw new Error("Campanha não encontrada");
    const { error } = await supabase.from("campaigns").update({
      name: rest.name,
      reward_title: rest.reward_title,
      reward_description: rest.reward_description,
      rules: rest.rules,
      stamps_required: rest.stamps_required,
      stamp_icon: rest.stamp_icon,
      stamp_validity_days: rest.stamp_validity_days ?? null,
      reward_validity_days: rest.reward_validity_days ?? null,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    await auditLog(cur.establishment_id, userId, "campaign_updated", "campaign", id, { name: rest.name });
    return { ok: true };
  });

export const toggleCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase.from("campaigns").select("establishment_id").eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Campanha não encontrada");
    const { error } = await supabase.from("campaigns").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditLog(cur.establishment_id, userId, data.active ? "campaign_activated" : "campaign_paused", "campaign", data.id, {});
    return { ok: true };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cur } = await supabase.from("campaigns").select("establishment_id").eq("id", data.id).maybeSingle();
    if (!cur) throw new Error("Campanha não encontrada");
    const { count } = await supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("campaign_id", data.id);
    if ((count ?? 0) > 0) throw new Error("Esta campanha já possui cartões emitidos. Pause-a em vez de excluir.");
    const { error } = await supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditLog(cur.establishment_id, userId, "campaign_deleted", "campaign", data.id, {});
    return { ok: true };
  });


