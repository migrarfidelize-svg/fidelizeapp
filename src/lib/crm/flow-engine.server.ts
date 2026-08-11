import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function executeFlow(conversationId: string, messageBody: string) {
  const { data: conv } = await (supabaseAdmin as any)
    .from("crm_conversations")
    .select("*, metadata, establishment_id")
    .eq("id", conversationId)
    .single();

  if (!conv) return;
  // Bot para se a conversa estiver atribuída a um humano
  if (conv.status === 'assigned') return;

  const { data: agentConfigRow } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("namespace", "crm")
    .eq("key", "agent_config")
    .maybeSingle();
  
  const agentConfig = (agentConfigRow?.value as any) || {};

  // Idempotent Seed: Trigger only if flow is missing
  if (!agentConfig?.behavior?.mainFlowId) {
    const { ensureDefaultWhatsAppFlow } = await import("./bootstrap.server");
    await ensureDefaultWhatsAppFlow();
  }

  if (!agentConfig.enabled) return;


  // 0. Global Intents (Human / Menu)
  const normalizedInput = messageBody.trim().toLowerCase();
  const humanKeywords = ['atendente', 'humano', 'falar com alguém', 'quero falar com uma pessoa', 'suporte humano', 'não resolveu', 'reclamação'];
  const menuKeywords = ['menu', 'voltar', 'início', 'inicio', 'opções', 'opcoes'];

  if (humanKeywords.some(k => normalizedInput.includes(k))) {
    await sendWhatsApp(conv.customer_phone, "Entendi. Vou encaminhar você para nossa equipe de atendimento. Aguarde um momento. 💜");
    await supabaseAdmin.from("crm_conversations").update({ status: 'waiting', assigned_to: null }).eq("id", conv.id);
    await updateFlowState(conv.id, null, null, { mode: 'manual' });
    return;
  }

  if (menuKeywords.some(k => normalizedInput === k)) {
    const mainFlowId = agentConfig?.behavior?.mainFlowId;
    if (mainFlowId) {
      await sendWhatsApp(conv.customer_phone, "Claro! Escolha uma opção:");
      await updateFlowState(conv.id, mainFlowId, null, { mode: 'flow' });
      return executeFlow(conversationId, ""); // Restart flow
    }
  }

  const flowState = (conv.metadata as any)?.flow_state;
  let currentFlowId = flowState?.flowId;
  let currentStepId = flowState?.stepId;

  // Se a conversa já estiver em modo Agent, redirecionar para o processador de IA
  if (flowState?.mode === 'agent' && conv.status === 'bot') {
    const { processAgentMessage } = await import("./agent-engine.server");
    await processAgentMessage({
      conversationId: conv.id,
      customerPhone: conv.customer_phone,
      inboundText: messageBody,
      flowId: currentFlowId,
      stepId: currentStepId
    });
    return;
  }

  if (!currentFlowId) {
    currentFlowId = agentConfig?.behavior?.mainFlowId;
    if (!currentFlowId) return;
  }


  const { data: flow } = await (supabaseAdmin as any)
    .from("crm_flows")
    .select("*, steps:crm_flow_steps(*)")
    .eq("id", currentFlowId)
    .single();

  if (!flow || !flow.is_active) return;

  const steps = (flow.steps || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  
  if (currentStepId) {
    const lastStep = steps.find((s: any) => s.id === currentStepId);
    const stepPayload = (lastStep?.payload as any) || {};
    const stepType = stepPayload.type || lastStep?.step_key;

    // --- Name Capture Handling ---
    if (flowState?.capturing === 'name' && messageBody.length > 2) {
      const { data: contact } = await supabaseAdmin
        .from("crm_contacts")
        .select("id, name_source")
        .eq("id", conv.contact_id)
        .maybeSingle();
      
      if (contact && (!contact.name_source || contact.name_source === 'push_name')) {
        await supabaseAdmin.from("crm_contacts").update({
          name: messageBody.trim(),
          name_source: 'flow',
          updated_at: new Date().toISOString()
        }).eq("id", contact.id);
      }
      
      const nextIdx = steps.indexOf(lastStep) + 1;
      if (steps[nextIdx]) return await processStep(conv, steps[nextIdx], steps);
    }

    if (stepType === 'options') {
      const option = stepPayload.options?.find((o: any) => o.value.toLowerCase() === messageBody.trim().toLowerCase() || o.label.toLowerCase() === messageBody.trim().toLowerCase());
      if (option) {
        const next = steps.find((s: any) => s.id === option.nextStepId);
        if (next) return await processStep(conv, next, steps);
      }
    }
  }

  const initialStep = currentStepId ? steps.find((s: any) => s.id === currentStepId) : steps[0];
  if (initialStep) await processStep(conv, initialStep, steps);
}

async function processStep(conv: any, step: any, allSteps: any[]) {
  if (!step) return;
  
  const payload = (step.payload as any) || {};
  const type = payload.type || step.step_key;

  switch (type) {
    case 'message':
    case 'question':
      await sendWhatsApp(conv.customer_phone, payload.text || "Sem conteúdo");
      await updateFlowState(conv.id, step.flow_id, step.id);
      break;

    case 'options':
      await sendWhatsApp(conv.customer_phone, payload.text || "Escolha uma opção:", { type: 'options', options: payload.options || [] });
      await updateFlowState(conv.id, step.flow_id, step.id);
      break;


    case 'capture_name': {
      await sendWhatsApp(conv.customer_phone, payload.text || "Qual é o seu nome?");
      await updateFlowState(conv.id, step.flow_id, step.id, { capturing: 'name' });
      break;
    }

    case 'transfer_to_queue':
      await sendWhatsApp(conv.customer_phone, payload.text || "Transferindo para um atendente...");
      await supabaseAdmin.from("crm_conversations").update({ status: 'waiting', assigned_to: null }).eq("id", conv.id);
      await updateFlowState(conv.id, null, null);
      break;

    case 'close':
      await sendWhatsApp(conv.customer_phone, payload.text || "Atendimento finalizado.");
      await supabaseAdmin.from("crm_conversations").update({ status: 'closed', closed_at: new Date().toISOString() }).eq("id", conv.id);
      await updateFlowState(conv.id, null, null);
      break;

    case 'agent': {
      const { processAgentMessage } = await import("./agent-engine.server");
      await processAgentMessage({
        conversationId: conv.id,
        customerPhone: conv.customer_phone,
        inboundText: "", // Primeira entrada no bloco
        flowId: step.flow_id,
        stepId: step.id,
        additionalContext: payload.context || ""
      });
      break;
    }
  }
}

async function sendWhatsApp(phone: string, text: string, options: any = {}) {
  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider();
  if (active) {
    // Registramos a mensagem de saída para que apareça no CRM em tempo real
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin.from("crm_conversations").select("id, establishment_id").eq("customer_phone", phone).maybeSingle();
    
    const res = await active.provider.sendTestMessage(active.runtime, process.env as any, phone, text, options);
    
    if (conv && res.ok) {
        await supabaseAdmin.from("crm_messages").insert({
            conversation_id: conv.id,
            establishment_id: conv.establishment_id,
            body: text,
            direction: 'outbound',
            provider: active.provider.meta.id,
            provider_message_id: res.providerMessageId || `bot-${Date.now()}`,
            message_type: 'text'
        });
    }
  }
}

async function updateFlowState(convId: string, flowId: string | null, stepId: string | null, extra: any = {}) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin.from("crm_conversations").select("metadata").eq("id", convId).single();
    const metadata = (conv?.metadata as any) || {};
    metadata.flow_state = { flowId, stepId, ...extra };
    
    await supabaseAdmin
      .from("crm_conversations")
      .update({ metadata })
      .eq("id", convId);
}
