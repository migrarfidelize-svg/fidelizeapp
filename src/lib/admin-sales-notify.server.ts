// Server-only: notifica os super admins por push quando uma venda é aprovada.
// NUNCA importar de código client.

type SaleInfo = {
  establishmentId?: string | null;
  planSlug?: string | null;
  amount?: number | null;
  currency?: string | null;
  provider: string;
  paymentId: string;
};

function money(amount: number | null | undefined, currency?: string | null) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: (currency || "BRL").toUpperCase(),
    }).format(value);
  } catch {
    return `R$ ${value.toFixed(2)}`;
  }
}

/**
 * Envia push + inbox para todos os super admins com dispositivo ativo.
 * Nunca lança — falhas de notificação não podem quebrar o webhook.
 */
export async function notifyAdminsOfSale(sale: SaleInfo) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Nome do produto (plano) e do estabelecimento
    let productName = sale.planSlug ?? "Assinatura";
    if (sale.planSlug) {
      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("name")
        .eq("slug", sale.planSlug)
        .maybeSingle();
      if (plan?.name) productName = plan.name;
    }

    let estName: string | null = null;
    if (sale.establishmentId) {
      const { data: est } = await supabaseAdmin
        .from("establishments")
        .select("name")
        .eq("id", sale.establishmentId)
        .maybeSingle();
      estName = est?.name ?? null;
    }

    const { data: admins } = await supabaseAdmin
      .from("app_roles")
      .select("user_id")
      .eq("role", "super_admin");

    const adminIds = Array.from(new Set((admins ?? []).map((a: any) => a.user_id).filter(Boolean)));
    if (adminIds.length === 0) return { sent: 0, failed: 0 };

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id, user_id")
      .in("user_id", adminIds)
      .eq("active", true);

    const title = "Nova venda aprovada 🎉";
    const body = `${productName} · ${money(sale.amount, sale.currency)}${estName ? ` · ${estName}` : ""}`;
    const url = "/admin/pagamentos";

    const { sendPushToSub } = await import("@/lib/push.server");
    const { notificationTargetKey, recordPushDelivery } = await import("@/lib/push-inbox.server");

    let sent = 0;
    let failed = 0;
    const seenTargets = new Set<string>();
    const notifiedUsers = new Set<string>();

    for (const s of (subs ?? []) as any[]) {
      const target = notificationTargetKey({ ...s, establishment_id: null });
      const r = await sendPushToSub(
        { ...s, establishment_id: null, customer_id: null },
        { title, body, url, tag: `sale-${sale.provider}-${sale.paymentId}`, type: "sale", requireInteraction: true },
      );
      await recordPushDelivery(
        supabaseAdmin,
        { id: s.id, user_id: s.user_id, customer_id: null, establishment_id: null },
        { title, body, url, kind: "aviso" },
        r,
        { persistInApp: !seenTargets.has(target), audience: "admin" },
      );
      seenTargets.add(target);
      if (s.user_id) notifiedUsers.add(s.user_id);
      if (r.ok) sent++;
      else failed++;
    }

    // Admins sem dispositivo ativo ainda recebem o aviso na caixa de entrada do painel.
    const missing = adminIds.filter((id: string) => !notifiedUsers.has(id));
    if (missing.length > 0) {
      await supabaseAdmin.from("user_notifications").insert(
        missing.map((user_id: string) => ({
          user_id,
          audience: "admin",
          kind: "aviso",
          title,
          body,
          url,
        })) as never,
      );
    }

    return { sent, failed };
  } catch (e) {
    console.warn("[admin-sales-notify] falha ao notificar admins:", e);
    return { sent: 0, failed: 0 };
  }
}
