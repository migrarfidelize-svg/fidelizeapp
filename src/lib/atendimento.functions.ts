import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const saveOtpTemplateSchema = z.object({
  template: z.string().min(10).max(500),
});

export const getOTPTemplate = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "otp")
      .eq("key", "template")
      .maybeSingle();

    if (error) {
      console.error("[OTP] Error fetching template:", error);
    }

    return { 
      template: (data?.value as any)?.text || "Afidelize\n\nSeu código de acesso é {{code}}.\n\nEle expira em {{minutes}} minutos.\n\nNão compartilhe este código."
    };
  });

export const saveOTPTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveOtpTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { supabase, userId } = context;
    
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { error } = await supabaseAdmin
      .from("system_settings")
      .upsert({ 
        namespace: "otp",
        key: "template", 
        value: { text: data.template } as any,
      }, { onConflict: "namespace,key" });

    if (error) throw error;
    return { ok: true };
  });

export const sendOTPTestMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string(), message: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider();

    if (!active) {
      throw new Error("Nenhum provedor de WhatsApp ativo configurado nas Integrações.");
    }

    const res = await active.provider.sendTestMessage(
      active.runtime, 
      process.env as any, 
      data.phone, 
      data.message
    );

    if (!res.ok) {
      throw new Error(res.message || "Falha ao enviar mensagem de teste.");
    }

    return { ok: true };
  });

// --- CRM FUNCTIONS ---

export const getCRMConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data, error } = await supabase
      .from("crm_conversations")
      .select("*, messages:crm_messages(body, created_at)")
      .order("last_message_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const getCRMConversationMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data: messages, error } = await supabase
      .from("crm_messages")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return messages || [];
  });

export const sendCRMMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    conversationId: z.string().uuid(),
    body: z.string().min(1) 
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    // 1. Get conversation phone
    const { data: conv, error: convErr } = await supabase
      .from("crm_conversations")
      .select("customer_phone")
      .eq("id", data.conversationId)
      .single();

    if (convErr || !conv) throw new Error("Conversa não encontrada.");

    // 2. Send via WhatsApp Provider
    const { getActiveWhatsAppProvider } = await import("./otp.functions");
    const active = await getActiveWhatsAppProvider();
    if (!active) throw new Error("Nenhum provedor de WhatsApp ativo.");

    const res = await active.provider.sendTestMessage(
      active.runtime,
      process.env as any,
      conv.customer_phone,
      data.body
    );

    if (!res.ok) throw new Error(res.message || "Falha no envio via WhatsApp.");

    // 3. Persist in DB (Admin client because RLS might block inserts for super admin if not allowed, though service_role is better)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: msgErr } = await supabaseAdmin
      .from("crm_messages")
      .insert({
        conversation_id: data.conversationId,
        body: data.body,
        direction: "outbound",
        provider: active.provider.meta.id,
        provider_message_id: `admin-${Date.now()}` // Or get from provider if available
      });

    if (msgErr) throw msgErr;

    // 4. Update conversation status if closed
    await supabaseAdmin
      .from("crm_conversations")
      .update({ status: "assigned", assigned_to: userId, last_message_at: new Date().toISOString() })
      .eq("id", data.conversationId)
      .eq("status", "waiting");

    return { ok: true };
  });

export const updateCRMConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    conversationId: z.string().uuid(),
    status: z.enum(["bot", "waiting", "assigned", "closed"]) 
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const updateData: any = { status: data.status };
    if (data.status === "closed") {
      updateData.closed_at = new Date().toISOString();
    } else if (data.status === "assigned") {
      updateData.assigned_at = new Date().toISOString();
      updateData.assigned_to = userId;
    }

    const { error } = await supabaseAdmin
      .from("crm_conversations")
      .update(updateData)
      .eq("id", data.conversationId);

    if (error) throw error;
    return { ok: true };
  });
