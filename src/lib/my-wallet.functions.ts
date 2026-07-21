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
