import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_SUPPORT_TERMS = ["5", "suporte", "atendente", "falar com atendente", "falar com suporte", "humano", "ajuda humana"];
const stepType = (step: any) => step?.payload?.type || step?.step_key;

async function sendAndPersist(conv: any, text: string, options: any = {}, source = "flow") {
  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider(conv.establishment_id);
  if (!active) throw new Error("CRM_WHATSAPP_PROVIDER_NOT_FOUND");
  const sent = await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, text, options);
  if (!sent.ok) throw new Error(sent.message || "CRM_WHATSAPP_SEND_FAILED");
  const persisted = await (supabaseAdmin as any).from("crm_messages").insert({
    conversation_id: conv.id, establishment_id: conv.establishment_id, body: text,
    direction: "outbound", provider: active.provider.meta.id,
    provider_message_id: sent.providerMessageId || `${source}-${crypto.randomUUID()}`,
    message_type: "text", metadata: { source },
  });
  if (persisted.error) throw persisted.error;
}

async function updateState(conv: any, flowId: string | null, stepId: string | null, extra: Record<string, unknown> = {}) {
  const metadata = (conv.metadata as Record<string, unknown>) || {};
  const result = await (supabaseAdmin as any).from("crm_conversations").update({
    metadata: { ...metadata, flow_state: { ...((metadata.flow_state as object) || {}), flowId, stepId, ...extra } },
  }).eq("id", conv.id).eq("establishment_id", conv.establishment_id);
  if (result.error) throw result.error;
}

async function handoff(conv: any, confirmation: string) {
  const existing = await (supabaseAdmin as any).from("crm_support_tickets").select("id")
    .eq("conversation_id", conv.id).eq("establishment_id", conv.establishment_id).in("status", ["open", "in_progress"]).maybeSingle();
  if (existing.error) throw existing.error;
  let ticketId = (existing.data as any)?.id;
  if (!ticketId) {
    const ticket = await (supabaseAdmin as any).from("crm_support_tickets").insert({
      conversation_id: conv.id, establishment_id: conv.establishment_id, status: "open",
    }).select("id").single();
    if (ticket.error || !ticket.data) throw ticket.error ?? new Error("CRM_SUPPORT_TICKET_FAILED");
    ticketId = (ticket.data as any).id;
  }
  
  const metadata = { 
    ...((conv.metadata as object) || {}), 
    support: { active: true, ticketId }, 
    flow_state: { mode: "manual", flowId: null, stepId: null } 
  };
  
  const updated = await (supabaseAdmin as any).from("crm_conversations").update({
    status: "waiting", assigned_to: null, assigned_at: null, metadata,
  }).eq("id", conv.id).eq("establishment_id", conv.establishment_id);
  
  if (updated.error) throw updated.error;
  
  if (!(conv.metadata as any)?.support?.active) {
    await sendAndPersist(conv, confirmation, {}, "support_handoff");
  }
  
  return { ok: true, action: "handoff" } as const;
}

export type FlowActionResult = { ok: boolean; action: string; error?: unknown };

export async function processStep(conv: any, step: any, steps: any[]): Promise<FlowActionResult> {
  if (!step) return { ok: false, action: "error", error: "Step is null" };
  const payload = step.payload as any;
  switch (stepType(step)) {
    case "message": {
      await sendAndPersist(conv, payload.text || "");
      await updateState(conv, step.flow_id, step.id);
      const next = steps.find((candidate: any) => candidate.sort_order === step.sort_order + 1);
      return next ? processStep(conv, next, steps) : { ok: true, action: "end" };
    }
    case "options":
      await sendAndPersist(conv, payload.text || "Escolha:", { type: "options", options: payload.options || [] });
      await updateState(conv, step.flow_id, step.id);
      return { ok: true, action: "menu" };
    case "transfer_to_queue":
      return handoff(conv, payload.text || "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜");
    case "agent":
      await sendAndPersist(conv, "Perfeito! Conte o que precisa. 💜");
      await updateState(conv, step.flow_id, step.id, { mode: "agent" });
      return { ok: true, action: "agent" };
    default:
      return { ok: true, action: "end" };
  }
}

export async function executeFlow(conversationId: string, messageBody: string): Promise<FlowActionResult> {
  const conversationResult = await (supabaseAdmin as any).from("crm_conversations").select("*").eq("id", conversationId).single();
  if (conversationResult.error || !conversationResult.data) throw conversationResult.error ?? new Error("CRM_CONVERSATION_NOT_FOUND");
  const conv = conversationResult.data;
  
  if (conv.status !== "bot" || (conv.metadata as any)?.support?.active) return { ok: true, action: "ignored" };

  const input = messageBody.trim().toLocaleLowerCase("pt-BR");

  const settingsResult = await (supabaseAdmin as any).from("crm_agent_settings").select("flow_id, enabled, config")
    .eq("establishment_id", conv.establishment_id).maybeSingle();
  if (settingsResult.error) throw settingsResult.error;
  
  if (!(settingsResult.data as any)?.enabled) return { ok: true, action: "ignored" };
  
  const config = ((settingsResult.data as any).config as any) || {};
  const customKeywords = Array.isArray(config.handoff?.keywords) ? config.handoff.keywords : [];
  const supportTerms = [...new Set([...DEFAULT_SUPPORT_TERMS, ...customKeywords])];

  if (supportTerms.some((term) => input === term || (term.length > 3 && input.includes(term)))) {
    return handoff(conv, config.fallback?.message || "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜");
  }

  const state = (conv.metadata as any)?.flow_state;
  const flowId = state?.flowId || (settingsResult.data as any).flow_id;
  
  const flowResult = await (supabaseAdmin as any).from("crm_flows")
    .select("*, steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)")
    .eq("id", flowId).eq("establishment_id", conv.establishment_id).eq("is_active", true).single();
  if (flowResult.error || !flowResult.data) throw flowResult.error ?? new Error("CRM_FLOW_NOT_FOUND");
  
  const steps = (flowResult.data.steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order);

  if (input === "menu" || input === "voltar") return processStep(conv, steps.find((s: any) => stepType(s) === "options"), steps);

  if (state?.mode === "agent") {
    const { processAgentMessage } = await import("./agent-engine.server");
    const agentResult = await processAgentMessage({ conversationId, inboundText: messageBody, flowId, stepId: state.stepId });
    
    if (agentResult.action === "handoff_requested") {
      return handoff(conv, config.fallback?.message || "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜");
    }
    
    return { ok: true, action: "agent" };
  }
  
  if (state?.stepId) {
    const current = steps.find((s: any) => s.id === state.stepId);
    if (current && stepType(current) === "options") {
      const option = ((current.payload as any)?.options || []).find((item: any) => item.value === input);
      if (option) return processStep(conv, steps.find((s: any) => s.id === option.nextStepId), steps);
    }
  }
  
  return processStep(conv, steps[0], steps);
}
