import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
        `id, name, code, access_token, last_visit_at, visits_count, tier,
         establishment:establishments!inner(
           id, slug, name, logo_url, primary_color, address, phone, whatsapp,
           instagram, active
         )`,
      )
      .eq("user_id", context.userId)
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

    const { data: est, error: eErr } = await supabaseAdmin
      .from("establishments")
      .select("id, slug, name, active")
      .eq("slug", data.slug)
      .maybeSingle();
    if (eErr) throw eErr;
    if (!est || !est.active) throw new Error("Estabelecimento indisponível.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();
    const phoneDigits = (profile?.phone ?? "").replace(/\D/g, "").slice(0, 11);

    // 1) Já existe customer deste user neste estabelecimento?
    let { data: mine } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("establishment_id", est.id)
      .eq("user_id", context.userId)
      .maybeSingle();

    // 2) Se não, tenta adotar uma linha órfã com o mesmo telefone (criada
    //    manualmente pelo lojista antes do cliente ter conta).
    let adopted = false;
    if (!mine && phoneDigits.length >= 10) {
      const { data: orphan } = await supabaseAdmin
        .from("customers")
        .select("id, user_id")
        .eq("establishment_id", est.id)
        .eq("phone", phoneDigits)
        .is("user_id", null)
        .maybeSingle();
      if (orphan) {
        const { error: linkErr } = await supabaseAdmin
          .from("customers")
          .update({ user_id: context.userId })
          .eq("id", orphan.id);
        if (linkErr) throw linkErr;
        mine = { id: orphan.id };
        adopted = true;
      }
    }

    // 3) Caso ainda não haja linha, cria uma nova para este estabelecimento.
    let created = false;
    if (!mine) {
      const { data: nc, error: cErr } = await supabaseAdmin
        .from("customers")
        .insert({
          establishment_id: est.id,
          user_id: context.userId,
          name: profile?.full_name ?? "Cliente Fidelize",
          phone: phoneDigits || "",
          marketing_opt_in: false,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;
      mine = nc;
      created = true;
      await supabaseAdmin.from("consents").insert({
        customer_id: mine.id,
        establishment_id: est.id,
        marketing_opt_in: false,
      });
    }

    // 4) Garante um cartão na campanha ativa mais antiga.
    const { data: campaign } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("establishment_id", est.id)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (campaign) {
      const { data: existingCard } = await supabaseAdmin
        .from("loyalty_cards")
        .select("id")
        .eq("customer_id", mine.id)
        .eq("campaign_id", campaign.id)
        .maybeSingle();
      if (!existingCard) {
        await supabaseAdmin.from("loyalty_cards").insert({
          customer_id: mine.id,
          campaign_id: campaign.id,
          establishment_id: est.id,
          stamps: 0,
          cycle: 1,
        });
      }
    }

    return {
      ok: true as const,
      slug: est.slug,
      name: est.name,
      status: created ? ("created" as const) : adopted ? ("adopted" as const) : ("existing" as const),
    };
  });

/** Wallet detail: one establishment's card for the current user. */
export const getMyEstablishmentCard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .select(
        `id, name, code, access_token, last_visit_at, visits_count, tier,
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
         campaign:campaigns!inner(id, name, stamps_required, reward_title, reward_description, active, stamp_icon, primary_color, accent_color, rules)`,
      )
      .eq("customer_id", row.id)
      .order("updated_at", { ascending: false });

    return {
      customer: {
        id: row.id,
        name: row.name,
        code: row.code,
        token: row.access_token,
        lastVisitAt: row.last_visit_at,
        visitsCount: row.visits_count,
        tier: row.tier,
      },
      establishment: row.establishment,
      cards: cards ?? [],
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
      cardId: string; stamps: number; required: number; reward: string;
      campaignName: string; icon: string; establishment: any; ready: boolean; pct: number;
    }>;

    const { data: cards, error } = await context.supabase
      .from("loyalty_cards")
      .select(`id, customer_id, stamps, updated_at,
        campaign:campaigns!inner(id, name, stamps_required, reward_title, active, stamp_icon, primary_color)`)
      .in("customer_id", ids);
    if (error) throw error;

    const custMap = new Map((customers ?? []).map((c) => [c.id, c.establishment]));
    return (cards ?? [])
      .filter((c) => (c.campaign as { active: boolean }).active)
      .map((c) => {
        const req = (c.campaign as { stamps_required: number }).stamps_required || 1;
        const pct = Math.min(100, Math.round((c.stamps / req) * 100));
        return {
          cardId: c.id,
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
    if (!custIds.length) return [] as Array<{
      id: string; createdAt: string; reverted: boolean; establishment: any; campaignName: string | null;
    }>;

    const { data: cards } = await context.supabase
      .from("loyalty_cards")
      .select(`id, customer_id, campaign:campaigns!inner(name)`)
      .in("customer_id", custIds);
    const cardMap = new Map((cards ?? []).map((c) => [c.id, {
      customerId: c.customer_id,
      campaignName: (c.campaign as { name: string }).name,
    }]));
    const cardIds = (cards ?? []).map((c) => c.id);
    if (!cardIds.length) return [];

    const { data: stamps, error } = await context.supabase
      .from("stamps")
      .select(`id, card_id, created_at, reverted_at`)
      .in("card_id", cardIds)
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw error;

    const custEstMap = new Map((customers ?? []).map((c) => [c.id, c.establishment]));
    return (stamps ?? []).map((s) => {
      const c = cardMap.get(s.card_id);
      return {
        id: s.id,
        createdAt: s.created_at,
        reverted: !!s.reverted_at,
        establishment: c ? custEstMap.get(c.customerId) : null,
        campaignName: c?.campaignName ?? null,
      };
    });
  });
