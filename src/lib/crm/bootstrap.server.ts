import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function ensureDefaultWhatsAppFlow() {
  const ESTABLISHMENT_ID = 'f406351f-487b-47db-b0d3-bd5cb918b6c3';
  const flowName = "Atendimento Inteligente Fidelize";

  console.log(`[CRM Bootstrap] Starting for establishment ${ESTABLISHMENT_ID}...`);

  try {
    // 1. Get or Create Flow
    let { data: flow, error: findErr } = await supabaseAdmin
      .from("crm_flows")
      .select("id")
      .eq("establishment_id", ESTABLISHMENT_ID)
      .eq("name", flowName)
      .maybeSingle();

    if (findErr) {
      console.error("[CRM Bootstrap] Error finding flow:", findErr);
      throw findErr;
    }

    if (!flow) {
      console.log("[CRM Bootstrap] Creating flow...");
      const { data: newFlow, error: flowErr } = await supabaseAdmin
        .from("crm_flows")
        .insert({
          name: flowName,
          description: "Atendimento principal WhatsApp com menu, IA e transferência humana.",
          is_active: true,
          establishment_id: ESTABLISHMENT_ID
        })
        .select("id")
        .single();
      
      if (flowErr) throw flowErr;
      flow = newFlow;
    }
    
    if (!flow) throw new Error("Flow could not be found or created");
    const flowId = flow.id;

    // 2. Sync steps (Idempotent)
    const { data: existingSteps, error: stepsErr } = await supabaseAdmin
      .from("crm_flow_steps")
      .select("id, sort_order")
      .eq("flow_id", flowId);

    if (stepsErr) throw stepsErr;

    const stepsCount = existingSteps?.length || 0;
    if (stepsCount === 0) {
      console.log("[CRM Bootstrap] Creating 7 steps...");
      const stepIds = {
        step0: crypto.randomUUID(), step1: crypto.randomUUID(), step2: crypto.randomUUID(),
        step3: crypto.randomUUID(), step4: crypto.randomUUID(), step5: crypto.randomUUID(), step6: crypto.randomUUID()
      };

      const steps = [
        { id: stepIds.step0, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "message", sort_order: 0, payload: { type: "message", text: "Olá, {{nome}}! 👋\n\nBem-vindo ao atendimento Fidelize. 💜\n\nEstou aqui para ajudar.\n\nEscolha uma das opções abaixo para começarmos:" } },
        { id: stepIds.step1, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "options", sort_order: 1, payload: { type: "options", text: "Como podemos ajudar você hoje?", options: [
            { label: "1 — 💜 Cartão, pontos e recompensas", value: "1", nextStepId: stepIds.step2 },
            { label: "2 — 🎁 Promoções e benefícios", value: "2", nextStepId: stepIds.step3 },
            { label: "3 — 🔐 Problemas com acesso ou carteira", value: "3", nextStepId: stepIds.step4 },
            { label: "4 — 💬 Tenho uma dúvida", value: "4", nextStepId: stepIds.step5 },
            { label: "5 — 👨‍💼 Falar com atendente", value: "5", nextStepId: stepIds.step6 }
        ] } },
        { id: stepIds.step2, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent", sort_order: 2, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "O cliente selecionou atendimento relacionado a cartão fidelidade, pontos, carimbos, recompensas e carteira Fidelize." } },
        { id: stepIds.step3, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent", sort_order: 3, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "O cliente quer informações sobre promoções, benefícios, produtos, serviços ou vantagens disponíveis." } },
        { id: stepIds.step4, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent", sort_order: 4, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "O cliente está com dificuldade relacionada a login, acesso, carteira digital ou utilização da conta." } },
        { id: stepIds.step5, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent", sort_order: 5, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "Atendimento geral." } },
        { id: stepIds.step6, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "transfer_to_queue", sort_order: 6, payload: { type: "transfer_to_queue", text: "Claro! Vou encaminhar você para nossa equipe. Aguarde um momento. 💜" } }
      ];

      const { error: insertErr } = await supabaseAdmin.from("crm_flow_steps").insert(steps);
      if (insertErr) throw insertErr;
    } else if (stepsCount < 7) {
      console.warn(`[CRM Bootstrap] Inconsistency: Flow has ${stepsCount} steps instead of 7.`);
    }

    // 3. Update Agent Config (mainFlowId)
    const { data: agentConfigRow } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "crm")
      .eq("key", "agent_config")
      .maybeSingle();
    
    const currentConfig = (agentConfigRow?.value as any) || {};
    const newConfig = {
      ...currentConfig,
      enabled: currentConfig.enabled ?? true,
      name: currentConfig.name || "Assistente Fidelize",
      behavior: {
        ...(currentConfig.behavior || {}),
        mainFlowId: flowId
      }
    };

    await supabaseAdmin
      .from("system_settings")
      .upsert({
        namespace: "crm",
        key: "agent_config",
        value: newConfig as any
      }, { onConflict: "namespace,key" });

    console.log("[CRM Bootstrap] Success.");
    return { flowId, created: !flow, stepsCount: stepsCount === 0 ? 7 : stepsCount };
  } catch (error) {
    console.error("[CRM Bootstrap] Critical Failure:", error);
    throw error;
  }
}
