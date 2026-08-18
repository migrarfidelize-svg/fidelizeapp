import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateAgentResponse } from "./ai-adapter.server";

export async function processAgentMessage(input: { conversationId: string; inboundText: string; flowId: string; stepId: string }) {
  const convResult = await supabaseAdmin.from("crm_conversations").select("*").eq("id", input.conversationId).single();
  if (convResult.error || !convResult.data) throw convResult.error ?? new Error("CRM_CONVERSATION_NOT_FOUND");
  const conv = convResult.data;
  if (conv.status !== "bot" || (conv.metadata as any)?.support?.active) return { action: "ignored" };

  const configResult = await (supabaseAdmin as any).from("crm_agent_settings").select("enabled, config")
    .eq("establishment_id", conv.establishment_id).maybeSingle();
  if (configResult.error) throw configResult.error;
  
  if (!configResult.data?.enabled) return { action: "ignored" };
  const config = (configResult.data.config as any) || {};
  
  if (!config.provider_id) {
    console.warn(`[AgentEngine] AI provider missing for establishment ${conv.establishment_id}`);
    return { action: "ignored" };
  }

  const { data: providerIntegration } = await supabaseAdmin
    .from("integrations")
    .select("id, enabled")
    .eq("provider", config.provider_id)
    .eq("enabled", true)
    .maybeSingle();

  if (!providerIntegration) {
    console.warn(`[AgentEngine] AI Provider ${config.provider_id} not enabled for establishment ${conv.establishment_id}`);
    return { action: "ignored" };
  }

  const handoffKeywords = Array.isArray(config.handoff?.keywords) ? config.handoff.keywords : [];
  const inputLower = input.inboundText.trim().toLowerCase();
  if (handoffKeywords.some((kw: string) => inputLower.includes(kw.toLowerCase()))) {
    return { action: "handoff_requested", message: config.handoff?.message };
  }

  const stepResult = await supabaseAdmin.from("crm_flow_steps").select("payload").eq("id", input.stepId)
    .eq("flow_id", input.flowId).eq("establishment_id", conv.establishment_id).maybeSingle();
  if (stepResult.error) throw stepResult.error;
  
  const historyResult = await supabaseAdmin.from("crm_messages").select("body, direction")
    .eq("conversation_id", input.conversationId).eq("establishment_id", conv.establishment_id)
    .order("created_at", { ascending: true }).limit(10);
  if (historyResult.error) throw historyResult.error;

  try {
    const response = await generateAgentResponse({
      providerId: config.provider_id,
      systemPrompt: `Você é ${config.name || "Assistente"}. Contexto: ${(stepResult.data?.payload as any)?.context || ""}. ${config.systemPrompt || ""}`,
      messages: (historyResult.data || []).map((message: any) => ({
        role: message.direction === "inbound" ? "user" as const : "assistant" as const,
        content: message.body || "",
      })),
    });

    const { getActiveWhatsAppProvider } = await import("../otp.functions");
    const active = await getActiveWhatsAppProvider(conv.establishment_id);
    if (!active) throw new Error("CRM_WHATSAPP_PROVIDER_NOT_FOUND");
    
    const sent = await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, response.text);
    if (!sent.ok) throw new Error(sent.message || "CRM_AGENT_SEND_FAILED");
    
    const persisted = await supabaseAdmin.from("crm_messages").insert({
      conversation_id: input.conversationId, establishment_id: conv.establishment_id, body: response.text,
      direction: "outbound", provider: active.provider.meta.id,
      provider_message_id: sent.providerMessageId || `agent-${crypto.randomUUID()}`,
      message_type: "text", metadata: { source: "agent", ai_provider: config.provider_id },
    });
    if (persisted.error) throw persisted.error;
    return { action: "replied" };
  } catch (err) {
    console.error("[AgentEngine] AI response generation failed:", err);
    throw err; // Propagate error for critical failures instead of just ignoring
  }
}

