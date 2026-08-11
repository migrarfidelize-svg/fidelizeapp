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
export async function processAgentMessage(input: AgentEngineInput): Promise<void> {
  const { conversationId, customerPhone, inboundText, flowId, stepId, additionalContext } = input;

  // 1. Garantia de Estado: Buscar conversa atualizada
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("crm_conversations")
    .select("*, contact:crm_contacts(*)")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv) {
    console.error("[Agent Engine] Conversation not found:", convErr);
    return;
  }

  // 2. Bloqueios de Segurança (Server-side)
  if (conv.status !== 'bot') {
    console.log(`[Agent Engine] Aborting: Conversation status is ${conv.status}`);
    return;
  }

  // 3. Carregar Configuração do Agent
  const { data: agentConfigRow, error: configErr } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("namespace", "crm")
    .eq("key", "agent_config")
    .maybeSingle();
  
  if (configErr) {
    console.error("[Agent Engine] Config fetch error:", configErr);
  }

  const agentConfig = (agentConfigRow?.value as any) || {};
  if (!agentConfig.enabled) return;

  // 4. Handoff e Comandos Globais (Keywords)
  const normalizedInput = inboundText.toLowerCase().trim();
  
  // Comandos de Menu (Tratado no flow-engine, mas garantido aqui)
  const menuKeywords = ['menu', 'voltar', 'início', 'inicio', 'opções', 'opcoes'];
  if (menuKeywords.some(k => normalizedInput === k)) {
    const mainFlowId = agentConfig?.behavior?.mainFlowId;
    if (mainFlowId) {
      const { executeFlow } = await import("./flow-engine.server");
      await updateAgentFlowState(conv.id, mainFlowId, null, { mode: 'flow' });
      await executeFlow(conv.id, "menu");
      return;
    }
  }

  const handoffKeywords = agentConfig.handoff?.keywords || ['atendente', 'humano', 'suporte', 'falar com alguém', 'falar com uma pessoa'];
  if (handoffKeywords.some((k: string) => normalizedInput.includes(k.toLowerCase()))) {
    await executeHandoff(conv, agentConfig.handoff?.message || "Vou encaminhar você para nossa equipe. Aguarde um momento. 💜");
    return;
  }

  try {
    // 5. Carregar Contexto do Step se disponível
    let stepContext = additionalContext || "";
    if (stepId) {
      const { data: stepData, error: stepErr } = await supabaseAdmin
        .from("crm_flow_steps")
        .select("payload")
        .eq("id", stepId)
        .maybeSingle();
      
      if (!stepErr && stepData) {
        const payload = (stepData.payload as any) || {};
        if (payload.context) {
          stepContext = payload.context;
        }
      }
    }

    // 6. Carregar Histórico Recente (20 mensagens)
    const { data: historyData, error: historyErr } = await supabaseAdmin
      .from("crm_messages")
      .select("body, direction, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (historyErr) throw historyErr;

    const messages = (historyData || [])
      .reverse()
      .map(m => ({
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as "user" | "assistant",
        content: m.body || ""
      }));

    // 7. Preparar System Prompt e Contexto
    const contactName = (conv.contact as any)?.name || "Cliente";
    const systemPrompt = `
      ${agentConfig.systemPrompt || `Você é o Assistente Virtual da Fidelize.
      Atenda clientes pelo WhatsApp de forma natural, educada, objetiva e humana.`}

      REGRAS:
      1. Use o nome do cliente: ${contactName}.
      2. Nunca invente informação. Use apenas o contexto fornecido.
      3. Se o cliente pedir atendente/humano/suporte, retorne a ação "handoff".
      4. Responda em JSON estruturado: {"action": "reply" | "handoff", "message": "texto para o cliente"}.
      
      CONTEXTO DO ATENDIMENTO ATUAL:
      ${stepContext}

      ${agentConfig.presentation || ''}
    `;

    // 8. Chamar LLM Real
    const response = await generateAgentResponse({
      providerId: agentConfig.provider_id || 'openai',
      model: agentConfig.model,
      systemPrompt,
      messages,
      temperature: agentConfig.temperature || 0.7,
      maxTokens: agentConfig.max_tokens || 500
    });

    // 9. Processar Resposta (Handoff ou Mensagem)
    if (response.action === 'handoff') {
      await executeHandoff(conv, agentConfig.handoff?.message || "Vou encaminhar você para nossa equipe. Aguarde um momento. 💜");
      return;
    }

    // 10. Enviar WhatsApp e Persistir
    await sendAgentWhatsApp(conv, response.text, { flowId, stepId, agentName: agentConfig.name || "Assistente Fidelize" });

    // 11. Atualizar Estado da Conversa (Manter modo Agent)
    await updateAgentFlowState(conv.id, flowId, stepId);

  } catch (error) {
    console.error("[Agent Engine] Processing failed:", error);
    await executeHandoff(conv, agentConfig.fallback?.message || "Não consegui concluir seu atendimento automaticamente. Vou encaminhar você para nossa equipe.");
  }
}

async function executeHandoff(conv: any, message: string) {
  await sendAgentWhatsApp(conv, message, { agentName: "Sistema" });
  await supabaseAdmin
    .from("crm_conversations")
    .update({ 
      status: 'waiting', 
      assigned_to: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", conv.id);
  await updateAgentFlowState(conv.id, null, null, { mode: 'manual' });
}

async function sendAgentWhatsApp(conv: any, text: string, meta: { flowId?: string, stepId?: string, agentName: string }) {
  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider(conv.establishment_id);
  
  if (active) {
    const res = await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, text);
    
    if (res.ok) {
        await supabaseAdmin.from("crm_messages").insert({
            conversation_id: conv.id,
            establishment_id: conv.establishment_id,
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
      mode: flowId ? (extra.mode || "agent") : "manual",
      ...extra 
    };
    
    await supabaseAdmin
      .from("crm_conversations")
      .update({ metadata })
      .eq("id", convId);
}
