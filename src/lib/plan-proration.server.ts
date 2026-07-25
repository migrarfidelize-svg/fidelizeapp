/**
 * Proporcionalidade de upgrade (pró-rata de cortesia).
 *
 * Regra: se o estabelecimento pagou um plano nos últimos 7 dias e agora faz
 * upgrade para um plano mais caro, o valor já pago é usado como crédito e ele
 * paga apenas a diferença. Passados os 7 dias, cobra-se o valor cheio.
 */

export const UPGRADE_CREDIT_WINDOW_DAYS = 7;
const MIN_CHARGE = 1; // gateways não aceitam cobrança de R$ 0,00

export type UpgradeCharge = {
  base_amount: number;
  credit: number;
  amount: number;
  is_upgrade_credit: boolean;
  days_since_payment: number | null;
  window_days: number;
  previous_plan_slug: string | null;
  previous_amount: number | null;
  source_payment_id: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula quanto cobrar por um upgrade, considerando crédito do último
 * pagamento aprovado dentro da janela de 7 dias.
 */
export async function computeUpgradeCharge(
  establishmentId: string,
  targetPlan: { slug: string; price_monthly: number | string | null },
): Promise<UpgradeCharge> {
  const base = round2(Number(targetPlan.price_monthly ?? 0));
  const fallback: UpgradeCharge = {
    base_amount: base,
    credit: 0,
    amount: base,
    is_upgrade_credit: false,
    days_since_payment: null,
    window_days: UPGRADE_CREDIT_WINDOW_DAYS,
    previous_plan_slug: null,
    previous_amount: null,
    source_payment_id: null,
  };
  if (!(base > 0)) return fallback;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - UPGRADE_CREDIT_WINDOW_DAYS * 24 * 3600_000).toISOString();
    const { data } = await supabaseAdmin
      .from("payments")
      .select("id, plan_slug, amount, status, approved_at, created_at")
      .eq("establishment_id", establishmentId)
      .eq("status", "approved")
      .order("approved_at", { ascending: false, nullsFirst: false })
      .limit(10);

    const rows = (data ?? []) as Array<{
      id: string; plan_slug: string | null; amount: number | string | null;
      approved_at: string | null; created_at: string | null;
    }>;

    const last = rows
      .map((r) => ({ ...r, at: r.approved_at ?? r.created_at }))
      .filter((r) => !!r.at && (r.at as string) >= since)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];

    if (!last) return fallback;
    if (last.plan_slug && last.plan_slug === targetPlan.slug) return fallback; // renovação, não upgrade

    const paid = round2(Number(last.amount ?? 0));
    if (!(paid > 0) || paid >= base) return fallback; // não é upgrade de valor

    const credit = round2(Math.min(paid, Math.max(base - MIN_CHARGE, 0)));
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(String(last.at)).getTime()) / (24 * 3600_000)),
    );

    return {
      base_amount: base,
      credit,
      amount: round2(Math.max(base - credit, MIN_CHARGE)),
      is_upgrade_credit: credit > 0,
      days_since_payment: days,
      window_days: UPGRADE_CREDIT_WINDOW_DAYS,
      previous_plan_slug: last.plan_slug ?? null,
      previous_amount: paid,
      source_payment_id: last.id,
    };
  } catch {
    return fallback;
  }
}
