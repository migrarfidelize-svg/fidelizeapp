import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FLOW_NAME = "Atendimento WhatsApp";
const STEP_KEYS = ["welcome", "main_menu", "agent_loyalty", "agent_promotions", "agent_access", "agent_general", "human_handoff"] as const;

export async function ensureDefaultWhatsAppFlow(establishmentId: string) {
  if (!establishmentId) throw new Error("CRM_ESTABLISHMENT_REQUIRED");

  // 1. Ensure Flow first to get flow_id
  let { data: flow, error: flowError } = await (supabaseAdmin as any)
    .from("crm_flows").select("id").eq("establishment_id", establishmentId).eq("name", FLOW_NAME).maybeSingle();
  if (flowError) throw flowError;

  let created = false;
  if (!flow) {
    const result = await (supabaseAdmin as any).from("crm_flows").insert({
      establishment_id: establishmentId,
      name: FLOW_NAME,
      description: "Atendimento principal WhatsApp com menu, Agent e transferência humana.",
      is_active: true,
    }).select("id").single();
    if (result.error || !result.data) throw result.error ?? new Error("CRM_FLOW_CREATE_FAILED");
    flow = result.data as any;
    created = true;
  }

  // 2. Ensure Agent Settings (Requirement 1 & 2)
  await ensureDefaultAgentSettings(establishmentId, (flow as any).id);

  const { data: existingRows, error: stepsError } = await (supabaseAdmin as any)
    .from("crm_flow_steps").select("id, step_key, payload, sort_order").eq("flow_id", (flow as any).id).eq("establishment_id", establishmentId);
  if (stepsError) throw stepsError;
  const existing = existingRows ?? [];
  const byKey = new Map(existing.map((step: any) => [step.step_key, step]));
  const ids = Object.fromEntries(STEP_KEYS.map((key) => [key, (byKey.get(key) as any)?.id ?? crypto.randomUUID()])) as Record<typeof STEP_KEYS[number], string>;
  
  const menuText = "Olá! 👋 Como posso ajudar?\n\n1 — Cartão e recompensas\n2 — Promoções\n3 — Acesso à conta\n4 — Dúvidas\n5 — Falar com suporte";
  
  const definitions = [
    { step_key: "welcome", sort_order: 0, payload: { type: "message", text: "Olá! 👋 Como posso ajudar?" } },
    { step_key: "main_menu", sort_order: 1, payload: { type: "options", text: menuText, options: [
      { label: "1 — Cartão e recompensas", value: "1", nextStepId: ids.agent_loyalty },
      { label: "2 — Promoções", value: "2", nextStepId: ids.agent_promotions },
      { label: "3 — Acesso à conta", value: "3", nextStepId: ids.agent_access },
      { label: "4 — Dúvidas", value: "4", nextStepId: ids.agent_general },
      { label: "5 — Falar com suporte", value: "5", nextStepId: ids.human_handoff },
    ] } },
    { step_key: "agent_loyalty", sort_order: 2, payload: { type: "agent", context: "Cartão fidelidade e recompensas." } },
    { step_key: "agent_promotions", sort_order: 3, payload: { type: "agent", context: "Promoções do estabelecimento." } },
    { step_key: "agent_access", sort_order: 4, payload: { type: "agent", context: "Acesso à conta." } },
    { step_key: "agent_general", sort_order: 5, payload: { type: "agent", context: "Dúvidas gerais." } },
    { step_key: "human_handoff", sort_order: 6, payload: { type: "transfer_to_queue", text: "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜" } },
  ];

  for (const definition of definitions) {
    const current = byKey.get(definition.step_key) as any;
    let payload = definition.payload;
    if (current?.payload && typeof current.payload === "object") {
      payload = current.payload as any;
      if (definition.step_key === "main_menu") {
        const desired = (definition.payload as any).options;
        const configured = Array.isArray((current.payload as any).options) ? (current.payload as any).options : [];
        const knownStepIds = new Set(Object.values(ids));
        payload = { ...(definition.payload as any), ...(current.payload as any), options: desired.map((option: any) => {
          const saved = configured.find((item: any) => item.value === option.value) || {};
          return {
            ...option,
            ...saved,
            // Preserva destinos personalizados válidos e repara somente links
            // quebrados por remoção/migração de steps.
            nextStepId: knownStepIds.has(saved.nextStepId) ? saved.nextStepId : option.nextStepId,
          };
        }) } as any;
      }
    }
    const row = { ...definition, payload, id: ids[definition.step_key as keyof typeof ids], flow_id: (flow as any).id, establishment_id: establishmentId };
    const result = current
      ? await (supabaseAdmin as any).from("crm_flow_steps").update({ payload: row.payload, sort_order: row.sort_order }).eq("id", current.id).eq("establishment_id", establishmentId)
      : await (supabaseAdmin as any).from("crm_flow_steps").insert(row);
    if (result.error) throw result.error;
  }

  return { flowId: (flow as any).id, created, stepsCount: definitions.length };
}

export async function ensureDefaultAgentSettings(establishmentId: string, flowId: string) {
  const { data: existing, error } = await (supabaseAdmin as any)
    .from("crm_agent_settings")
    .select("*")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) throw error;

  const defaults = {
    name: "Assistente Fidelize",
    systemPrompt: "Você é o Assistente Fidelize do estabelecimento. Atenda de forma objetiva, educada e útil. Utilize apenas informações disponíveis no contexto e no sistema. Não invente dados, saldo, promoções, regras ou informações do cliente. Quando não puder resolver com segurança, quando o cliente solicitar uma pessoa ou quando houver necessidade de ação humana, encaminhe para SUPORTE.",
    presentation: "Olá! 👋 Sou o assistente virtual. Como posso ajudar?",
    handoff: {
      keywords: [
        "suporte",
        "atendente",
        "humano",
        "falar com atendente",
        "falar com suporte",
        "quero falar com alguém",
        "preciso de ajuda humana"
      ],
      message: "Entendi. Vou encaminhar você para nossa equipe de suporte. 💜"
    },
    fallback: {
      message: "Não consegui resolver sua solicitação com segurança. Posso encaminhar você para o suporte.",
      maxFailures: 3,
      action: "transfer_to_queue"
    },
    behavior: {
      autoReply: true,
      welcomeNew: true,
      welcomeKnown: true,
      afterHuman: "stay_closed",
      timeoutMinutes: 10,
      timeoutAction: "transfer_to_queue",
      mainFlowId: flowId
    }
  };

  if (!existing) {
    const { error: insertError } = await (supabaseAdmin as any)
      .from("crm_agent_settings")
      .insert({
        establishment_id: establishmentId,
        flow_id: flowId,
        enabled: true,
        config: defaults
      });
    if (insertError) throw insertError;
  } else {
    const currentConfig = ((existing as any).config as any) || {};
    const updatedConfig = { ...defaults, ...currentConfig };
    
    updatedConfig.handoff = { ...defaults.handoff, ...(currentConfig.handoff || {}) };
    updatedConfig.fallback = { ...defaults.fallback, ...(currentConfig.fallback || {}) };
    updatedConfig.behavior = { ...defaults.behavior, ...(currentConfig.behavior || {}) };

    // Requirement 1: Only use default flowId if the current one is missing
    const finalFlowId = (existing as any).flow_id || (existing as any).config?.behavior?.mainFlowId || flowId;

    const { error: updateError } = await (supabaseAdmin as any)
      .from("crm_agent_settings")
      .update({ 
        config: updatedConfig,
        flow_id: finalFlowId 
      })
      .eq("establishment_id", establishmentId);
    if (updateError) throw updateError;
  }
}
