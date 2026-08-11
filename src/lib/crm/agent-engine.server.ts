import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateAgentResponse } from "./ai-adapter.server";
import { Json } from "@/integrations/supabase/types";

export async function processAgentMessage(input: {
  conversationId: string;
  customerPhone: string;
  inboundText: string;
  flowId: string;
  stepId: string;
}) {
  const { conversationId, inboundText, stepId } = input;
  const { data: conv } = await supabaseAdmin.from("crm_conversations").select("*").eq("id", conversationId).single();
  if (conv?.status !== 'bot') return;

  const { data: agentConfigRow } = await supabaseAdmin.from("system_settings").select("value").eq("namespace", "crm").eq("key", "agent_config").maybeSingle();
  const agentConfig = (agentConfigRow?.value as any) || {};

  let stepContext = "";
  if (stepId) {
    const { data: stepData } = await supabaseAdmin.from("crm_flow_steps").select("payload").eq("id", stepId).maybeSingle();
    const payload = stepData?.payload as { context?: string } | null;
    stepContext = payload?.context || "";
  }

  const { data: messagesData } = await supabaseAdmin.from("crm_messages")
    .select("body, direction")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(10);

  const messages: { role: "user" | "assistant" | "system"; content: string }[] = (messagesData || []).map(m => ({
    role: (m.direction === 'inbound' ? 'user' : 'assistant') as "user" | "assistant",
    content: m.body || ""
  }));

  const systemPrompt = `Você é ${agentConfig.name || "Assistente"}. Contexto: ${stepContext}. ${agentConfig.systemPrompt || ""}`;

  const response = await generateAgentResponse({
    providerId: agentConfig.provider_id || "openai",
    systemPrompt,
    messages
  });

  await supabaseAdmin.from("crm_messages").insert({
    conversation_id: conversationId,
    establishment_id: conv.establishment_id,
    body: response.text,
    direction: 'outbound',
    provider: agentConfig.provider_id || 'openai',
    provider_message_id: `agent-${Date.now()}`,
    message_type: 'text'
  });

  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider(conv.establishment_id);
  if (active) {
    await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, response.text);
  }
}
