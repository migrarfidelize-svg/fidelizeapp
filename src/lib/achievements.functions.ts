import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AchievementCatalog = {
  code: string;
  title: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  criteriaType: string;
  criteriaValue: number;
  sortOrder: number;
};

export type MyAchievement = {
  code: string;
  unlockedAt: string;
  seenAt: string | null;
};

/** Catálogo público de todas as conquistas ativas. */
export const listAchievementsCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("achievements")
      .select("code, title, description, icon, rarity, criteria_type, criteria_value, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((a) => ({
      code: a.code,
      title: a.title,
      description: a.description,
      icon: a.icon,
      rarity: a.rarity as AchievementCatalog["rarity"],
      criteriaType: a.criteria_type,
      criteriaValue: a.criteria_value,
      sortOrder: a.sort_order,
    }));
  });

/** Conquistas desbloqueadas pelo usuário atual. */
export const listMyAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAchievement[]> => {
    const { data, error } = await context.supabase
      .from("customer_achievements")
      .select("achievement_code, unlocked_at, seen_at")
      .eq("user_id", context.userId)
      .order("unlocked_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      code: r.achievement_code,
      unlockedAt: r.unlocked_at,
      seenAt: r.seen_at,
    }));
  });

/** Executa a checagem completa (útil para retrofit / após ações fora dos triggers). */
export const runAchievementsCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("check_and_unlock_achievements", {
      _user_id: context.userId,
    });
    if (error) throw error;
    return { unlocked: (data as number) ?? 0 };
  });

/** Marca conquistas como vistas (dispensa o toast de desbloqueio). */
export const markAchievementsSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ codes: z.array(z.string()).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.codes.length) return { ok: true as const };
    const { error } = await context.supabase
      .from("customer_achievements")
      .update({ seen_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .in("achievement_code", data.codes);
    if (error) throw error;
    return { ok: true as const };
  });

/** Retrospectiva pessoal — números do ano corrente. */
export const getMyYearRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const now = new Date();
    const year = now.getFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString();

    // customers do usuário
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id, establishment:establishments!inner(id, name, primary_color, logo_url, slug)")
      .eq("user_id", context.userId);
    const custIds = (customers ?? []).map((c) => c.id);
    if (!custIds.length) {
      return {
        year,
        totalStamps: 0,
        totalRewards: 0,
        establishmentsCount: 0,
        favoriteEstablishment: null as null | { name: string; slug: string; primaryColor: string; logoUrl: string | null; stamps: number },
        busiestMonth: null as null | { month: number; count: number },
        achievementsUnlocked: 0,
        firstStampAt: null as string | null,
      };
    }

    // cards
    const { data: cards } = await context.supabase
      .from("loyalty_cards")
      .select("id, customer_id")
      .in("customer_id", custIds);
    const cardIds = (cards ?? []).map((c) => c.id);

    // stamps do ano
    let stamps: Array<{ id: string; created_at: string; card_id: string }> = [];
    if (cardIds.length) {
      const { data } = await context.supabase
        .from("stamps")
        .select("id, created_at, card_id")
        .in("card_id", cardIds)
        .is("reverted_at", null)
        .gte("created_at", yearStart);
      stamps = data ?? [];
    }

    // rewards resgatados no ano
    let rewardsCount = 0;
    if (cardIds.length) {
      const { count } = await context.supabase
        .from("rewards")
        .select("id", { count: "exact", head: true })
        .in("card_id", cardIds)
        .not("redeemed_at", "is", null)
        .gte("redeemed_at", yearStart);
      rewardsCount = count ?? 0;
    }

    // conquistas desbloqueadas no ano
    const { count: achCount } = await context.supabase
      .from("customer_achievements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("unlocked_at", yearStart);

    // agregações
    const cardToCustomer = new Map((cards ?? []).map((c) => [c.id, c.customer_id]));
    const custToEst = new Map(
      (customers ?? []).map((c) => [c.id, c.establishment as { id: string; name: string; slug: string; primary_color: string; logo_url: string | null }]),
    );

    const perEstab = new Map<string, number>();
    const perMonth = new Map<number, number>();
    let firstStamp: string | null = null;

    for (const s of stamps) {
      const custId = cardToCustomer.get(s.card_id);
      const est = custId ? custToEst.get(custId) : null;
      if (est) perEstab.set(est.id, (perEstab.get(est.id) ?? 0) + 1);
      const m = new Date(s.created_at).getUTCMonth();
      perMonth.set(m, (perMonth.get(m) ?? 0) + 1);
      if (!firstStamp || s.created_at < firstStamp) firstStamp = s.created_at;
    }

    let favorite: { name: string; slug: string; primaryColor: string; logoUrl: string | null; stamps: number } | null = null;
    for (const [estId, count] of perEstab) {
      if (!favorite || count > favorite.stamps) {
        const meta = Array.from(custToEst.values()).find((e) => e.id === estId);
        if (meta) {
          favorite = {
            name: meta.name,
            slug: meta.slug,
            primaryColor: meta.primary_color,
            logoUrl: meta.logo_url,
            stamps: count,
          };
        }
      }
    }

    let busiest: { month: number; count: number } | null = null;
    for (const [month, count] of perMonth) {
      if (!busiest || count > busiest.count) busiest = { month, count };
    }

    return {
      year,
      totalStamps: stamps.length,
      totalRewards: rewardsCount,
      establishmentsCount: perEstab.size,
      favoriteEstablishment: favorite,
      busiestMonth: busiest,
      achievementsUnlocked: achCount ?? 0,
      firstStampAt: firstStamp,
    };
  });
