/**
 * Aviso automático de prêmio prestes a expirar.
 *
 * Server-only: roda a partir do hook agendado /api/public/hooks/notify-expiring-rewards.
 * Envia push + caixa de entrada para o cliente final e marca o prêmio como avisado
 * (rewards.expiry_notified_at) para nunca repetir o mesmo aviso.
 */
import { sendPushToSub } from "./push.server";
import { recordPushDelivery } from "./push-inbox.server";

const DEFAULT_WINDOW_DAYS = 3;
const BATCH_LIMIT = 200;

type RewardRow = {
  id: string;
  expires_at: string;
  card_id: string;
};

function daysLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return "expira hoje";
  if (days === 1) return "expira amanhã";
  return `expira em ${days} dias`;
}

export async function notifyExpiringRewards(
  windowDays: number = DEFAULT_WINDOW_DAYS,
): Promise<{ checked: number; notified: number; sent: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const now = new Date();
  const until = new Date(now.getTime() + windowDays * 86_400_000);

  const { data: rewards } = await supabaseAdmin
    .from("rewards")
    .select("id, expires_at, card_id")
    .is("redeemed_at", null)
    .is("expiry_notified_at", null)
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", until.toISOString())
    .limit(BATCH_LIMIT);

  const rows = (rewards ?? []) as RewardRow[];
  if (rows.length === 0) return { checked: 0, notified: 0, sent: 0 };

  // Resolve cartão -> cliente -> estabelecimento em lote.
  const cardIds = [...new Set(rows.map((r) => r.card_id))];
  const { data: cards } = await supabaseAdmin
    .from("loyalty_cards")
    .select("id, customer_id")
    .in("id", cardIds);
  const cardToCustomer = new Map<string, string>(
    (cards ?? []).map((c: { id: string; customer_id: string }) => [c.id, c.customer_id]),
  );

  const customerIds = [...new Set([...cardToCustomer.values()])];
  if (customerIds.length === 0) return { checked: rows.length, notified: 0, sent: 0 };

  const { data: customers } = await supabaseAdmin
    .from("customers")
    .select("id, user_id, establishment_id")
    .in("id", customerIds);
  const customerInfo = new Map(
    (customers ?? []).map(
      (c: { id: string; user_id: string | null; establishment_id: string }) => [c.id, c],
    ),
  );

  const estIds = [...new Set((customers ?? []).map((c) => c.establishment_id))];
  const { data: ests } = await supabaseAdmin
    .from("establishments")
    .select("id, name, slug")
    .in("id", estIds);
  const estInfo = new Map(
    (ests ?? []).map((e: { id: string; name: string; slug: string }) => [e.id, e]),
  );

  let notified = 0;
  let sent = 0;

  for (const reward of rows) {
    try {
      const customerId = cardToCustomer.get(reward.card_id);
      const customer = customerId ? customerInfo.get(customerId) : null;
      if (!customer) continue;
      const est = estInfo.get(customer.establishment_id);
      if (!est) continue;

      const title = `Seu prêmio ${daysLabel(reward.expires_at)}`;
      const body = `Você tem uma recompensa disponível em ${est.name}. Não deixe vencer!`;
      const url = `/carteira/${est.slug}`;

      const { data: subs } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id, preferences")
        .eq("customer_id", customer.id)
        .eq("active", true);

      let deliveredAny = false;
      for (const s of subs ?? []) {
        const prefs = (s.preferences ?? {}) as Record<string, boolean>;
        if (prefs.reward === false) continue;
        const result = await sendPushToSub(
          { ...s, establishment_id: s.establishment_id ?? customer.establishment_id },
          { title, body, url },
        );
        await recordPushDelivery(
          supabaseAdmin,
          {
            id: s.id,
            user_id: s.user_id ?? customer.user_id ?? null,
            customer_id: customer.id,
            establishment_id: customer.establishment_id,
          },
          { title, body, url, kind: "aviso" },
          result,
          { audience: "customer" },
        ).catch(() => {});
        if (result.ok) {
          deliveredAny = true;
          sent++;
        }
      }

      // Sem dispositivo ativo: ainda assim registra na caixa de entrada do app.
      if (!deliveredAny && (customer.user_id || customer.id)) {
        await supabaseAdmin
          .from("user_notifications")
          .insert({
            user_id: customer.user_id ?? null,
            customer_id: customer.id,
            establishment_id: customer.establishment_id,
            audience: "customer",
            kind: "aviso",
            title,
            body,
            url,
          })
          .then(() => undefined, () => undefined);
      }

      await supabaseAdmin
        .from("rewards")
        .update({ expiry_notified_at: new Date().toISOString() })
        .eq("id", reward.id);
      notified++;
    } catch {
      // um prêmio com problema não pode interromper o lote
    }
  }

  return { checked: rows.length, notified, sent };
}
