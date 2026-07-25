/**
 * Avisos operacionais para os aparelhos da equipe do estabelecimento
 * (donos, gerentes e atendentes que ativaram notificações no /app).
 *
 * Server-only: nunca importar de código de cliente.
 */
import { sendPushToSub, type PushPayload } from "./push.server";
import { recordPushDelivery } from "./push-inbox.server";

type TeamSub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  establishment_id: string | null;
  customer_id: string | null;
  user_id: string | null;
};

/**
 * Envia para todos os dispositivos de equipe ativos do estabelecimento.
 * Assinaturas de clientes finais (customer_id preenchido) são ignoradas.
 * Nunca lança: falha de push não pode derrubar a operação que a disparou.
 */
export async function notifyEstablishmentTeam(
  establishmentId: string,
  payload: PushPayload,
  opts: { onlyUserIds?: string[]; kind?: "promo" | "novidade" | "aviso" | "push" } = {},
): Promise<{ sent: number }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: members } = await supabaseAdmin
      .from("establishment_members")
      .select("user_id")
      .eq("establishment_id", establishmentId)
      .eq("active", true);
    let userIds = (members ?? []).map((m) => m.user_id).filter(Boolean) as string[];
    if (opts.onlyUserIds?.length) {
      const allow = new Set(opts.onlyUserIds);
      userIds = userIds.filter((id) => allow.has(id));
    }
    if (userIds.length === 0) return { sent: 0 };

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id")
      .in("user_id", userIds)
      .is("customer_id", null)
      .eq("active", true);
    if (!subs || subs.length === 0) return { sent: 0 };

    let sent = 0;
    for (const s of subs as TeamSub[]) {
      const result = await sendPushToSub(
        { ...s, establishment_id: s.establishment_id ?? establishmentId },
        payload,
      );
      await recordPushDelivery(
        supabaseAdmin,
        { id: s.id, user_id: s.user_id, customer_id: null, establishment_id: establishmentId },
        { title: payload.title, body: payload.body ?? null, url: payload.url ?? null, kind: opts.kind ?? "aviso" },
        result,
        { audience: "operator" },
      ).catch(() => {});
      if (result.ok) sent++;
    }
    return { sent };
  } catch {
    return { sent: 0 };
  }
}

/** Avisa a equipe sobre uma nova avaliação recebida. */
export async function notifyNewReview(
  establishmentId: string,
  review: { rating: number; comment?: string | null; customer_name?: string | null },
): Promise<void> {
  const stars = "★".repeat(Math.max(1, Math.min(5, review.rating)));
  const who = review.customer_name?.trim() || "Cliente";
  const snippet = (review.comment ?? "").trim().slice(0, 110);
  await notifyEstablishmentTeam(establishmentId, {
    title: review.rating <= 2 ? `Avaliação ${stars} precisa de atenção` : `Nova avaliação ${stars}`,
    body: snippet ? `${who}: ${snippet}` : `${who} avaliou seu atendimento.`,
    url: "/app/avaliacoes",
    type: "review",
    tag: "review",
  });
}

/** Avisa o solicitante do ticket (lojista) que o suporte respondeu. */
export async function notifySupportReply(
  establishmentId: string | null,
  requesterUserId: string | null,
  ticket: { protocol?: string | null; subject?: string | null },
): Promise<void> {
  if (!establishmentId || !requesterUserId) return;
  await notifyEstablishmentTeam(
    establishmentId,
    {
      title: "Suporte respondeu seu chamado",
      body: `${ticket.protocol ?? ""} ${ticket.subject ?? ""}`.trim() || "Toque para ver a resposta.",
      url: "/app/fidelize",
      type: "support",
      tag: "support",
    },
    { onlyUserIds: [requesterUserId] },
  );
}

/**
 * Avisa uma única vez por mês quando a meta de carimbos é batida.
 * A deduplicação usa os próprios logs de push do mês corrente.
 */
export async function maybeNotifyStampGoalReached(establishmentId: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    const { data: goal } = await supabaseAdmin
      .from("establishment_goals")
      .select("stamps_goal, month")
      .eq("establishment_id", establishmentId)
      .gte("month", monthStart.slice(0, 10))
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
    const target = goal?.stamps_goal ?? 0;
    if (!target || target <= 0) return;

    const { count } = await supabaseAdmin
      .from("stamps")
      .select("id", { count: "exact", head: true })
      .eq("establishment_id", establishmentId)
      .is("reverted_at", null)
      .gte("created_at", monthStart);
    if ((count ?? 0) < target) return;

    const { data: already } = await supabaseAdmin
      .from("push_logs")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("title", "Meta do mês batida%")
      .gte("created_at", monthStart)
      .limit(1)
      .maybeSingle();
    if (already) return;

    await notifyEstablishmentTeam(establishmentId, {
      title: "Meta do mês batida 🎉",
      body: `Vocês chegaram a ${count} carimbos — meta era ${target}.`,
      url: "/app",
      type: "goal",
      tag: "goal",
    });
  } catch {
    /* nunca interrompe o carimbo */
  }
}
