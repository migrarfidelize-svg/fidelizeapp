// Server-only email sending helpers. Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface SystemEmailSettings {
  id: string;
  resend_api_key: string;
  sender_email: string;
  sender_name: string;
  reply_to: string | null;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  actor_id?: string | null;
  establishment_id?: string | null;
  log_status?: "sent" | "test"; // 'sent' by default; test sends use 'test'
}

export interface SendEmailResult {
  ok: boolean;
  resend_id?: string;
  error?: string;
  duration_ms: number;
}

export async function getGlobalEmailSettings(): Promise<SystemEmailSettings | null> {
  const { data, error } = await supabaseAdmin
    .from("system_email_settings")
    .select("id, resend_api_key, sender_email, sender_name, reply_to")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SystemEmailSettings | null) ?? null;
}

async function insertEmailLog(row: {
  to_email: string;
  subject: string;
  template: string | null;
  status: "sent" | "failed" | "test";
  resend_id: string | null;
  error: string | null;
  duration_ms: number;
  actor_id: string | null;
  establishment_id: string | null;
}) {
  try {
    await supabaseAdmin.from("email_logs").insert(row);
  } catch {
    // logging must never break the send flow
  }
}

/**
 * Sends an email using the platform's global Resend configuration.
 * Every call is recorded in email_logs.
 */
export async function sendPlatformEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const started = Date.now();
  const settings = await getGlobalEmailSettings();

  if (!settings) {
    const duration_ms = Date.now() - started;
    await insertEmailLog({
      to_email: input.to,
      subject: input.subject,
      template: input.template ?? null,
      status: "failed",
      resend_id: null,
      error: "E-mail global não configurado. Peça ao Super Administrador para configurar em /admin/emails.",
      duration_ms,
      actor_id: input.actor_id ?? null,
      establishment_id: input.establishment_id ?? null,
    });
    return { ok: false, error: "E-mail global não configurado.", duration_ms };
  }

  const from = `${settings.sender_name} <${settings.sender_email}>`;
  const payload: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.text) payload.text = input.text;
  if (settings.reply_to) payload.reply_to = settings.reply_to;

  let resend_id: string | null = null;
  let error: string | null = null;
  let ok = false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.resend_api_key}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (!res.ok) {
      error = `Resend [${res.status}]: ${body}`;
    } else {
      try {
        const parsed = JSON.parse(body) as { id?: string };
        resend_id = parsed.id ?? null;
      } catch {
        resend_id = null;
      }
      ok = true;
    }
  } catch (err: any) {
    error = err?.message ?? "Falha inesperada ao contatar o Resend";
  }

  const duration_ms = Date.now() - started;

  await insertEmailLog({
    to_email: input.to,
    subject: input.subject,
    template: input.template ?? null,
    status: ok ? (input.log_status ?? "sent") : "failed",
    resend_id,
    error,
    duration_ms,
    actor_id: input.actor_id ?? null,
    establishment_id: input.establishment_id ?? null,
  });

  return { ok, resend_id: resend_id ?? undefined, error: error ?? undefined, duration_ms };
}

export function maskApiKey(key: string): string {
  if (!key) return "";
  const tail = key.slice(-4);
  return `${"•".repeat(Math.max(8, Math.min(20, key.length - 4)))}${tail}`;
}
