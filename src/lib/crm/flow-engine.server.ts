import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsApp } from "./uazapi.server"; // Mocked location or adapted logic
import { ensureDefaultWhatsAppFlow } from "./bootstrap.server";

// We need processStep, but it must be exported or called here.
// Let's keep existing imports and adjust.

async function sendWhatsAppWrapper(phone: string, text: string, options: any = {}) {
    const { getActiveWhatsAppProvider } = await import("../otp.functions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin.from("crm_conversations").select("id, establishment_id").eq("customer_phone", phone).maybeSingle();

    const active = await getActiveWhatsAppProvider(conv?.establishment_id);
    if (active) {
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
    await supabaseAdmin.from("crm_conversations").update({ metadata }).eq("id", convId);
}

export async function processStep(conv: any, step: any, allSteps: any[]) {
  if (!step) return;
  const payload = (step.payload as any) || {};
  const type = payload.type || step.step_key;

  switch (type) {
    case 'message':
    case 'question':
      await sendWhatsAppWrapper(conv.customer_phone, payload.text || "Sem conteúdo");
      await updateFlowState(conv.id, step.flow_id, step.id);
      break;
    case 'options':
      await sendWhatsAppWrapper(conv.customer_phone, payload.text || "Escolha uma opção:", { type: 'options', options: payload.options || [] });
      await updateFlowState(conv.id, step.flow_id, step.id);
      break;
    case 'transfer_to_queue':
      await sendWhatsAppWrapper(conv.customer_phone, payload.text || "Transferindo para um atendente...");
      await supabaseAdmin.from("crm_conversations").update({ status: 'waiting', assigned_to: null }).eq("id", conv.id);
      await updateFlowState(conv.id, null, null, { mode: 'manual' });
      break;
    case 'agent':
      await sendWhatsAppWrapper(conv.customer_phone, "Perfeito! Conte um pouco mais sobre o que você precisa. 💜");
      await updateFlowState(conv.id, step.flow_id, step.id, { mode: 'agent' });
      break;
  }
}

export async function executeFlow(conversationId: string, messageBody: string) {
  const { data: conv } = await (supabaseAdmin as any)
    .from("crm_conversations")
    .select("*, metadata, establishment_id")
    .eq("id", conversationId)
    .single();

  if (!conv || conv.status !== 'bot') return;

  const { data: agentConfigRow } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("namespace", "crm")
    .eq("key", "agent_config")
    .maybeSingle();
  
  const agentConfig = (agentConfigRow?.value as any) || {};
  if (!agentConfig.enabled) return;

  // Global Commands
  const normalizedInput = messageBody.trim().toLowerCase();
  const humanKeywords = ['atendente', 'humano', 'suporte', 'falar com alguém', 'reclamação'];
  const menuKeywords = ['menu', 'voltar', 'início', 'inicio', 'opções', 'opcoes'];

  if (humanKeywords.some(k => normalizedInput.includes(k))) {
    await sendWhatsAppWrapper(conv.customer_phone, "Entendido. Vou encaminhar você para nossa equipe. Aguarde um momento. 💜");
    await supabaseAdmin.from("crm_conversations").update({ status: 'waiting', assigned_to: null }).eq("id", conv.id);
    await updateFlowState(conv.id, null, null, { mode: 'manual' });
    return;
  }

  if (menuKeywords.some(k => normalizedInput === k)) {
    const mainFlowId = agentConfig?.behavior?.mainFlowId;
    if (mainFlowId) {
        // Force restart flow
        const { data: flow } = await supabaseAdmin.from("crm_flows").select("*, steps:crm_flow_steps(*)").eq("id", mainFlowId).single();
        const steps = (flow.steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
        await updateFlowState(conv.id, mainFlowId, null, { mode: 'flow' });
        await processStep(conv, steps[0], steps);
        return;
    }
  }

  // Flow Processing
  const flowState = (conv.metadata as any)?.flow_state;
  
  // Agent Logic
  if (flowState?.mode === 'agent' && conv.status === 'bot') {
    const { processAgentMessage } = await import("./agent-engine.server");
    await processAgentMessage({
      conversationId: conv.id,
      customerPhone: conv.customer_phone,
      inboundText: messageBody,
      flowId: flowState?.flowId,
      stepId: flowState?.stepId
    });
    return;
  }

  // New Flow Logic
  let flowId = flowState?.flowId || agentConfig?.behavior?.mainFlowId;
  const { data: flow } = await supabaseAdmin.from("crm_flows").select("*, steps:crm_flow_steps(*)").eq("id", flowId).single();
  if (!flow) return;

  const steps = (flow.steps || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  
  if (flowState?.stepId) {
    const currentIdx = steps.findIndex((s: any) => s.id === flowState.stepId);
    const currentStep = steps[currentIdx];
    
    // Handle Option Response
    if (currentStep.step_key === 'options') {
      const option = currentStep.payload.options?.find((o: any) => o.value === messageBody.trim());
      if (option) {
        const next = steps.find((s: any) => s.id === option.nextStepId);
        if (next) return await processStep(conv, next, steps);
      }
    }
    
    // Auto advance if not options
    if (currentIdx + 1 < steps.length) {
       return await processStep(conv, steps[currentIdx + 1], steps);
    }
  } else {
    // Start flow
    await processStep(conv, steps[0], steps);
  }
}
