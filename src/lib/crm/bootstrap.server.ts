import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function ensureDefaultWhatsAppFlow() {
  const ESTABLISHMENT_ID = 'f406351f-487b-47db-b0d3-bd5cb918b6c3';
  const flowName = "Atendimento Inteligente Fidelize";

  console.log(`[CRM Bootstrap] Starting for establishment ${ESTABLISHMENT_ID}...`);

  try {
    let { data: flow, error: findErr } = await supabaseAdmin
      .from("crm_flows")
      .select("id")
      .eq("establishment_id", ESTABLISHMENT_ID)
      .eq("name", flowName)
      .maybeSingle();

    if (findErr) throw findErr;

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

    const { data: existingSteps, error: stepsErr } = await supabaseAdmin
      .from("crm_flow_steps")
      .select("id, step_key")
      .eq("flow_id", flowId);

    if (stepsErr) throw stepsErr;

    const stepsCount = existingSteps?.length || 0;
    
    if (stepsCount === 0) {
      console.log("[CRM Bootstrap] Creating 7 steps with unique keys...");
      const stepIds = {
        s0: crypto.randomUUID(), s1: crypto.randomUUID(), s2: crypto.randomUUID(),
        s3: crypto.randomUUID(), s4: crypto.randomUUID(), s5: crypto.randomUUID(), s6: crypto.randomUUID()
      };

      const steps = [
        { id: stepIds.s0, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "welcome", sort_order: 0, payload: { type: "message", text: "Olá! Bem-vindo à Fidelize. 💜\n\nComo posso ajudar hoje?" } },
        { id: stepIds.s1, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "main_menu", sort_order: 1, payload: { type: "options", text: "Menu Principal:", options: [
            { label: "1 — Cartão e Recompensas", value: "1", nextStepId: stepIds.s2 },
            { label: "2 — Promoções", value: "2", nextStepId: stepIds.s3 },
            { label: "3 — Acesso à conta", value: "3", nextStepId: stepIds.s4 },
            { label: "4 — Dúvidas", value: "4", nextStepId: stepIds.s5 },
            { label: "5 — Falar com atendente", value: "5", nextStepId: stepIds.s6 }
        ] } },
        { id: stepIds.s2, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent_loyalty", sort_order: 2, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "Atendimento sobre cartão e recompensas." } },
        { id: stepIds.s3, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent_promotions", sort_order: 3, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "Atendimento sobre promoções." } },
        { id: stepIds.s4, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent_access", sort_order: 4, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "Atendimento sobre problemas de acesso." } },
        { id: stepIds.s5, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "agent_general", sort_order: 5, payload: { type: "agent", text: "Entrando em contato com nosso assistente...", context: "Atendimento geral." } },
        { id: stepIds.s6, flow_id: flowId, establishment_id: ESTABLISHMENT_ID, step_key: "human_handoff", sort_order: 6, payload: { type: "transfer_to_queue", text: "Vou encaminhar você para nossa equipe. Aguarde um momento. 💜" } }
      ];

      const { error: insertErr } = await supabaseAdmin.from("crm_flow_steps").insert(steps);
      if (insertErr) {
          console.error("[CRM Bootstrap] insert steps failed:", insertErr);
          throw insertErr;
      }
    } else if (stepsCount > 0 && stepsCount !== 7) {
      throw new Error(`CRM_DEFAULT_FLOW_PARTIAL:${stepsCount}`);
    }

    const { data: agentConfigRow } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("namespace", "crm")
      .eq("key", "agent_config")
      .maybeSingle();
    
    const currentConfig = (agentConfigRow?.value as any) || {};
    
    const { data: integration } = await supabaseAdmin
        .from("integrations")
        .select("id, provider")
        .eq("enabled", true)
        .eq("category", "ai")
        .maybeSingle();

    const newConfig = {
      ...currentConfig,
      enabled: currentConfig.enabled ?? (!!integration),
      name: currentConfig.name || "Assistente Fidelize",
      provider_id: currentConfig.provider_id || (integration?.provider || "openai"),
      model: currentConfig.model || "gpt-4o-mini",
      behavior: {
        ...(currentConfig.behavior || {}),
        mainFlowId: flowId
      }
    };

    await supabaseAdmin
      .from("system_settings")
      .upsert({ namespace: "crm", key: "agent_config", value: newConfig as any }, { onConflict: "namespace,key" });

    return { flowId, created: !flow, stepsCount: stepsCount === 0 ? 7 : stepsCount };
  } catch (error) {
    console.error("[CRM Bootstrap] Critical Failure:", error);
    throw error;
  }
}
