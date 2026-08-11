import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getAgentConfig() {
    const { data, error } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("namespace", "crm")
        .eq("key", "agent_config")
        .maybeSingle();
    if (error) console.error("[Flow Engine] getAgentConfig error:", error);
    return (data?.value as any) || { enabled: false, behavior: {} };
}

async function sendWhatsAppWrapper(conv: any, text: string, options: any = {}) {
    const { getActiveWhatsAppProvider } = await import("../otp.functions");
    const active = await getActiveWhatsAppProvider(conv.establishment_id);
    
    if (active) {
        const res = await active.provider.sendTestMessage(active.runtime, process.env as any, conv.customer_phone, text, options);
        
        if (res.ok) {
            await supabaseAdmin.from("crm_messages").insert({
                conversation_id: conv.id,
                establishment_id: conv.establishment_id,
                body: text,
                direction: 'outbound',
                provider: active.provider.meta.id,
                provider_message_id: res.providerMessageId || `bot-${Date.now()}`,
                message_type: 'text',
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

export type FlowActionResult = {
    ok: boolean;
    action: "welcome_menu" | "menu" | "agent" | "handoff" | "ignored_human" | "error";
    error?: any;
};

export async function processStep(conv: any, step: any, allSteps: any[]): Promise<FlowActionResult> {
  if (!step) return { ok: false, action: "error", error: "Step is null" };
  const payload = (step.payload as any) || {};
  const type = payload.type || step.step_key;

  console.log(`[Flow Engine] Processing step: ${step.id} (${type})`);

  try {
    switch (type) {
      case 'message':
        await sendWhatsAppWrapper(conv, payload.text || "");
        await updateFlowState(conv.id, step.flow_id, step.id);
        
        // AUTO ADVANCE
        const nextStep = allSteps.find(s => s.sort_order === (step.sort_order + 1));
        if (nextStep) {
            return await processStep(conv, nextStep, allSteps);
        }
        return { ok: true, action: "welcome_menu" };

      case 'question':
        await sendWhatsAppWrapper(conv, payload.text || "");
        await updateFlowState(conv.id, step.flow_id, step.id);
        return { ok: true, action: "menu" };

      case 'options':
        await sendWhatsAppWrapper(conv, payload.text || "Escolha uma opção:", { 
            type: 'options', 
            options: payload.options || [] 
        });
        await updateFlowState(conv.id, step.flow_id, step.id);
        return { ok: true, action: "menu" };

      case 'transfer_to_queue':
        await sendWhatsAppWrapper(conv, payload.text || "Transferindo para um atendente...");
        await supabaseAdmin.from("crm_conversations").update({ 
            status: 'waiting', 
            assigned_to: null,
            updated_at: new Date().toISOString()
        }).eq("id", conv.id);
        await updateFlowState(conv.id, null, null, { mode: 'manual' });
        return { ok: true, action: "handoff" };

      case 'agent':
        const agentConfig = await getAgentConfig();
        if (!agentConfig.enabled) {
            await sendWhatsAppWrapper(conv, "No momento nossa IA está indisponível. Vou te transferir para um atendente humano. 💜");
            const queueStep = allSteps.find(s => s.step_key === 'transfer_to_queue');
            if (queueStep) return await processStep(conv, queueStep, allSteps);
            return { ok: true, action: "handoff" };
        }

        await sendWhatsAppWrapper(conv, "Perfeito! Conte um pouco mais sobre o que você precisa. 💜");
        await updateFlowState(conv.id, step.flow_id, step.id, { mode: 'agent' });
        return { ok: true, action: "agent" };

      default:
        return { ok: true, action: "error", error: `Unknown step type: ${type}` };
    }
  } catch (err) {
    console.error("[Flow Engine] processStep Error:", err);
    return { ok: false, action: "error", error: err };
  }
}

export async function executeFlow(conversationId: string, messageBody: string): Promise<FlowActionResult> {
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("crm_conversations")
    .select("*, metadata, establishment_id")
    .eq("id", conversationId)
    .single();

  if (convErr) return { ok: false, action: "error", error: convErr };
  if (!conv) return { ok: false, action: "error", error: "Conversation not found" };
  
  // No re-activate bot from inbound if manual/waiting
  if (conv.status !== 'bot') {
      return { ok: true, action: "ignored_human" };
  }

  const agentConfig = await getAgentConfig();
  const normalizedInput = messageBody.trim().toLowerCase();
  
  // GLOBAL HANDOFF
  const handoffKeywords = ['atendente', 'humano', 'suporte', 'falar com alguém', 'reclamação', 'falar com uma pessoa'];
  if (handoffKeywords.some(k => normalizedInput.includes(k))) {
    // Try to find the real transfer step from the current flow or default
    const flowIdForHandoff = (conv.metadata as any)?.flow_state?.flowId || agentConfig?.behavior?.mainFlowId;
    if (flowIdForHandoff) {
        const { data: steps } = await supabaseAdmin.from("crm_flow_steps").select("*").eq("flow_id", flowIdForHandoff);
        const queueStep = steps?.find(s => s.step_key === 'transfer_to_queue');
        if (queueStep) return await processStep(conv, queueStep, steps || []);
    }
    
    // Fallback if no step found
    await sendWhatsAppWrapper(conv, "Vou encaminhar você para nossa equipe. Aguarde um momento. 💜");
    await supabaseAdmin.from("crm_conversations").update({ 
        status: 'waiting', 
        assigned_to: null,
        updated_at: new Date().toISOString()
    }).eq("id", conv.id);
    await updateFlowState(conv.id, null, null, { mode: 'manual' });
    return { ok: true, action: "handoff" };
  }

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
      return { ok: false, action: "error", error: flowErr || "Flow not found" };
  }

  const steps = (flow.steps || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const flowState = (conv.metadata as any)?.flow_state;

  // GLOBAL MENU COMMAND
  const menuKeywords = ['menu', 'voltar', 'início', 'inicio', 'opções', 'opcoes'];
  if (menuKeywords.some(k => normalizedInput === k)) {
      const menuStep = steps.find(s => {
          const p = s.payload as any;
          return (p?.type || s.step_key) === 'options';
      });
      if (menuStep) {
          await updateFlowState(conv.id, flowId, menuStep.id, { mode: 'flow' });
          return await processStep(conv, menuStep, steps);
      }
  }

  // AGENT MODE
  if (flowState?.mode === 'agent') {
    const { processAgentMessage } = await import("./agent-engine.server");
    await processAgentMessage({
      conversationId: conv.id,
      customerPhone: conv.customer_phone,
      inboundText: messageBody,
      flowId: flowState?.flowId,
      stepId: flowState?.stepId
    });
    return { ok: true, action: "agent" };
  }

  // FLOW LOGIC
  if (flowState?.stepId) {
    const currentStep = steps.find((s: any) => s.id === flowState.stepId);
    if (!currentStep) return { ok: false, action: "error", error: "Step lost" };

    if (currentStep.step_key === 'options') {
      const payload = (currentStep.payload as any) || {};
      const options = (payload.options as any[]) || [];
      const option = options.find((o: any) => o.value === messageBody.trim() || o.label.toLowerCase().includes(normalizedInput));
      
      if (option) {
        const next = steps.find((s: any) => s.id === option.nextStepId);
        if (next) return await processStep(conv, next, steps);
      } else {
          return await processStep(conv, currentStep, steps);
      }
    }
    
    const nextIdx = steps.findIndex(s => s.id === currentStep.id) + 1;
    if (nextIdx < steps.length) {
        return await processStep(conv, steps[nextIdx], steps);
    }
    return { ok: true, action: "menu" };
  } else {
    // START
    return await processStep(conv, steps[0], steps);
  }
}
