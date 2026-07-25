// ============================================================
// Resolução de público para push (auto-cura de vínculos).
//
// Uma inscrição pode chegar em 3 estados:
//  1) completa  -> customer_id + establishment_id preenchidos (voucher)
//  2) por conta -> só user_id (cliente logado no app, sem token do voucher)
//  3) operador  -> establishment_id + user_id (dispositivo da equipe)
//
// Antes contávamos apenas (1), então estabelecimentos com clientes
// inscritos pelo app apareciam com "0 inscritos".
// ============================================================

type AnySupabase = any;

export type ResolvedSub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  establishment_id: string | null;
  customer_id: string | null;
  user_id: string | null;
  preferences: Record<string, boolean> | null;
  /** Cliente ao qual a inscrição pertence após a resolução (null = operador). */
  resolved_customer_id: string | null;
};

const SUB_COLUMNS =
  "id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id, preferences, active";

/**
 * Todas as inscrições ativas que pertencem a um estabelecimento, incluindo as
 * que só têm `user_id` (cliente logado) ou que ficaram sem `establishment_id`.
 * Faz backfill dos vínculos que conseguir resolver.
 */
export async function resolveEstablishmentSubs(
  supabaseAdmin: AnySupabase,
  establishmentId: string,
): Promise<ResolvedSub[]> {
  // Clientes do estabelecimento que possuem conta (user_id)
  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, user_id")
    .eq("establishment_id", establishmentId)
    .not("user_id", "is", null);

  const userToCustomer = new Map<string, string>();
  for (const c of customers ?? []) {
    if (c.user_id) userToCustomer.set(c.user_id as string, c.id as string);
  }
  const userIds = [...userToCustomer.keys()];

  const [byEst, byUser] = await Promise.all([
    supabaseAdmin
      .from("push_subscriptions")
      .select(SUB_COLUMNS)
      .eq("establishment_id", establishmentId)
      .eq("active", true),
    userIds.length > 0
      ? supabaseAdmin
          .from("push_subscriptions")
          .select(SUB_COLUMNS)
          .is("establishment_id", null)
          .eq("active", true)
          .in("user_id", userIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const merged = new Map<string, any>();
  for (const s of [...(byEst.data ?? []), ...(byUser.data ?? [])]) merged.set(s.id, s);

  const out: ResolvedSub[] = [];
  const backfill: Array<{ id: string; customer_id: string; establishment_id: string }> = [];

  for (const s of merged.values()) {
    let customerId: string | null = s.customer_id ?? null;
    if (!customerId && s.user_id) {
      customerId = userToCustomer.get(s.user_id) ?? null;
      if (customerId) {
        backfill.push({ id: s.id, customer_id: customerId, establishment_id: establishmentId });
      }
    }
    out.push({ ...s, resolved_customer_id: customerId });
  }

  // Auto-cura: grava os vínculos descobertos (best-effort).
  for (const b of backfill) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ customer_id: b.customer_id, establishment_id: b.establishment_id })
      .eq("id", b.id);
  }

  return out;
}

/** Aceita campanhas? (preferência ausente = sim) */
export function acceptsCampaign(sub: { preferences: Record<string, boolean> | null }) {
  return ((sub.preferences ?? {}) as Record<string, boolean>).campaign !== false;
}

/**
 * Divide as inscrições em clientes (opcionalmente filtrados por segmento)
 * e dispositivos de operadores/equipe.
 */
export function splitAudience(subs: ResolvedSub[], targetCustomerIds: string[] | null) {
  const target = targetCustomerIds ? new Set(targetCustomerIds) : null;
  const customers: ResolvedSub[] = [];
  const operators: ResolvedSub[] = [];
  for (const s of subs) {
    if (!acceptsCampaign(s)) continue;
    if (s.resolved_customer_id) {
      if (!target || target.has(s.resolved_customer_id)) customers.push(s);
    } else {
      operators.push(s);
    }
  }
  return { customers, operators };
}
