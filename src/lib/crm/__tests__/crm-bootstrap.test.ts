import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureDefaultWhatsAppFlow } from "../bootstrap.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));

type Row = Record<string, any>;
const db: Record<string, Row[]> = {};
class Query {
  filters: Array<[string, unknown]> = [];
  operation: "select" | "insert" | "update" = "select";
  value: any;
  constructor(private table: string) {}
  select() { return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  insert(value: any) { this.operation = "insert"; this.value = value; return this; }
  update(value: any) { this.operation = "update"; this.value = value; return this; }
  rows() { return (db[this.table] ||= []).filter((row) => this.filters.every(([key, value]) => row[key] === value)); }
  result() {
    if (this.operation === "insert") {
      const values = (Array.isArray(this.value) ? this.value : [this.value]).map((row) => ({ id: row.id || `${this.table}-${db[this.table].length + 1}`, ...row }));
      db[this.table].push(...values); return { data: values, error: null };
    }
    if (this.operation === "update") this.rows().forEach((row) => Object.assign(row, this.value));
    return { data: this.rows(), error: null };
  }
  maybeSingle() { const result = this.result(); return Promise.resolve({ data: result.data[0] || null, error: null }); }
  single() { const result = this.result(); return Promise.resolve({ data: result.data[0] || null, error: null }); }
  then(resolve: (value: any) => unknown) { return Promise.resolve(this.result()).then(resolve); }
}

describe("CRM bootstrap multi-tenant", () => {
  beforeEach(() => {
    for (const key of Object.keys(db)) delete db[key];
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => new Query(table) as any);
  });

  it("1. cria o fluxo e sete steps para tenant A", async () => {
    const result = await ensureDefaultWhatsAppFlow("tenant-a");
    expect(result.stepsCount).toBe(7);
    expect(db.crm_flow_steps).toHaveLength(7);
    expect(db.crm_flow_steps.every((row) => row.establishment_id === "tenant-a")).toBe(true);
  });

  it("2. cria configuração independente para tenant B", async () => {
    const a = await ensureDefaultWhatsAppFlow("tenant-a");
    const b = await ensureDefaultWhatsAppFlow("tenant-b");
    expect(a.flowId).not.toBe(b.flowId);
    expect(db.crm_agent_settings.map((row) => row.establishment_id).sort()).toEqual(["tenant-a", "tenant-b"]);
  });

  it("3. repetição não duplica flow, steps ou configuração", async () => {
    await ensureDefaultWhatsAppFlow("tenant-a");
    await ensureDefaultWhatsAppFlow("tenant-a");
    expect(db.crm_flows).toHaveLength(1);
    expect(db.crm_flow_steps).toHaveLength(7);
    expect(db.crm_agent_settings).toHaveLength(1);
  });

  it("4. repara tenant parcialmente configurado", async () => {
    db.crm_flows = [{ id: "flow-a", establishment_id: "tenant-a", name: "Atendimento WhatsApp", is_active: true }];
    db.crm_flow_steps = [{ id: "welcome-a", flow_id: "flow-a", establishment_id: "tenant-a", step_key: "welcome", payload: {}, sort_order: 99 }];
    await ensureDefaultWhatsAppFlow("tenant-a");
    expect(db.crm_flow_steps).toHaveLength(7);
    expect(db.crm_flow_steps.find((row) => row.step_key === "welcome")?.sort_order).toBe(0);
  });

  it("5. repara referências do menu sem duplicar steps", async () => {
    await ensureDefaultWhatsAppFlow("tenant-a");
    const menu = db.crm_flow_steps.find((row) => row.step_key === "main_menu")!;
    menu.payload.options[0].nextStepId = "broken";
    await ensureDefaultWhatsAppFlow("tenant-a");
    expect(menu.payload.options[0].nextStepId).toBe(db.crm_flow_steps.find((row) => row.step_key === "agent_loyalty")?.id);
    expect(db.crm_flow_steps).toHaveLength(7);
  });

  it("6. exige establishment real", async () => {
    await expect(ensureDefaultWhatsAppFlow("")).rejects.toThrow("CRM_ESTABLISHMENT_REQUIRED");
  });

  it("7. cria Agent padrão em standby sem provider e vinculado ao fluxo", async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await ensureDefaultWhatsAppFlow("tenant-a");
    expect(db.crm_agent_settings[0]).toMatchObject({ establishment_id: "tenant-a", flow_id: result.flowId, enabled: false });
    expect(db.crm_agent_settings[0].config).toMatchObject({ name: "Assistente Fidelize", providerPending: true });
    expect(db.crm_agent_settings[0].config.handoff.keywords).toContain("falar com suporte");
  });

  it("8. bootstrap repetido preserva configuração personalizada", async () => {
    await ensureDefaultWhatsAppFlow("tenant-a");
    db.crm_agent_settings[0].config.name = "Agente personalizado";
    db.crm_agent_settings[0].config.systemPrompt = "Prompt próprio";
    await ensureDefaultWhatsAppFlow("tenant-a");
    expect(db.crm_agent_settings[0].config.name).toBe("Agente personalizado");
    expect(db.crm_agent_settings[0].config.systemPrompt).toBe("Prompt próprio");
  });

  it("9. fluxo persistido contém menu 1–5 e handoff", async () => {
    await ensureDefaultWhatsAppFlow("tenant-a");
    const menu = db.crm_flow_steps.find((row) => row.step_key === "main_menu");
    expect(menu.payload.options.map((option: any) => option.value)).toEqual(["1", "2", "3", "4", "5"]);
    const handoff = db.crm_flow_steps.find((row) => row.step_key === "human_handoff");
    expect(menu.payload.options[4].nextStepId).toBe(handoff.id);
    expect(handoff.payload.type).toBe("transfer_to_queue");
  });
});
