import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachEstablishmentCore, AttachEstablishmentError, type AttachDb } from "@/lib/my-wallet-core";

// Reexporta o erro para consumidores existentes.
export { AttachEstablishmentError };

/** Returns the current user's account type using the DB helper. */
export const getMyAccountType = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("my_account_type");
    if (error) throw error;
    return (data as "customer" | "establishment" | "super_admin" | null) ?? "customer";
  });

/** Full wallet: every customer row bound to the current user + progress. */
export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("customers")
      .select(
        `id, name, code, access_token, last_visit_at, visits_count, tier, pinned_at,
         establishment:establishments!inner(
           id, slug, name, logo_url, primary_color, address, phone, whatsapp,
           instagram, active
         )`,
      )
      .eq("user_id", context.userId)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("last_visit_at", { ascending: false, nullsFirst: false });
    if (error) throw error;

    const customerIds = (rows ?? []).map((r) => r.id);
    if (!customerIds.length) return [];

    // Load cards + campaigns for progress
    const { data: cards } = await context.supabase
      .from("loyalty_cards")
      .select(
        `id, customer_id, stamps, cycle, updated_at,
         campaign:campaigns!inner(id, name, stamps_required, reward_title, reward_description, active, stamp_icon, primary_color, accent_color)`,
      )
      .in("customer_id", customerIds);

    return (rows ?? []).map((r) => {
      const myCards = (cards ?? []).filter((c) => c.customer_id === r.id);
      const best =
        myCards
          .filter((c) => (c.campaign as { active: boolean }).active)
          .sort((a, b) => {
            const aReq = (a.campaign as { stamps_required: number }).stamps_required || 1;
            const bReq = (b.campaign as { stamps_required: number }).stamps_required || 1;
            return b.stamps / bReq - a.stamps / aReq;
          })[0] ?? myCards[0];
      return {
        customer: {
          id: r.id,
          name: r.name,
          code: r.code,
          token: r.access_token,
          lastVisitAt: r.last_visit_at,
          visitsCount: r.visits_count,
          tier: r.tier,
          pinned: !!(r as unknown as { pinned_at: string | null }).pinned_at,
        },
        establishment: r.establishment,
        card: best
          ? {
              id: best.id,
              stamps: best.stamps,
              cycle: best.cycle,
              updatedAt: best.updated_at,
              campaign: best.campaign,
            }
          : null,
        cardsCount: myCards.length,
      };
    });
  });

/**
 * Attaches `access_token`-owned customer to the current auth user.
 * Idempotent; no-op if already linked to this user; errors if linked to someone else.
 */
export const claimCustomerByToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("customers")
      .select("id, user_id, establishment_id, establishments!inner(slug)")
      .eq("access_token", data.token)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Cartão não encontrado.");
    if (row.user_id && row.user_id !== context.userId) {
      throw new Error("Este cartão já está vinculado a outra conta.");
    }
    if (!row.user_id) {
      // Prevent breaking the (establishment_id, user_id) unique constraint:
      // if the user already has ANOTHER customer row in this establishment,
      // keep the existing one and just return.
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id, establishments!inner(slug)")
        .eq("user_id", context.userId)
        .eq("establishment_id", row.establishment_id)
        .maybeSingle();
      if (existing) {
        return { ok: true as const, slug: (existing.establishments as { slug: string }).slug };
      }
      const { error: updErr } = await supabaseAdmin
        .from("customers")
        .update({ user_id: context.userId })
        .eq("id", row.id);
      if (updErr) throw updErr;
    }
    return { ok: true as const, slug: (row.establishments as { slug: string }).slug };
  });

/**
 * Vincula o usuário autenticado ao estabelecimento (pelo slug), reutilizando
 * a linha em `customers` que já exista para o par (establishment, user) ou
 * "adotando" uma linha órfã com o mesmo telefone do profile. Cria também um
 * `loyalty_card` na primeira campanha ativa quando ainda não existir.
 * Idempotente — pode ser chamado várias vezes sem efeitos colaterais.
 */
export const attachEstablishmentBySlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Adapter fino: converte as chamadas do core em queries do supabaseAdmin.
    const db: AttachDb = {
      async getEstablishmentBySlug(slug) {
        const { data, error } = await supabaseAdmin
          .from("establishments").select("id, slug, name, active").eq("slug", slug).maybeSingle();
        if (error) throw error;
        return data ?? null;
      },
      async getProfile(userId) {
        const { data } = await supabaseAdmin
          .from("profiles").select("full_name, phone").eq("id", userId).maybeSingle();
        return data ?? null;
      },
      async getMyCustomer(userId, estId) {
        const { data } = await supabaseAdmin
          .from("customers").select("id")
          .eq("establishment_id", estId).eq("user_id", userId).maybeSingle();
        return data ?? null;
      },
      async findOrphanByPhone(estId, phoneDigits) {
        const { data } = await supabaseAdmin
          .from("customers").select("id")
          .eq("establishment_id", estId).eq("phone", phoneDigits).is("user_id", null).maybeSingle();
        return data ?? null;
      },
      async linkOrphan(customerId, userId) {
        const { error } = await supabaseAdmin
          .from("customers").update({ user_id: userId }).eq("id", customerId);
        if (error) throw error;
      },
      async createCustomer(input) {
        const { data, error } = await supabaseAdmin
          .from("customers")
          .insert({
            establishment_id: input.establishmentId,
            user_id: input.userId,
            name: input.name,
            phone: input.phone,
            marketing_opt_in: false,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data;
      },
      async createConsent(input) {
        await supabaseAdmin.from("consents").insert({
          customer_id: input.customerId,
          establishment_id: input.establishmentId,
          marketing_opt_in: false,
        });
      },
      async getFirstActiveCampaign(estId) {
        const { data } = await supabaseAdmin
          .from("campaigns").select("id")
          .eq("establishment_id", estId).eq("active", true)
          .order("created_at", { ascending: true }).limit(1).maybeSingle();
        return data ?? null;
      },
      async getCard(customerId, campaignId) {
        const { data } = await supabaseAdmin
          .from("loyalty_cards").select("id")
          .eq("customer_id", customerId).eq("campaign_id", campaignId).maybeSingle();
        return data ?? null;
      },
      async createCard(input) {
        const { error } = await supabaseAdmin.from("loyalty_cards").insert({
          customer_id: input.customerId,
          campaign_id: input.campaignId,
          establishment_id: input.establishmentId,
          stamps: 0,
          cycle: 1,
        });
        if (error) throw error;
      },
      async insertAuditLog(row) {
        await supabaseAdmin.from("audit_logs").insert({
          establishment_id: row.establishmentId,
          user_id: row.userId,
          action: row.action,
          entity_type: row.entityType,
          entity_id: row.entityId,
          metadata: row.metadata as never,
        });
      },
    };

    return attachEstablishmentCore(db, { userId: context.userId, slug: data.slug });
  });

/** Wallet detail: one establishment's card for the current user. */
export const getMyEstablishmentCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .select(
        `id, name, code, access_token, last_visit_at, visits_count, tier, referral_code,
         establishment:establishments!inner(
           id, slug, name, logo_url, primary_color, address, phone, whatsapp,
           instagram, active, description
         )`,
      )
      .eq("user_id", context.userId)
      .eq("establishments.slug", data.slug)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;


    const { data: cards } = await context.supabase
      .from("loyalty_cards")
      .select(
        `id, stamps, cycle, updated_at, created_at,
         campaign:campaigns!inner(id, name, stamps_required, reward_title, reward_description, active, stamp_icon, primary_color, accent_color, rules, stamp_validity_days, reward_validity_days)`,
      )
      .eq("customer_id", row.id)
      .order("updated_at", { ascending: false });

    const cardIds = (cards ?? []).map((c) => c.id);

    // Recent stamps for this establishment (all campaigns of this customer).
    let recentStamps: Array<{ id: string; createdAt: string; reverted: boolean; campaignName: string | null }> = [];
    let redeemedRewards: Array<{ id: string; unlockedAt: string; redeemedAt: string; campaignName: string; rewardTitle: string }> = [];
    if (cardIds.length) {
      const { data: sRows } = await context.supabase
        .from("stamps")
        .select("id, card_id, created_at, reverted_at")
        .in("card_id", cardIds)
        .order("created_at", { ascending: false })
        .limit(30);
      const cardName = new Map(
        (cards ?? []).map((c) => [c.id, (c.campaign as { name: string }).name]),
      );
      recentStamps = (sRows ?? []).map((s) => ({
        id: s.id,
        createdAt: s.created_at,
        reverted: !!s.reverted_at,
        campaignName: cardName.get(s.card_id) ?? null,
      }));

      const { data: rRows } = await context.supabase
        .from("rewards")
        .select("id, card_id, unlocked_at, redeemed_at, campaign:campaigns!inner(name, reward_title)")
        .in("card_id", cardIds)
        .not("redeemed_at", "is", null)
        .order("redeemed_at", { ascending: false })
        .limit(20);
      redeemedRewards = (rRows ?? []).map((r) => ({
        id: r.id,
        unlockedAt: r.unlocked_at,
        redeemedAt: r.redeemed_at as string,
        campaignName: (r.campaign as { name: string }).name,
        rewardTitle: (r.campaign as { reward_title: string }).reward_title,
      }));
    }

    return {
      customer: {
        id: row.id,
        name: row.name,
        code: row.code,
        token: row.access_token,
        lastVisitAt: row.last_visit_at,
        visitsCount: row.visits_count,
        tier: row.tier,
        referralCode: row.referral_code,
      },

      establishment: row.establishment,
      cards: cards ?? [],
      recentStamps,
      redeemedRewards,
    };
  });


/** Rewards ready to redeem for the current user (across all cards). */
export const getMyRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: customers, error: cErr } = await context.supabase
      .from("customers")
      .select(`id, establishment:establishments!inner(id, slug, name, logo_url, primary_color, active)`)
      .eq("user_id", context.userId);
    if (cErr) throw cErr;
    const ids = (customers ?? []).map((c) => c.id);
    if (!ids.length) return [] as Array<{
      cardId: string; rewardId: string | null; stamps: number; required: number; reward: string;
      campaignName: string; icon: string; establishment: any; ready: boolean; pct: number;
    }>;

    const { data: cards, error } = await context.supabase
      .from("loyalty_cards")
      .select(`id, customer_id, stamps, updated_at,
        campaign:campaigns!inner(id, name, stamps_required, reward_title, active, stamp_icon, primary_color)`)
      .in("customer_id", ids);
    if (error) throw error;

    // Pending rewards (unlocked, not redeemed) — used to obtain reward_id for temp redeem QR.
    const cardIds = (cards ?? []).map((c) => c.id);
    const pendingByCard = new Map<string, string>();
    if (cardIds.length) {
      const { data: rewardsRows } = await context.supabase
        .from("rewards")
        .select("id, card_id, redeemed_at, unlocked_at")
        .in("card_id", cardIds)
        .is("redeemed_at", null)
        .order("unlocked_at", { ascending: false });
      for (const r of rewardsRows ?? []) {
        if (!pendingByCard.has(r.card_id)) pendingByCard.set(r.card_id, r.id);
      }
    }

    const custMap = new Map((customers ?? []).map((c) => [c.id, c.establishment]));
    return (cards ?? [])
      .filter((c) => (c.campaign as { active: boolean }).active)
      .map((c) => {
        const req = (c.campaign as { stamps_required: number }).stamps_required || 1;
        const pct = Math.min(100, Math.round((c.stamps / req) * 100));
        return {
          cardId: c.id,
          rewardId: pendingByCard.get(c.id) ?? null,
          stamps: c.stamps,
          required: req,
          pct,
          ready: c.stamps >= req,
          reward: (c.campaign as { reward_title: string }).reward_title,
          campaignName: (c.campaign as { name: string }).name,
          icon: (c.campaign as { stamp_icon: string }).stamp_icon,
          establishment: custMap.get(c.customer_id),
        };
      })
      .sort((a, b) => Number(b.ready) - Number(a.ready) || b.pct - a.pct);
  });

/** Chronological history of stamps across all cards for the current user. */
export const getMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: customers, error: cErr } = await context.supabase
      .from("customers")
      .select(`id, establishment:establishments!inner(id, slug, name, logo_url, primary_color)`)
      .eq("user_id", context.userId);
    if (cErr) throw cErr;
    const custIds = (customers ?? []).map((c) => c.id);
    type HistoryItem = {
      id: string;
      kind: "stamp" | "redeem";
      createdAt: string;
      reverted: boolean;
      establishment: any;
      campaignName: string | null;
      rewardTitle: string | null;
    };
    if (!custIds.length) return [] as HistoryItem[];

    const { data: cards } = await context.supabase
      .from("loyalty_cards")
      .select(`id, customer_id, campaign:campaigns!inner(name, reward_title)`)
      .in("customer_id", custIds);
    const cardMap = new Map((cards ?? []).map((c) => [c.id, {
      customerId: c.customer_id,
      campaignName: (c.campaign as { name: string }).name,
      rewardTitle: (c.campaign as { reward_title: string }).reward_title,
    }]));
    const cardIds = (cards ?? []).map((c) => c.id);
    if (!cardIds.length) return [] as HistoryItem[];

    const [{ data: stamps, error }, { data: redemptions }] = await Promise.all([
      context.supabase
        .from("stamps")
        .select(`id, card_id, created_at, reverted_at`)
        .in("card_id", cardIds)
        .order("created_at", { ascending: false })
        .limit(120),
      context.supabase
        .from("rewards")
        .select(`id, card_id, redeemed_at`)
        .in("card_id", cardIds)
        .not("redeemed_at", "is", null)
        .order("redeemed_at", { ascending: false })
        .limit(60),
    ]);
    if (error) throw error;

    const custEstMap = new Map((customers ?? []).map((c) => [c.id, c.establishment]));
    const stampItems: HistoryItem[] = (stamps ?? []).map((s) => {
      const c = cardMap.get(s.card_id);
      return {
        id: `s:${s.id}`,
        kind: "stamp",
        createdAt: s.created_at,
        reverted: !!s.reverted_at,
        establishment: c ? custEstMap.get(c.customerId) : null,
        campaignName: c?.campaignName ?? null,
        rewardTitle: null,
      };
    });
    const redeemItems: HistoryItem[] = (redemptions ?? []).map((r) => {
      const c = cardMap.get(r.card_id);
      return {
        id: `r:${r.id}`,
        kind: "redeem",
        createdAt: r.redeemed_at as string,
        reverted: false,
        establishment: c ? custEstMap.get(c.customerId) : null,
        campaignName: c?.campaignName ?? null,
        rewardTitle: c?.rewardTitle ?? null,
      };
    });
    return [...stampItems, ...redeemItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  });


/**
 * Lista estabelecimentos ativos que o usuário ainda NÃO tem na carteira,
 * ordenados por atividade recente. Base do canal "Descobrir".
 * Sem coordenadas geo por ora — retornamos address/city para exibição.
 */
export const getDiscoveryEstablishments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Estabelecimentos onde o usuário já tem cartão/registro — não excluímos,
    // apenas marcamos como "já visitados" para o cliente ver novidades/promoções.
    const { data: mine } = await context.supabase
      .from("customers")
      .select("establishment_id")
      .eq("user_id", context.userId);
    const visited = new Set((mine ?? []).map((r) => r.establishment_id));

    const { data, error } = await context.supabase
      .from("establishments")
      .select("id, slug, name, logo_url, primary_color, address, city, description, created_at")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    return (data ?? []).map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      logo_url: e.logo_url,
      primary_color: e.primary_color,
      address: e.address,
      city: e.city,
      description: e.description,
      visited: visited.has(e.id),
    }));
  });
