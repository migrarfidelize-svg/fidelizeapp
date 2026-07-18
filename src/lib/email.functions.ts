import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Apenas Super Administradores podem acessar as configurações de e-mail.");
}

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { maskApiKey } = await import("./email.server");
    const { data, error } = await supabaseAdmin
      .from("system_email_settings")
      .select("id, sender_email, sender_name, reply_to, resend_api_key, updated_at, created_at")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { configured: false as const };
    return {
      configured: true as const,
      id: data.id,
      sender_email: data.sender_email,
      sender_name: data.sender_name,
      reply_to: data.reply_to,
      updated_at: data.updated_at,
      created_at: data.created_at,
      api_key_masked: maskApiKey(data.resend_api_key),
      api_key_last4: (data.resend_api_key ?? "").slice(-4),
    };
  });

/** Returns the full API key. Requires super admin. Used ONLY by the eye-toggle in the admin UI. */
export const revealEmailApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("system_email_settings")
      .select("resend_api_key")
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { api_key: (data?.resend_api_key as string | undefined) ?? "" };
  });

const settingsSchema = z.object({
  resend_api_key: z.string().trim().min(10, "API Key inválida").max(200).optional(),
  sender_email: z.string().trim().email("E-mail remetente inválido").max(200),
  sender_name: z.string().trim().min(1, "Nome remetente obrigatório").max(120),
  reply_to: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Reply-to inválido"),
});

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("system_email_settings")
      .select("id, resend_api_key")
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);

    if (existing) {
      const patch: {
        sender_email: string;
        sender_name: string;
        reply_to: string | null;
        resend_api_key?: string;
      } = {
        sender_email: data.sender_email,
        sender_name: data.sender_name,
        reply_to: data.reply_to ?? null,
      };
      if (data.resend_api_key) patch.resend_api_key = data.resend_api_key;
      const { error } = await supabaseAdmin
        .from("system_email_settings")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      if (!data.resend_api_key) throw new Error("Informe a API Key do Resend para a primeira configuração.");
      const { error } = await supabaseAdmin.from("system_email_settings").insert({
        resend_api_key: data.resend_api_key,
        sender_email: data.sender_email,
        sender_name: data.sender_name,
        reply_to: data.reply_to ?? null,
        singleton: true,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ to: z.string().trim().email("Informe um e-mail válido") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { sendPlatformEmail } = await import("./email.server");
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;padding:24px;max-width:520px;margin:auto;color:#0f172a;">
        <h2 style="margin:0 0 12px;font-size:20px;">Teste de envio — Fidelize</h2>
        <p style="margin:0 0 12px;line-height:1.5;">Se você recebeu este e-mail, a integração com o Resend está funcionando corretamente.</p>
        <p style="margin:0 0 24px;color:#64748b;font-size:13px;">Enviado em ${new Date().toLocaleString("pt-BR")}.</p>
        <div style="padding:12px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;font-size:13px;">
          Este é um envio de diagnóstico disparado pelo painel do Super Administrador. Nenhuma ação é necessária.
        </div>
      </div>`;
    const res = await sendPlatformEmail({
      to: data.to,
      subject: "Teste de envio — Fidelize",
      html,
      text: "Teste de envio da integração com o Resend.",
      template: "test",
      actor_id: context.userId,
      log_status: "test",
    });
    if (!res.ok) throw new Error(res.error ?? "Falha ao enviar e-mail de teste");
    return { ok: true as const, resend_id: res.resend_id, duration_ms: res.duration_ms };
  });

export const listEmailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        q: z.string().trim().max(200).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("email_logs")
      .select("id, to_email, subject, template, status, resend_id, error, duration_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.q) {
      const term = `%${data.q}%`;
      q = q.or(`to_email.ilike.${term},subject.ilike.${term},template.ilike.${term}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { logs: rows ?? [] };
  });
