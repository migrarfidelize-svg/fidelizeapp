import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function executeFlow(conversationId: string, messageBody: string) {
  const { data: conv } = await supabaseAdmin
    .from("crm_conversations")
    .select("*, metadata")
    .eq("id", conversationId)
    .single();

  if (!conv) return;
  // Bot para se a conversa estiver atribuída a um humano
  if (conv.status === 'assigned') return;

  const flowState = (conv.metadata as any)?.flow_state;
  let currentFlowId = flowState?.flowId;
  let currentStepId = flowState?.stepId;

  if (!currentFlowId) {
    const { data: agentConfig } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "crm")
      .eq("key", "agent_config")
      .maybeSingle();
    
    currentFlowId = (agentConfig?.value as any)?.behavior?.mainFlowId;
    if (!currentFlowId) return;
  }

  const { data: flow } = await supabaseAdmin
    .from("crm_flows")
    .select("*, steps:crm_flow_steps(*)")
    .eq("id", currentFlowId)
    .single();

  if (!flow || !flow.is_active) return;

  const steps = (flow.steps || []).sort((a: any, b: any) => (a.order_index ?? a.sort_order) - (b.order_index ?? b.sort_order));
  
  if (currentStepId) {
    const lastStep = steps.find((s: any) => s.id === currentStepId);
    // Mapeamos payload para as chaves que a engine espera ou usamos diretamente
    const stepPayload = (lastStep?.payload as any) || {};
    const stepType = stepPayload.type || lastStep?.step_key;

    if (stepType === 'options') {
      const option = stepPayload.options?.find((o: any) => o.value === messageBody.trim());
      if (option) {
        const next = steps.find((s: any) => s.id === option.nextStepId);
        if (next) return await processStep(conv, next, steps);
      }
    }
  }

  const initialStep = currentStepId ? steps.find((s: any) => s.id === currentStepId) : steps[0];
  await processStep(conv, initialStep, steps);
}

async function processStep(conv: any, step: any, allSteps: any[]) {
  if (!step) return;
  
  const payload = (step.payload as any) || {};
  const type = payload.type || step.step_key;

  switch (type) {
    case 'message':
    case 'question':
    case 'options':
      await sendWhatsApp(conv.customer_phone, payload.text || "Sem conteúdo");
      await updateFlowState(conv.id, step.flow_id, step.id);
      break;

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
  }
}

async function sendWhatsApp(phone: string, text: string) {
  const { getActiveWhatsAppProvider } = await import("../otp.functions");
  const active = await getActiveWhatsAppProvider();
  if (active) {
    await active.provider.sendTestMessage(active.runtime, process.env as any, phone, text);
  }
}

async function updateFlowState(convId: string, flowId: string | null, stepId: string | null) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conv } = await supabaseAdmin.from("crm_conversations").select("metadata").eq("id", convId).single();
    const metadata = (conv?.metadata as any) || {};
    metadata.flow_state = { flowId, stepId };
    
    await supabaseAdmin
      .from("crm_conversations")
      .update({ metadata })
      .eq("id", convId);
}
