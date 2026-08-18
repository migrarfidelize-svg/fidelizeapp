import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeFlow, processCRMTimeouts } from "../flow-engine.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveWhatsAppProvider } from "../../otp.functions";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("../../otp.functions", () => ({ getActiveWhatsAppProvider: vi.fn() }));
vi.mock("../agent-engine.server", () => ({ processAgentMessage: vi.fn().mockResolvedValue({ action: "replied" }) }));

const state: Record<string, any[]> = {};
class Q {
  filters: Array<[string, any]> = []; op = "select"; value: any;
  rangeStart?: number; rangeEnd?: number;
  constructor(private table: string) {}
  select() { return this; } eq(k: string, v: any) { this.filters.push([k, v]); return this; }
  in(k: string, v: any[]) { this.filters.push([k, v]); return this; }
  insert(v: any) { this.op = "insert"; this.value = v; return this; }
  update(v: any) { this.op = "update"; this.value = v; return this; }
  order() { return this; } limit() { return this; }
  range(start: number, end: number) { this.rangeStart = start; this.rangeEnd = end; return this; }
  rows() { const rows = (state[this.table] ||= []).filter((r) => this.filters.every(([k, v]) => Array.isArray(v) ? v.includes(r[k]) : r[k] === v)); return this.rangeStart === undefined ? rows : rows.slice(this.rangeStart, this.rangeEnd! + 1); }
  result() {
    if (this.op === "insert") { const row = { id: `${this.table}-${state[this.table].length + 1}`, ...this.value }; state[this.table].push(row); return { data: [row], error: null }; }
    if (this.op === "update") this.rows().forEach((r) => Object.assign(r, this.value));
    const data = this.rows().map((row) => this.table === "crm_flows" ? { ...row, steps: state.crm_flow_steps.filter((s) => s.flow_id === row.id) } : row);
    return { data, error: null };
  }
  single() { const r = this.result(); return Promise.resolve({ data: r.data[0], error: null }); }
  maybeSingle() { const r = this.result(); return Promise.resolve({ data: r.data[0] || null, error: null }); }
  then(fn: any) { return Promise.resolve(this.result()).then(fn); }
}

const steps = [
  { id: "welcome", flow_id: "flow-a", establishment_id: "tenant-a", step_key: "welcome", sort_order: 0, payload: { type: "message", text: "Olá" } },
  { id: "menu", flow_id: "flow-a", establishment_id: "tenant-a", step_key: "main_menu", sort_order: 1, payload: { type: "options", text: "1 a 5", options: [1,2,3,4].map((n) => ({ value: String(n), nextStepId: `agent-${n}` })).concat([{ value: "5", nextStepId: "handoff" }]) } },
  ...[1,2,3,4].map((n) => ({ id: `agent-${n}`, flow_id: "flow-a", establishment_id: "tenant-a", step_key: `agent-${n}`, sort_order: n + 1, payload: { type: "agent" } })),
  { id: "handoff", flow_id: "flow-a", establishment_id: "tenant-a", step_key: "human_handoff", sort_order: 6, payload: { type: "transfer_to_queue", text: "Suporte" } },
];

describe("CRM flow/handoff", () => {
  beforeEach(() => {
    Object.keys(state).forEach((key) => delete state[key]);
    state.crm_conversations = [{ id: "conv-a", establishment_id: "tenant-a", customer_phone: "5511", status: "bot", metadata: {} }];
    state.crm_agent_settings = [{ establishment_id: "tenant-a", flow_id: "flow-a", enabled: true, config: {} }];
    state.crm_flows = [{ id: "flow-a", establishment_id: "tenant-a", is_active: true }];
    state.crm_flow_steps = structuredClone(steps); state.crm_messages = []; state.crm_support_tickets = [];
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => new Q(table) as any);
    vi.mocked(getActiveWhatsAppProvider).mockResolvedValue({ establishmentId: "tenant-a", runtime: {}, provider: { meta: { id: "uazapi" }, sendTestMessage: vi.fn().mockResolvedValue({ ok: true, providerMessageId: crypto.randomUUID() }) } } as any);
  });

  it("7. primeira mensagem envia boas-vindas e menu", async () => { expect((await executeFlow("conv-a", "oi")).action).toBe("menu"); expect(state.crm_messages).toHaveLength(2); });
  for (const option of ["1", "2", "3", "4"]) it(`${7 + Number(option)}. opção ${option} entra no Agent correto`, async () => {
    state.crm_conversations[0].metadata = { flow_state: { flowId: "flow-a", stepId: "menu" } };
    expect((await executeFlow("conv-a", option)).action).toBe("agent");
    expect((state.crm_conversations[0].metadata as any).flow_state.stepId).toBe(`agent-${option}`);
  });
  it("12. opção 5 cria handoff SUPORTE", async () => { expect((await executeFlow("conv-a", "5")).action).toBe("handoff"); expect(state.crm_support_tickets).toHaveLength(1); expect((state.crm_conversations[0].metadata as any).support.active).toBe(true); });
  it("13. texto suporte cria handoff", async () => { expect((await executeFlow("conv-a", "preciso falar com suporte")).action).toBe("handoff"); });
  it("14. ticket de suporte não duplica", async () => { await executeFlow("conv-a", "suporte"); state.crm_conversations[0].status = "bot"; await executeFlow("conv-a", "atendente"); expect(state.crm_support_tickets).toHaveLength(1); });
  it("15. bot fica silencioso durante suporte", async () => { state.crm_conversations[0].status = "waiting"; expect((await executeFlow("conv-a", "oi")).action).toBe("ignored"); expect(state.crm_messages).toHaveLength(0); });
  it("16. flow do tenant B nunca é carregado", async () => { state.crm_flows.push({ id: "flow-b", establishment_id: "tenant-b", is_active: true }); await executeFlow("conv-a", "oi"); expect(state.crm_messages.every((m) => m.establishment_id === "tenant-a")).toBe(true); });

  it("processa timeout persistido somente depois do prazo e sem duplicar handoff", async () => {
    state.crm_conversations[0].metadata = { flow_state: { flowId: "flow-a", stepId: "menu", updatedAt: "2026-01-01T00:00:00Z" } };
    state.crm_agent_settings[0].config = { behavior: { timeoutMinutes: 10, timeoutAction: "transfer_to_queue" } };
    expect((await processCRMTimeouts(Date.parse("2026-01-01T00:09:00Z"))).processed).toBe(0);
    expect((await processCRMTimeouts(Date.parse("2026-01-01T00:11:00Z"))).processed).toBe(1);
    expect(state.crm_conversations[0].status).toBe("waiting");
    expect(state.crm_support_tickets).toHaveLength(1);
    expect((await processCRMTimeouts(Date.parse("2026-01-01T00:12:00Z"))).processed).toBe(0);
  });

  it("fecha automaticamente e reinicia com apresentação/menu", async () => {
    state.crm_conversations[0].metadata = { flow_state: { flowId: "flow-a", stepId: "menu", updatedAt: "2026-01-01T00:00:00Z" } };
    state.crm_agent_settings[0].config = { behavior: { timeoutMinutes: 1, timeoutAction: "close" } };
    await processCRMTimeouts(Date.parse("2026-01-01T00:02:00Z"));
    expect(state.crm_conversations[0].status).toBe("closed");

    state.crm_conversations[0].status = "bot";
    state.crm_conversations[0].metadata = { contact_is_new: true, flow_state: { flowId: "flow-a", stepId: "menu", updatedAt: "2026-01-01T00:00:00Z" } };
    state.crm_agent_settings[0].config = { presentation: "Bem-vindo", behavior: { timeoutMinutes: 1, timeoutAction: "restart_flow" } };
    await processCRMTimeouts(Date.parse("2026-01-01T00:02:00Z"));
    expect(state.crm_messages.map((m) => m.body)).toContain("Bem-vindo");
    expect((state.crm_conversations[0].metadata as any).flow_state.stepId).toBe("menu");
  });

  it("processa candidato expirado depois do primeiro lote de 200", async () => {
    state.crm_conversations = Array.from({ length: 201 }, (_, index) => ({
      id: `conv-${index}`, establishment_id: "tenant-a", customer_phone: `55${index}`, status: "bot",
      metadata: { flow_state: { flowId: "flow-a", stepId: "menu", updatedAt: "2026-01-01T00:00:00Z" } },
    }));
    state.crm_agent_settings[0].config = { behavior: { timeoutMinutes: 1, timeoutAction: "close" } };
    expect((await processCRMTimeouts(Date.parse("2026-01-01T00:02:00Z"))).processed).toBe(201);
    expect(state.crm_conversations[200].status).toBe("closed");
  });
});
