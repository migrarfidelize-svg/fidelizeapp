import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FLOW_NAME = "Atendimento WhatsApp";
const STEP_KEYS = ["welcome", "main_menu", "agent_loyalty", "agent_promotions", "agent_access", "agent_general", "human_handoff"] as const;

export async function ensureDefaultWhatsAppFlow(establishmentId: string) {
  if (!establishmentId) throw new Error("CRM_ESTABLISHMENT_REQUIRED");

  let { data: flow, error: flowError } = await supabaseAdmin
    .from("crm_flows").select("id").eq("establishment_id", establishmentId).eq("name", FLOW_NAME).maybeSingle();
  if (flowError) throw flowError;

  let created = false;
  if (!flow) {
    const result = await supabaseAdmin.from("crm_flows").insert({
      establishment_id: establishmentId,
      name: FLOW_NAME,
      description: "Atendimento principal WhatsApp com menu, Agent e transferência humana.",
      is_active: true,
    }).select("id").single();
    if (result.error || !result.data) throw result.error ?? new Error("CRM_FLOW_CREATE_FAILED");
    flow = result.data;
    created = true;
  }

  const { data: existingRows, error: stepsError } = await supabaseAdmin
    .from("crm_flow_steps").select("id, step_key, payload, sort_order").eq("flow_id", flow.id).eq("establishment_id", establishmentId);
  if (stepsError) throw stepsError;
  const existing = existingRows ?? [];
  const byKey = new Map(existing.map((step) => [step.step_key, step]));
  const ids = Object.fromEntries(STEP_KEYS.map((key) => [key, byKey.get(key)?.id ?? crypto.randomUUID()])) as Record<typeof STEP_KEYS[number], string>;
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
    const current = byKey.get(definition.step_key);
    let payload = definition.payload;
    if (current?.payload && typeof current.payload === "object") {
      payload = current.payload as typeof definition.payload;
      if (definition.step_key === "main_menu") {
        const desired = (definition.payload as any).options;
        const configured = Array.isArray((current.payload as any).options) ? (current.payload as any).options : [];
        payload = { ...(definition.payload as any), ...(current.payload as any), options: desired.map((option: any) => ({
          ...option, ...(configured.find((item: any) => item.value === option.value) || {}), nextStepId: option.nextStepId,
        })) } as typeof definition.payload;
      }
    }
    const row = { ...definition, payload, id: ids[definition.step_key as keyof typeof ids], flow_id: flow.id, establishment_id: establishmentId };
    const result = current
      ? await supabaseAdmin.from("crm_flow_steps").update({ payload: row.payload, sort_order: row.sort_order }).eq("id", current.id).eq("establishment_id", establishmentId)
      : await supabaseAdmin.from("crm_flow_steps").insert(row);
    if (result.error) throw result.error;
  }

  const currentConfig = await supabaseAdmin.from("crm_agent_settings").select("establishment_id")
    .eq("establishment_id", establishmentId).maybeSingle();
  if (currentConfig.error) throw currentConfig.error;
  if (!currentConfig.data) {
    const configInsert = await supabaseAdmin.from("crm_agent_settings").insert({ establishment_id: establishmentId, flow_id: flow.id });
    if (configInsert.error) throw configInsert.error;
  }
  return { flowId: flow.id, created, stepsCount: definitions.length };
}
