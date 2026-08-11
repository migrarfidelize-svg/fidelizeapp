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

function getStepType(step: any) {
    return step?.payload?.type || step?.step_key;
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
    metadata.flow_state = { ...metadata.flow_state, flowId, stepId, ...extra };
    await supabaseAdmin.from("crm_conversations").update({ metadata }).eq("id", convId);
}

export type FlowActionResult = { ok: boolean; action: string; error?: any; };

export async function processStep(conv: any, step: any, allSteps: any[]): Promise<FlowActionResult> {
  if (!step) return { ok: false, action: "error", error: "Step is null" };
  const type = getStepType(step);
  const payload = step.payload as any;

  try {
    switch (type) {
      case 'message':
        await sendWhatsAppWrapper(conv, payload?.text || "");
        await updateFlowState(conv.id, step.flow_id, step.id);
        const next = allSteps.find(s => s.sort_order === (step.sort_order + 1));
        return next ? await processStep(conv, next, allSteps) : { ok: true, action: "end" };

      case 'options':
        await sendWhatsAppWrapper(conv, payload?.text || "Escolha:", { type: 'options', options: payload?.options || [] });
        await updateFlowState(conv.id, step.flow_id, step.id);
        return { ok: true, action: "menu" };

      case 'transfer_to_queue':
        await sendWhatsAppWrapper(conv, payload?.text || "Transferindo...");
        await supabaseAdmin.from("crm_conversations").update({ 
          status: 'waiting', 
          assigned_to: null, 
          updated_at: new Date().toISOString() 
        }).eq("id", conv.id);
        await updateFlowState(conv.id, null, null, { mode: 'manual' });
        return { ok: true, action: "handoff" };

      case 'agent':
        await sendWhatsAppWrapper(conv, "Perfeito! Conte o que precisa. 💜");
        await updateFlowState(conv.id, step.flow_id, step.id, { mode: 'agent' });
        return { ok: true, action: "agent" };

      default:
        return { ok: true, action: "end" };
    }
  } catch (err) {
    return { ok: false, action: "error", error: err };
  }
}

export async function executeFlow(conversationId: string, messageBody: string): Promise<FlowActionResult> {
  const { data: conv } = await supabaseAdmin.from("crm_conversations").select("*").eq("id", conversationId).single();
  if (!conv || conv.status !== 'bot') return { ok: true, action: "ignored" };

  const agentConfig = await getAgentConfig();
  const input = messageBody.trim().toLowerCase();

  if (['atendente', 'humano', 'suporte'].some(k => input.includes(k))) {
      await sendWhatsAppWrapper(conv, "Transferindo para equipe...");
      await supabaseAdmin.from("crm_conversations").update({ status: 'waiting' }).eq("id", conv.id);
      await updateFlowState(conv.id, null, null, { mode: 'manual' });
      return { ok: true, action: "handoff" };
  }

  let flowId = (conv.metadata as any)?.flow_state?.flowId || agentConfig?.behavior?.mainFlowId;
  const { data: flow } = await supabaseAdmin.from("crm_flows").select("*, steps:crm_flow_steps!crm_flow_steps_flow_id_fkey(*)").eq("id", flowId).single();
  const steps = (flow?.steps || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const state = (conv.metadata as any)?.flow_state;

  if (['menu', 'voltar'].some(k => input === k)) {
      const menuStep = steps.find(s => getStepType(s) === 'options');
      if (menuStep) return await processStep(conv, menuStep, steps);
  }

  if (state?.mode === 'agent') {
    const { processAgentMessage } = await import("./agent-engine.server");
    await processAgentMessage({ 
      conversationId, 
      customerPhone: conv.customer_phone, 
      inboundText: messageBody, 
      flowId: state.flowId, 
      stepId: state.stepId 
    });
    return { ok: true, action: "agent" };
  }

  if (state?.stepId) {
    const current = steps.find((s: any) => s.id === state.stepId);
    if (current && getStepType(current) === 'options') {
      const payload = current.payload as any;
      const opt = (payload?.options || []).find((o: any) => o.value === input);
      if (opt) return await processStep(conv, steps.find(s => s.id === opt.nextStepId), steps);
    }
  }
  
  return await processStep(conv, steps[0], steps);
}
