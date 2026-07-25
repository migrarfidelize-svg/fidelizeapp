type PushRecipient = {
  id?: string | null;
  user_id?: string | null;
  customer_id?: string | null;
  establishment_id?: string | null;
};

type PushInboxPayload = {
  title: string;
  body?: string | null;
  url?: string | null;
  kind?: "promo" | "novidade" | "aviso" | "push";
  audience?: "user" | "customer" | "operator" | "admin";
};

type DeliveryResult = { ok: boolean; status?: number; error?: string };

function deliveryStatus(result: DeliveryResult) {
  if (result.ok) return "sent";
  return result.status === 410 || result.status === 404 ? "expired" : "failed";
}

export function notificationTargetKey(recipient: PushRecipient) {
  const establishment = recipient.establishment_id ?? "global";
  if (recipient.user_id) return `${establishment}:user:${recipient.user_id}`;
  if (recipient.customer_id) return `${establishment}:customer:${recipient.customer_id}`;
  return `${establishment}:subscription:${recipient.id ?? "unknown"}`;
}

export async function recordPushDelivery(
  supabaseAdmin: any,
  recipient: PushRecipient,
  payload: PushInboxPayload,
  result: DeliveryResult,
  options?: { persistInApp?: boolean; audience?: PushInboxPayload["audience"] },
) {
  const { data: log, error: logError } = await supabaseAdmin
    .from("push_logs")
    .insert({
      establishment_id: recipient.establishment_id ?? null,
      subscription_id: recipient.id ?? null,
      customer_id: recipient.customer_id ?? null,
      title: payload.title,
      body: payload.body ?? null,
      url: payload.url ?? null,
      status: deliveryStatus(result),
      status_code: result.status ?? null,
      error: result.error ?? null,
    })
    .select("id")
    .single();

  if (logError) throw logError;

  if (options?.persistInApp !== false && (recipient.user_id || recipient.customer_id)) {
    await supabaseAdmin.from("user_notifications").insert({
      user_id: recipient.user_id ?? null,
      customer_id: recipient.customer_id ?? null,
      establishment_id: recipient.establishment_id ?? null,
      push_log_id: log?.id ?? null,
      audience: options?.audience ?? payload.audience ?? (recipient.customer_id ? "customer" : "operator"),
      kind: payload.kind ?? "push",
      title: payload.title,
      body: payload.body ?? null,
      url: payload.url ?? null,
    });
  }

  return log;
}