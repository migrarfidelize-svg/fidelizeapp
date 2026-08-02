// ============================================================
// Server-only: avisa o lojista (WhatsApp + push) a cada evento de pedido
// e abre a janela de 24h com o cliente enviando a confirmação pelo
// WhatsApp conectado do estabelecimento.
//
// Nunca lança: falha de notificação não pode derrubar o pedido.
// ============================================================

type OrderEvent = "created" | "paid" | "status_changed";

type NotifyInput = {
  order_id: string;
  event: OrderEvent;
  /** Situação de pagamento textual (ex.: "Pago no PIX", "Pagar na entrega"). */
  payment_note?: string | null;
};

function money(v: number | null | undefined, currency = "BRL") {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(n);
  } catch {
    return `R$ ${n.toFixed(2)}`;
  }
}

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  confirmed: "Confirmado",
  preparing: "Em preparo",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function paymentLabel(order: any, override?: string | null) {
  if (override) return override;
  const method = String(order.payment_method ?? "").toLowerCase();
  if (!method) return order.fulfillment === "delivery" ? "A combinar na entrega" : "A combinar na retirada";
  if (["pix", "card", "cartao", "credit", "online"].some((k) => method.includes(k))) {
    return `${order.payment_method} (online)`;
  }
  return `${order.payment_method} (na entrega/retirada)`;
}

/** Envia texto pela instância conectada do lojista. Retorna o id externo ou null. */
async function sendViaEstablishment(
  establishmentId: string,
  toPhone: string,
  text: string,
): Promise<{ ok: boolean; connectionId?: string; externalMessageId?: string | null; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await (supabaseAdmin as any)
      .from("whatsapp_connections")
      .select("*")
      .eq("establishment_id", establishmentId)
      .eq("connection_status", "connected")
      .eq("suspended", false)
      .maybeSingle();
    if (!conn) return { ok: false, error: "sem_conexao_whatsapp" };

    const { loadProviderRuntime, loadInstanceRef } = await import("@/lib/whatsapp/registry.server");
    const { normalizePhone } = await import("@/lib/whatsapp/types");
    const { runtime, provider } = await loadProviderRuntime(conn.provider);
    const ref = await loadInstanceRef(conn);
    const to = normalizePhone(toPhone);
    if (!to) return { ok: false, error: "telefone_invalido" };

    const res = await provider.sendText(runtime, ref, { to, text });
    return { ok: true, connectionId: conn.id, externalMessageId: res.externalMessageId ?? null };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/** Registra a mensagem enviada ao cliente na Central de Atendimento. */
async function logConversation(opts: {
  establishmentId: string;
  connectionId?: string;
  phone: string;
  contactName: string;
  body: string;
  externalMessageId?: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalizePhone } = await import("@/lib/whatsapp/types");
    const phone = normalizePhone(opts.phone);
    const nowIso = new Date().toISOString();

    let { data: conv } = await (supabaseAdmin as any)
      .from("conversations")
      .select("id, status")
      .eq("establishment_id", opts.establishmentId)
      .eq("contact_phone", phone)
      .maybeSingle();

    if (!conv) {
      const { data: created } = await (supabaseAdmin as any)
        .from("conversations")
        .insert({
          establishment_id: opts.establishmentId,
          connection_id: opts.connectionId ?? null,
          channel: "whatsapp",
          contact_phone: phone,
          contact_name: opts.contactName || phone,
          status: "queued",
          unread_count: 0,
        })
        .select("id, status")
        .single();
      conv = created;
    }
    if (!conv) return;

    await (supabaseAdmin as any).from("conversation_messages").insert({
      conversation_id: conv.id,
      establishment_id: opts.establishmentId,
      direction: "outbound",
      sender_type: "system",
      message_type: "text",
      body: opts.body,
      external_message_id: opts.externalMessageId ?? null,
      status: "sent",
      sent_at: nowIso,
    });

    await (supabaseAdmin as any)
      .from("conversations")
      .update({
        last_message_at: nowIso,
        last_message_preview: opts.body.slice(0, 160),
        updated_at: nowIso,
      })
      .eq("id", conv.id);
  } catch {
    /* silencioso */
  }
}

/** Push para os dispositivos da equipe do estabelecimento. */
async function pushToTeam(establishmentId: string, title: string, body: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members } = await supabaseAdmin
      .from("establishment_members")
      .select("user_id")
      .eq("establishment_id", establishmentId)
      .eq("active", true);
    const userIds = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
    if (userIds.length === 0) return;

    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key, establishment_id, customer_id")
      .eq("active", true)
      .in("user_id", userIds);
    if (!subs?.length) return;

    const { sendPushToSub } = await import("@/lib/push.server");
    await Promise.all(
      subs.map((s: any) =>
        sendPushToSub(s, { title, body, url: "/app/pedidos", type: "order", tag: "order" } as any),
      ),
    );
  } catch {
    /* silencioso */
  }
}

/**
 * Notifica o lojista e confirma com o cliente.
 * `created` → alerta completo + confirmação ao cliente (abre a janela de 24h).
 * `paid` / `status_changed` → atualização curta para os dois lados.
 */
export async function notifyOrderEvent(input: NotifyInput) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: order } = await (supabaseAdmin as any)
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", input.order_id)
      .maybeSingle();
    if (!order) return { ok: false, reason: "order_not_found" };

    const { data: est } = await (supabaseAdmin as any)
      .from("establishments")
      .select("id, name, whatsapp, phone")
      .eq("id", order.establishment_id)
      .maybeSingle();
    if (!est) return { ok: false, reason: "establishment_not_found" };

    const currency = order.currency ?? "BRL";
    const items = (order.order_items ?? [])
      .map(
        (l: any) =>
          `• ${l.qty}x ${l.name}${l.variant_label ? ` (${l.variant_label})` : ""} — ${money(l.line_total, currency)}`,
      )
      .join("\n");

    const kindLabel = order.kind === "catalog" ? "Catálogo" : "Cardápio";
    const fulfillment = order.fulfillment === "delivery" ? "Entrega" : "Retirada no local";
    const payment = paymentLabel(order, input.payment_note);
    const statusLabel = STATUS_LABEL[String(order.status)] ?? String(order.status);

    const merchantText =
      input.event === "created"
        ? [
            `🛒 *Novo pedido #${order.order_number}* — ${kindLabel}`,
            "",
            items,
            "",
            `*Total: ${money(order.total, currency)}*`,
            `Pagamento: ${payment}`,
            `Tipo: ${fulfillment}`,
            "",
            `Cliente: ${order.customer_name ?? "—"}`,
            order.customer_phone ? `Telefone: ${order.customer_phone}` : null,
            order.address ? `Endereço: ${order.address}` : null,
            order.note ? `Obs.: ${order.note}` : null,
            "",
            "Abra o painel para confirmar: /app/pedidos",
          ]
            .filter(Boolean)
            .join("\n")
        : [
            `🔔 *Pedido #${order.order_number}* — ${input.event === "paid" ? "pagamento confirmado" : `status: ${statusLabel}`}`,
            `Cliente: ${order.customer_name ?? "—"}`,
            `Total: ${money(order.total, currency)} · Pagamento: ${payment}`,
          ].join("\n");

    const merchantPhone = est.whatsapp || est.phone || null;
    let merchantSent = false;
    if (merchantPhone) {
      const r = await sendViaEstablishment(est.id, merchantPhone, merchantText);
      merchantSent = r.ok;
    }

    await pushToTeam(
      est.id,
      input.event === "created" ? `Novo pedido #${order.order_number}` : `Pedido #${order.order_number} atualizado`,
      input.event === "created"
        ? `${order.customer_name ?? "Cliente"} · ${money(order.total, currency)} · ${payment}`
        : `${statusLabel} · ${money(order.total, currency)}`,
    );

    // Confirmação para o cliente — mantém a conversa ativa por 24h.
    let customerSent = false;
    if (order.customer_phone) {
      const customerText =
        input.event === "created"
          ? [
              `Olá, ${order.customer_name ?? ""}! Recebemos seu pedido *#${order.order_number}* na ${est.name}. 🙌`,
              "",
              items,
              "",
              `*Total: ${money(order.total, currency)}*`,
              `Pagamento: ${payment}`,
              `Tipo: ${fulfillment}`,
              "",
              "Já estamos cuidando de tudo — responda aqui se precisar de algo.",
            ].join("\n")
          : `Atualização do pedido *#${order.order_number}* na ${est.name}: ${input.event === "paid" ? "pagamento confirmado ✅" : statusLabel}.`;

      const r = await sendViaEstablishment(est.id, order.customer_phone, customerText);
      customerSent = r.ok;
      if (r.ok) {
        await logConversation({
          establishmentId: est.id,
          connectionId: r.connectionId,
          phone: order.customer_phone,
          contactName: order.customer_name ?? order.customer_phone,
          body: customerText,
          externalMessageId: r.externalMessageId,
        });
      }
    }

    return { ok: true, merchantSent, customerSent };
  } catch (e: any) {
    return { ok: false, reason: String(e?.message ?? e) };
  }
}
