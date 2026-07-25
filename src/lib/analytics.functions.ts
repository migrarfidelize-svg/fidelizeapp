import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Recap Analytics 2.0 — coortes semanais + breakdown por estabelecimento.
 * Escopo por RLS: só retorna dados de estabelecimentos onde o usuário é membro.
 */

const WEEK_MS = 7 * 86400_000;

function isoWeekStart(d: Date): Date {
  // Semana começando na segunda (UTC) — normaliza para o dia às 00:00.
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = u.getUTCDay(); // 0=dom .. 6=sab
  const diff = (day + 6) % 7; // dias desde segunda
  u.setUTCDate(u.getUTCDate() - diff);
  return u;
}

function fmtWeek(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type CohortRow = {
  week: string;         // yyyy-mm-dd (segunda-feira)
  size: number;         // novos clientes na semana
  w0: number;           // % ativos na semana 0 (sempre 100 se size>0)
  w1: number;
  w2: number;
  w3: number;
  stampsTotal: number;  // carimbos dessa coorte em 4 semanas
};

export type EstablishmentBreakdown = {
  id: string;
  name: string;
  slug: string;
  customers: number;
  stamps: number;
  redemptions: number;
  achievements: number;
};

export type ChannelStats = {
  linktree: { views: number; clicks: number; ctr: number; topLinks: { ref_id: string; label: string; clicks: number }[] };
  reviews: { views: number };
  loyalty: { views: number };
  qr: { scansMain: number; scansSecond: number; total: number };
  weekly: { week: string; linktreeViews: number; linktreeClicks: number; reviewsViews: number; loyaltyViews: number; qrScans: number }[];
};

export type RecapAnalytics = {
  weeks: { week: string; stamps: number; redemptions: number; achievements: number }[];
  cohorts: CohortRow[];
  perEstablishment: EstablishmentBreakdown[];
  topCampaigns: { id: string; title: string; redemptions: number }[];
  topAchievements: { code: string; title: string; icon: string; count: number }[];
  totals: { stamps: number; redemptions: number; achievements: number; newCustomers: number };
  channels: ChannelStats;
};

export const getRecapAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      establishment_id: z.string().uuid().optional(),
      weeks: z.number().int().min(4).max(26).default(12),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<RecapAnalytics> => {
    const { supabase } = context;
    const weeksBack = data.weeks;

    // Descobre estabelecimentos acessíveis (RLS-safe).
    const { data: memberships } = await supabase
      .from("establishment_members")
      .select("establishment:establishments!inner(id, name, slug)")
      .eq("active", true);
    const allEsts = (memberships ?? [])
      .map((m) => m.establishment as unknown as { id: string; name: string; slug: string })
      .filter(Boolean);
    const emptyChannels: ChannelStats = {
      linktree: { views: 0, clicks: 0, ctr: 0, topLinks: [] },
      reviews: { views: 0 },
      loyalty: { views: 0 },
      qr: { scansMain: 0, scansSecond: 0, total: 0 },
      weekly: [],
    };
    if (allEsts.length === 0) {
      return {
        weeks: [], cohorts: [], perEstablishment: [], topCampaigns: [], topAchievements: [],
        totals: { stamps: 0, redemptions: 0, achievements: 0, newCustomers: 0 },
        channels: emptyChannels,
      };
    }
    const selectedEsts = data.establishment_id
      ? allEsts.filter((e) => e.id === data.establishment_id)
      : allEsts;
    if (selectedEsts.length === 0) {
      throw new Error("Estabelecimento não autorizado");
    }
    const estIds = selectedEsts.map((e) => e.id);

    const now = new Date();
    const currentWeek = isoWeekStart(now);
    const startWeek = new Date(currentWeek.getTime() - (weeksBack - 1) * WEEK_MS);
    const startIso = startWeek.toISOString();

    const [stampsRes, rewardsRes, achRes, customersRes, campaignsRes, achCatalogRes] = await Promise.all([
      supabase.from("stamps")
        .select("id, created_at, card_id, establishment_id")
        .in("establishment_id", estIds)
        .is("reverted_at", null)
        .gte("created_at", startIso),
      supabase.from("rewards")
        .select("id, redeemed_at, establishment_id, campaign_id")
        .in("establishment_id", estIds)
        .not("redeemed_at", "is", null)
        .gte("redeemed_at", startIso),
      supabase.from("customer_achievements")
        .select("achievement_code, unlocked_at, establishment_id")
        .in("establishment_id", estIds)
        .gte("unlocked_at", startIso),
      supabase.from("customers")
        .select("id, establishment_id, created_at")
        .in("establishment_id", estIds),
      supabase.from("campaigns")
        .select("id, name, reward_title, establishment_id")
        .in("establishment_id", estIds),
      supabase.from("achievements")
        .select("code, title, icon")
        .eq("is_active", true),
    ]);

    const stamps = stampsRes.data ?? [];
    const rewards = rewardsRes.data ?? [];
    const achievements = achRes.data ?? [];
    const customers = customersRes.data ?? [];
    const campaigns = campaignsRes.data ?? [];
    const achCatalog = achCatalogRes.data ?? [];

    // Card → customer map (para coortes com base em cliente).
    const cardIds = Array.from(new Set(stamps.map((s) => s.card_id).filter(Boolean)));
    const cardToCustomer = new Map<string, string>();
    if (cardIds.length) {
      const { data: cardsData } = await supabase
        .from("loyalty_cards")
        .select("id, customer_id")
        .in("id", cardIds);
      (cardsData ?? []).forEach((c) => cardToCustomer.set(c.id, c.customer_id));
    }

    // ---------- Weekly timeline ----------
    const weekKeys: string[] = [];
    for (let i = 0; i < weeksBack; i++) {
      weekKeys.push(fmtWeek(new Date(startWeek.getTime() + i * WEEK_MS)));
    }
    const weekMap = new Map<string, { stamps: number; redemptions: number; achievements: number }>();
    weekKeys.forEach((k) => weekMap.set(k, { stamps: 0, redemptions: 0, achievements: 0 }));

    const bucketWeek = (iso: string): string | null => {
      const wk = fmtWeek(isoWeekStart(new Date(iso)));
      return weekMap.has(wk) ? wk : null;
    };

    for (const s of stamps) {
      const wk = bucketWeek(s.created_at);
      if (wk) weekMap.get(wk)!.stamps++;
    }
    for (const r of rewards) {
      if (!r.redeemed_at) continue;
      const wk = bucketWeek(r.redeemed_at);
      if (wk) weekMap.get(wk)!.redemptions++;
    }
    for (const a of achievements) {
      const wk = bucketWeek(a.unlocked_at);
      if (wk) weekMap.get(wk)!.achievements++;
    }

    const weeks = weekKeys.map((k) => ({ week: k, ...weekMap.get(k)! }));

    // ---------- Coortes: novos clientes por semana + retenção via carimbos ----------
    const cohortCustomers = new Map<string, string[]>(); // week -> customerIds
    for (const c of customers) {
      const wk = fmtWeek(isoWeekStart(new Date(c.created_at)));
      if (!weekMap.has(wk)) continue;
      if (!cohortCustomers.has(wk)) cohortCustomers.set(wk, []);
      cohortCustomers.get(wk)!.push(c.id);
    }

    // customerId -> stamps timeline
    const stampsByCustomer = new Map<string, Date[]>();
    for (const s of stamps) {
      const custId = cardToCustomer.get(s.card_id);
      if (!custId) continue;
      const arr = stampsByCustomer.get(custId) ?? [];
      arr.push(new Date(s.created_at));
      stampsByCustomer.set(custId, arr);
    }

    const cohorts: CohortRow[] = weekKeys.map((wk) => {
      const custIds = cohortCustomers.get(wk) ?? [];
      const size = custIds.length;
      const cohortStart = new Date(wk + "T00:00:00Z").getTime();
      const activePerWeek = [new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()];
      let stampsTotal = 0;
      for (const cid of custIds) {
        const times = stampsByCustomer.get(cid) ?? [];
        for (const t of times) {
          const delta = t.getTime() - cohortStart;
          if (delta < 0) continue;
          const wkIdx = Math.floor(delta / WEEK_MS);
          if (wkIdx >= 0 && wkIdx < 4) {
            activePerWeek[wkIdx].add(cid);
            stampsTotal++;
          }
        }
      }
      const pct = (n: number) => (size > 0 ? Math.round((n / size) * 100) : 0);
      return {
        week: wk,
        size,
        w0: pct(activePerWeek[0].size),
        w1: pct(activePerWeek[1].size),
        w2: pct(activePerWeek[2].size),
        w3: pct(activePerWeek[3].size),
        stampsTotal,
      };
    });

    // ---------- Breakdown por estabelecimento ----------
    const custByEst = new Map<string, number>();
    customers.forEach((c) => custByEst.set(c.establishment_id, (custByEst.get(c.establishment_id) ?? 0) + 1));
    const stampsByEst = new Map<string, number>();
    stamps.forEach((s) => stampsByEst.set(s.establishment_id, (stampsByEst.get(s.establishment_id) ?? 0) + 1));
    const redByEst = new Map<string, number>();
    rewards.forEach((r) => redByEst.set(r.establishment_id, (redByEst.get(r.establishment_id) ?? 0) + 1));
    const achByEst = new Map<string, number>();
    achievements.forEach((a) => {
      if (a.establishment_id) achByEst.set(a.establishment_id, (achByEst.get(a.establishment_id) ?? 0) + 1);
    });

    const perEstablishment: EstablishmentBreakdown[] = selectedEsts.map((e) => ({
      id: e.id,
      name: e.name,
      slug: e.slug,
      customers: custByEst.get(e.id) ?? 0,
      stamps: stampsByEst.get(e.id) ?? 0,
      redemptions: redByEst.get(e.id) ?? 0,
      achievements: achByEst.get(e.id) ?? 0,
    })).sort((a, b) => b.stamps - a.stamps);

    // ---------- Top campanhas por resgates ----------
    const campaignName = new Map(campaigns.map((c) => [c.id, c.reward_title || c.name]));
    const redByCampaign = new Map<string, number>();
    rewards.forEach((r) => {
      if (r.campaign_id) redByCampaign.set(r.campaign_id, (redByCampaign.get(r.campaign_id) ?? 0) + 1);
    });
    const topCampaigns = Array.from(redByCampaign.entries())
      .map(([id, redemptions]) => ({ id, title: campaignName.get(id) ?? "Campanha", redemptions }))
      .sort((a, b) => b.redemptions - a.redemptions)
      .slice(0, 5);

    // ---------- Top conquistas ----------
    const achMeta = new Map(achCatalog.map((a) => [a.code, a]));
    const achCount = new Map<string, number>();
    achievements.forEach((a) => achCount.set(a.achievement_code, (achCount.get(a.achievement_code) ?? 0) + 1));
    const topAchievements = Array.from(achCount.entries())
      .map(([code, count]) => ({
        code,
        title: achMeta.get(code)?.title ?? code,
        icon: achMeta.get(code)?.icon ?? "Award",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totals = {
      stamps: stamps.length,
      redemptions: rewards.length,
      achievements: achievements.length,
      newCustomers: Array.from(cohortCustomers.values()).reduce((a, arr) => a + arr.length, 0),
    };

    return { weeks, cohorts, perEstablishment, topCampaigns, topAchievements, totals };
  });
