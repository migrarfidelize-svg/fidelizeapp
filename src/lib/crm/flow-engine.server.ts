import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getAgentConfig() {
    const { data } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("namespace", "crm")
        .eq("key", "agent_config")
        .maybeSingle();
    return (data?.value as any) || { enabled: false, behavior: {} };
}

async function sendWhatsAppWrapper(conv: any, text: string, options: any = {}) {
    const { getActiveWhatsAppProvider } = await import("../otp.functions");
    const active = await getActiveWhatsAppProvider(conv.establishment_id);
    
    if (active) {
        // Fallback robusto no provider UAZAPI para interactive
        const res = await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, text, options);
        
        if (res.ok) {
            await supabaseAdmin.from("crm_messages").insert({
                conversation_id: conv.id,
                establishment_id: conv.establishment_id,
                body: text,
                direction: 'outbound',
                provider: active.provider.meta.id,
                provider_message_id: res.providerMessageId || `bot-${Date.now()}`,
                message_type: options.type === 'options' ? 'interactive' : 'text',
                metadata: { source: 'flow', options: options.options }
            });
        }
        return res;
    }
    return { ok: false, message: "No active provider" };
}

async function updateFlowState(convId: string, flowId: string | null, stepId: string | null, extra: any = {}) {
    const { data: conv } = await supabaseAdmin.from("crm_conversations").select("metadata").eq("id", convId).single();
    const metadata = (conv?.metadata as any) || {};
    metadata.flow_state = { 
        ...metadata.flow_state,
        flowId, 
        stepId, 
        ...extra 
    };
    await supabaseAdmin.from("crm_conversations").update({ metadata }).eq("id", convId);
}

export async function processStep(conv: any, step: any, allSteps: any[]): Promise<void> {
  if (!step) return;
  const payload = (step.payload as any) || {};
  const type = payload.type || step.step_key;

  console.log(`[Flow Engine] Processing step: ${step.id} (${type})`);

  switch (type) {
    case 'message':
      await sendWhatsAppWrapper(conv, payload.text || "");
      await updateFlowState(conv.id, step.flow_id, step.id);
      
      // AVANÇO AUTOMÁTICO PARA O PRÓXIMO
      const nextStep = allSteps.find(s => s.sort_order === (step.sort_order + 1));
      if (nextStep) {
          return await processStep(conv, nextStep, allSteps);
      }
      break;

    case 'question':
      await sendWhatsAppWrapper(conv, payload.text || "");
      await updateFlowState(conv.id, step.flow_id, step.id);
      // Pára aqui para esperar resposta
      break;

    case 'options':
      await sendWhatsAppWrapper(conv, payload.text || "Escolha uma opção:", { 
          type: 'options', 
          options: payload.options || [] 
      });
      await updateFlowState(conv.id, step.flow_id, step.id);
      // Pára aqui para esperar resposta
      break;

    case 'transfer_to_queue':
      await sendWhatsAppWrapper(conv, payload.text || "Transferindo para um atendente...");
      await supabaseAdmin.from("crm_conversations").update({ 
          status: 'waiting', 
          assigned_to: null,
          updated_at: new Date().toISOString()
      }).eq("id", conv.id);
      await updateFlowState(conv.id, null, null, { mode: 'manual' });
      break;

    case 'agent':
      const agentConfig = await getAgentConfig();
      // ERRO 4: Validar se IA está disponível antes de entrar no modo Agent
      if (!agentConfig.enabled) {
          await sendWhatsAppWrapper(conv, "No momento nossa IA está indisponível. Vou te transferir para um atendente humano. 💜");
          // Fallback para handoff
          const queueStep = allSteps.find(s => s.step_key === 'transfer_to_queue');
          if (queueStep) return await processStep(conv, queueStep, allSteps);
          return;
      }

      // ERRO 8: Apenas envia mensagem de entrada e muda modo. NÃO chama LLM agora.
      await sendWhatsAppWrapper(conv, "Perfeito! Conte um pouco mais sobre o que você precisa. 💜");
      await updateFlowState(conv.id, step.flow_id, step.id, { mode: 'agent' });
      break;
  }
}

export async function executeFlow(conversationId: string, messageBody: string) {
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("crm_conversations")
    .select("*, metadata, establishment_id")
    .eq("id", conversationId)
    .single();

  if (convErr || !conv || conv.status !== 'bot') return;

  const agentConfig = await getAgentConfig();
  const normalizedInput = messageBody.trim().toLowerCase();
  
  // ERRO 9: Garantir flowId ou materializar se necessário
  let flowId = (conv.metadata as any)?.flow_state?.flowId || agentConfig?.behavior?.mainFlowId;
  
  if (!flowId) {
      console.log("[Flow Engine] No flowId found, triggering bootstrap...");
      const { ensureDefaultWhatsAppFlow } = await import("./bootstrap.server");
      const boot = await ensureDefaultWhatsAppFlow();
      flowId = boot.flowId;
  }

  const { data: flow, error: flowErr } = await supabaseAdmin
    .from("crm_flows")
    .select("*, steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)")
    .eq("id", flowId)
    .single();

  if (flowErr || !flow) {
      console.error("[Flow Engine] Flow not found:", flowId, flowErr);
      return;
  }

  const steps = (flow.steps || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const flowState = (conv.metadata as any)?.flow_state;

  // ERRO 2: Comando Menu/Voltar
  const menuKeywords = ['menu', 'voltar', 'início', 'inicio', 'opções', 'opcoes'];
  if (menuKeywords.some(k => normalizedInput === k)) {
      const menuStep = steps.find(s => (s.payload?.type || s.step_key) === 'options');
      if (menuStep) {
          await updateFlowState(conv.id, flowId, menuStep.id, { mode: 'flow' });
          return await processStep(conv, menuStep, steps);
      }
  }

  // Comandos de Handoff manual
  const humanKeywords = ['atendente', 'humano', 'suporte', 'falar com alguém', 'reclamação'];
  if (humanKeywords.some(k => normalizedInput.includes(k))) {
    const queueStep = steps.find(s => s.step_key === 'transfer_to_queue');
    if (queueStep) return await processStep(conv, queueStep, steps);
    return;
  }

  // Modo Agent
  if (flowState?.mode === 'agent') {
    const { processAgentMessage } = await import("./agent-engine.server");
    return await processAgentMessage({
      conversationId: conv.id,
      customerPhone: conv.customer_phone,
      inboundText: messageBody,
      flowId: flowState?.flowId,
      stepId: flowState?.stepId
    });
  }

  // Lógica de avanço de passos baseada em resposta
  if (flowState?.stepId) {
    const currentStep = steps.find((s: any) => s.id === flowState.stepId);
    if (!currentStep) return;

    if (currentStep.step_key === 'options') {
      const payload = (currentStep.payload as any) || {};
      const options = (payload.options as any[]) || [];
      const option = options.find((o: any) => o.value === messageBody.trim() || o.label.toLowerCase().includes(normalizedInput));
      
      if (option) {
        const next = steps.find((s: any) => s.id === option.nextStepId);
        if (next) return await processStep(conv, next, steps);
      } else {
          // Repete o menu se a opção for inválida
          return await processStep(conv, currentStep, steps);
      }
    }
    
    // Fallback: Avança para o próximo se não for options (ex: message/question sem lógica específica)
    const nextIdx = steps.findIndex(s => s.id === currentStep.id) + 1;
    if (nextIdx < steps.length) {
        return await processStep(conv, steps[nextIdx], steps);
    }
  } else {
    // Início do fluxo
    await processStep(conv, steps[0], steps);
  }
}
