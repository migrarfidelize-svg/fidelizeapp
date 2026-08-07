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

export const getCRMStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const today = new Date().toISOString().split('T')[0];

    // Parallel counts for stats
    const [
      { count: openCount },
      { count: waitingCount },
      { count: assignedCount },
      { count: resolvedToday }
    ] = await Promise.all([
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).neq("status", "closed"),
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("status", "waiting"),
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("status", "assigned"),
      supabase.from("crm_conversations").select("*", { count: 'exact', head: true }).eq("status", "closed").gte("closed_at", today)
    ]);

    return {
      open: openCount || 0,
      waiting: waitingCount || 0,
      assigned: assignedCount || 0,
      resolvedToday: resolvedToday || 0,
      avgWaitTime: "12 min" // Mocked until we have a real calc
    };
  });

export const getCRMConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    status: z.enum(["all", "bot", "waiting", "assigned", "closed"]).optional(),
    search: z.string().optional()
  }).parse(d || {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    let query = supabase
      .from("crm_conversations")
      .select("*, messages:crm_messages(body, created_at, direction)")
      .order("last_message_at", { ascending: false });

    if (data.status && data.status !== "all") {
      query = query.eq("status", data.status);
    }

    if (data.search) {
      query = query.or(`customer_phone.ilike.%${data.search}%,customer_name.ilike.%${data.search}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    return rows || [];
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

    const { data: notes } = await supabase
      .from("crm_internal_notes")
      .select("*")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });

    // Combine and sort messages and notes for unified history
    const history = [
      ...(messages || []).map(m => ({ ...m, type: 'message' })),
      ...(notes || []).map(n => ({ ...n, type: 'note', direction: 'internal' }))
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return history;
  });

export const sendCRMMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    conversationId: z.string().uuid(),
    body: z.string().min(1),
    isNote: z.boolean().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.isNote) {
      const { error } = await supabaseAdmin
        .from("crm_internal_notes")
        .insert({
          conversation_id: data.conversationId,
          author_id: userId,
          content: data.body
        });
      if (error) throw error;
      return { ok: true };
    }

    // Regular Message logic
    const { data: conv, error: convErr } = await supabase
      .from("crm_conversations")
      .select("customer_phone")
      .eq("id", data.conversationId)
      .single();

    if (convErr || !conv) throw new Error("Conversa não encontrada.");

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

    const { error: msgErr } = await supabaseAdmin
      .from("crm_messages")
      .insert({
        conversation_id: data.conversationId,
        body: data.body,
        direction: "outbound",
        provider: active.provider.meta.id,
        provider_message_id: res.providerMessageId || `admin-${Date.now()}`
      });

    if (msgErr) throw msgErr;

    await supabaseAdmin
      .from("crm_conversations")
      .update({ 
        status: "assigned", 
        assigned_to: userId, 
        assigned_at: new Date().toISOString(),
        last_message_at: new Date().toISOString() 
      })
      .eq("id", data.conversationId)
      .not("status", "eq", "closed");

    return { ok: true };
  });

export const updateCRMConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    conversationId: z.string().uuid(),
    status: z.enum(["bot", "waiting", "assigned", "closed"]),
    assignedTo: z.string().uuid().optional()
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const updateData: any = { status: data.status, updated_at: new Date().toISOString() };
    if (data.status === "closed") {
      updateData.closed_at = new Date().toISOString();
    } else if (data.status === "assigned") {
      updateData.assigned_at = new Date().toISOString();
      updateData.assigned_to = data.assignedTo || userId;
    } else if (data.status === "waiting") {
      updateData.assigned_to = null;
      updateData.assigned_at = null;
    }

    const { error } = await supabaseAdmin
      .from("crm_conversations")
      .update(updateData)
      .eq("id", data.conversationId);

    if (error) throw error;
    return { ok: true };
  });

// --- CRM FLOWS ---
export const getCRMFlows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data, error } = await supabase.from("crm_flows").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });

export const getCRMFlowWithSteps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data: flow, error } = await supabase.from("crm_flows").select("*, steps:crm_flow_steps(*)").eq("id", data.flowId).single();
    if (error) throw error;
    return flow;
  });

export const saveCRMFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    id: z.string().uuid().optional(),
    name: z.string().min(3),
    description: z.string().optional(),
    is_active: z.boolean().optional(),
    steps: z.array(z.any())
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const flowData = { 
      name: data.name, 
      description: data.description, 
      is_active: data.is_active ?? false,
      updated_at: new Date().toISOString()
    };

    let flowId = data.id;
    if (flowId) {
      await supabaseAdmin.from("crm_flows").update(flowData).eq("id", flowId);
    } else {
      const { data: newFlow, error } = await supabaseAdmin.from("crm_flows").insert(flowData).select("id").single();
      if (error) throw error;
      flowId = newFlow.id;
    }

    // Upsert steps
    if (data.steps && data.steps.length > 0) {
      // Simple strategy: delete existing steps and re-insert to maintain order and clean up
      await supabaseAdmin.from("crm_flow_steps").delete().eq("flow_id", flowId);
      const stepsToInsert = data.steps.map((step, index) => ({
        ...step,
        flow_id: flowId,
        order_index: index
      }));
      await supabaseAdmin.from("crm_flow_steps").insert(stepsToInsert);
    }

    return { id: flowId };
  });

// --- AGENT SETTINGS ---
export const getAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");

    const { data } = await supabase.from("system_settings").select("*").eq("namespace", "crm").eq("key", "agent_config").maybeSingle();
    return data?.value || {
      enabled: false,
      name: "Assistente Afidelize",
      presentation: "Olá! 👋 Sou o assistente da Afidelize. Como posso ajudar você hoje?",
      behavior: {
        autoReply: true,
        welcomeNew: true,
        welcomeKnown: true,
        afterHuman: "stay_closed",
        timeoutMinutes: 10,
        timeoutAction: "transfer_to_queue"
      },
      handoff: {
        keywords: ["atendente", "humano", "falar com alguém", "suporte", "reclamação"],
        message: "Vou encaminhar você para nossa equipe. Aguarde um momento."
      },
      fallback: {
        message: "Não consegui identificar sua solicitação.",
        maxFailures: 3,
        action: "transfer_to_queue"
      },
      schedule: {
        mon: { active: true, start: "08:00", end: "18:00" },
        tue: { active: true, start: "08:00", end: "18:00" },
        wed: { active: true, start: "08:00", end: "18:00" },
        thu: { active: true, start: "08:00", end: "18:00" },
        fri: { active: true, start: "08:00", end: "18:00" },
        sat: { active: false, start: "09:00", end: "13:00" },
        sun: { active: false, start: "00:00", end: "00:00" },
        outOfOfficeMessage: "Nosso atendimento humano está indisponível agora, mas posso continuar ajudando você."
      }
    };
  });

export const saveAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.any().parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("system_settings").upsert({
      namespace: "crm",
      key: "agent_config",
      value: data
    }, { onConflict: "namespace,key" });

    if (error) throw error;
    return { ok: true };
  });

// --- TAGS ---
export const getCRMTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { data } = await supabase.from("crm_tags").select("*").order("name");
    return data || [];
  });

export const saveCRMTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string(), color: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_tags").insert(data);
    if (error) throw error;
    return { ok: true };
  });

// --- CRM FLOWS EXTENDED ---
export const deleteCRMFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_flows").delete().eq("id", data.flowId);
    if (error) throw error;
    return { ok: true };
  });

export const duplicateCRMFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ flowId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: flow } = await supabaseAdmin.from("crm_flows").select("*, steps:crm_flow_steps(*)").eq("id", data.flowId).single();
    if (!flow) throw new Error("Fluxo não encontrado");

    const { data: newFlow, error: flowErr } = await supabaseAdmin.from("crm_flows").insert({
      name: `${flow.name} (Cópia)`,
      description: flow.description,
      is_active: false
    }).select("id").single();

    if (flowErr) throw flowErr;

    if (flow.steps && flow.steps.length > 0) {
      const stepsToInsert = flow.steps.map((s: any) => ({
        flow_id: newFlow.id,
        step_key: s.step_key,
        payload: s.payload,
        order_index: s.order_index ?? 0
      }));
      await supabaseAdmin.from("crm_flow_steps").insert(stepsToInsert);
    }

    return { id: newFlow.id };
  });

// --- CRM CONTACTS ---
export const getCRMContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    
    // Unindo perfis (clientes) com informações de conversas do CRM
    const { data, error } = await supabase
      .from("profiles")
      .select("*, conversations:crm_conversations(last_message_at, status)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

// --- CRM QUICK REPLIES ---
export const getCRMQuickReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user: userId });
    if (!isAdmin) throw new Error("Acesso restrito.");
    const { data } = await supabase.from("crm_quick_replies").select("*").order("shortcut");
    return data || [];
  });

export const saveCRMQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ 
    id: z.string().uuid().optional(),
    shortcut: z.string().min(2),
    message: z.string().min(1)
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_quick_replies").upsert(data);
    if (error) throw error;
    return { ok: true };
  });
