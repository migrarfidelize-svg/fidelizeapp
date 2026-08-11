import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateAgentResponse } from "./ai-adapter.server";

export interface AgentEngineInput {
  conversationId: string;
  customerPhone: string;
  inboundText: string;
  flowId?: string;
  stepId?: string;
  additionalContext?: string;
}

/**
 * Motor principal do Agente IA.
 * Responsável por carregar contexto, histórico e gerar resposta via LLM.
 */
export async function processAgentMessage(input: AgentEngineInput) {
  const { conversationId, customerPhone, inboundText, flowId, stepId, additionalContext } = input;

  // 1. Garantia de Estado: Buscar conversa atualizada
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("crm_conversations")
    .select("*, contact:crm_contacts(*)")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) return;

  // 2. Bloqueios de Segurança (Server-side)
  if (['waiting', 'assigned', 'closed'].includes(conv.status)) {
    console.log(`[Agent Engine] Aborting: Conversation status is ${conv.status}`);
    return;
  }

  // 3. Carregar Configuração do Agent
  const { data: agentConfigRow } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("namespace", "crm")
    .eq("key", "agent_config")
    .maybeSingle();
  
  const agentConfig = (agentConfigRow?.value as any) || {};
  if (!agentConfig.enabled) return;

  // 4. Handoff Manual (Keywords)
  const handoffKeywords = agentConfig.handoff?.keywords || ['atendente', 'humano', 'suporte', 'falar com alguém'];
  if (handoffKeywords.some((k: string) => inboundText.toLowerCase().includes(k.toLowerCase()))) {
    return await executeHandoff(conv, agentConfig.handoff?.message || "Vou encaminhar você para nossa equipe. Aguarde um momento. 💜");
  }

  try {
    // 5. Carregar Histórico Recente (20 mensagens)
    const { data: historyData } = await supabaseAdmin
      .from("crm_messages")
      .select("body, direction, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    const messages = (historyData || [])
      .reverse()
      .map(m => ({
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as "user" | "assistant",
        content: m.body
      }));

    // 6. Preparar System Prompt e Contexto
    const contactName = conv.contact?.name || "Cliente";
    const systemPrompt = `
      ${agentConfig.systemPrompt || `Você é o Assistente Virtual da Fidelize.
      Atenda clientes pelo WhatsApp de forma natural, educada, objetiva e humana.`}

      REGRAS:
      1. Use o nome do cliente: ${contactName}.
      2. Nunca invente informação. Use apenas o contexto fornecido.
      3. Se o cliente pedir atendente/humano/suporte, retorne a ação "handoff".
      4. Responda em JSON estruturado: {"action": "reply" | "handoff", "message": "texto para o cliente"}.
      
      CONTEXTO ADICIONAL:
      ${additionalContext || ''}
      ${agentConfig.presentation || ''}
    `;

    // 7. Chamar LLM Real
    const response = await generateAgentResponse({
      providerId: agentConfig.provider_id || 'openai',
      model: agentConfig.model,
      systemPrompt,
      messages,
      temperature: agentConfig.temperature || 0.7,
      maxTokens: agentConfig.max_tokens || 500
    });

    // 8. Processar Resposta (Handoff ou Mensagem)
    if (response.action === 'handoff') {
      return await executeHandoff(conv, agentConfig.handoff?.message || "Vou encaminhar você para nossa equipe. Aguarde um momento. 💜");
    }

    // 9. Enviar WhatsApp e Persistir
    await sendAgentWhatsApp(conv, response.text, { flowId, stepId, agentName: agentConfig.name || "Assistente Fidelize" });

    // 10. Atualizar Estado da Conversa (Manter modo Agent)
    await updateAgentFlowState(conv.id, flowId, stepId);

  } catch (error) {
    console.error("[Agent Engine] Processing failed:", error);
    // 11. Fallback em caso de erro da IA
    await executeHandoff(conv, agentConfig.fallback?.message || "Não consegui concluir seu atendimento automaticamente. Vou encaminhar você para nossa equipe.");
  }
}

async function executeHandoff(conv: any, message: string) {
  // Enviar mensagem de despedida/transição
  await sendAgentWhatsApp(conv, message, { agentName: "Sistema" });
  
  // Mudar status para waiting
  await supabaseAdmin
    .from("crm_conversations")
    .update({ 
      status: 'waiting', 
      assigned_to: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", conv.id);
  
  // Limpar flow state
  await updateAgentFlowState(conv.id, null, null, { mode: 'manual' });
}

async function sendAgentWhatsApp(conv: any, text: string, meta: { flowId?: string, stepId?: string, agentName: string }) {
  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider();
  
  if (active) {
    const res = await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, text);
    
    if (res.ok) {
        await supabaseAdmin.from("crm_messages").insert({
            conversation_id: conv.id,
            body: text,
            direction: 'outbound',
            provider: active.provider.meta.id,
            provider_message_id: res.providerMessageId || `agent-${Date.now()}`,
            message_type: 'text',
            metadata: {
                source: 'agent',
                agent: meta.agentName,
                flow_id: meta.flowId,
                step_id: meta.stepId
            }
        });
    }
  }
}

async function updateAgentFlowState(convId: string, flowId: string | undefined | null, stepId: string | undefined | null, extra: any = {}) {
    const { data: conv } = await supabaseAdmin.from("crm_conversations").select("metadata").eq("id", convId).single();
    const metadata = (conv?.metadata as any) || {};
    
    metadata.flow_state = { 
      flowId, 
      stepId, 
      mode: flowId ? "agent" : "manual",
      ...extra 
    };
    
    await supabaseAdmin
      .from("crm_conversations")
      .update({ metadata })
      .eq("id", convId);
}
