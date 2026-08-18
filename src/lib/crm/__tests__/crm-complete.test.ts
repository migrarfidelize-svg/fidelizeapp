import { beforeEach, describe, expect, it, vi } from "vitest";
import { processAgentMessage } from "../agent-engine.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateAgentResponse } from "../ai-adapter.server";
import { getActiveWhatsAppProvider } from "../../otp.functions";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("../ai-adapter.server", () => ({ 
  generateAgentResponse: vi.fn().mockResolvedValue({ text: "Resposta IA" }),
  isAIProviderUsable: vi.fn().mockResolvedValue(true)
}));
vi.mock("../../otp.functions", () => ({ getActiveWhatsAppProvider: vi.fn() }));

const rows: Record<string, any[]> = {};
class Query {
  filters: Array<[string, any]> = []; operation = "select"; value: any;
  constructor(private table: string) {}
  select() { return this; } eq(k: string, v: any) { this.filters.push([k, v]); return this; }
  order() { return this; } limit() { return this; } insert(v: any) { this.operation = "insert"; this.value = v; return this; }
  matches() { return (rows[this.table] ||= []).filter((r) => this.filters.every(([k,v]) => r[k] === v)); }
  result() { if (this.operation === "insert") { rows[this.table].push(this.value); return { data: this.value, error: null }; } return { data: this.matches(), error: null }; }
  single() { const r = this.result(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] : r.data, error: null }); }
  maybeSingle() { return this.single(); } then(fn: any) { return Promise.resolve(this.result()).then(fn); }
}

describe("CRM Agent tenant-safe", () => {
  const send = vi.fn();
  beforeEach(() => {
    Object.keys(rows).forEach((key) => delete rows[key]);
    rows.crm_conversations = [{ id: "conv-a", establishment_id: "tenant-a", customer_phone: "5511", status: "bot", metadata: {} }];
    rows.crm_agent_settings = [{ establishment_id: "tenant-a", flow_id: "flow-a", enabled: true, config: { name: "Agent A", provider_id: "openai" } }];
    rows.crm_flow_steps = [{ id: "step-a", flow_id: "flow-a", establishment_id: "tenant-a", payload: { context: "Conta A" } }];
    rows.crm_messages = [{ conversation_id: "conv-a", establishment_id: "tenant-a", body: "Olá", direction: "inbound" }];
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => new Query(table) as any);
    rows.integrations = [{ id: "int-1", provider: "openai", enabled: true }];
    send.mockReset().mockResolvedValue({ ok: true, providerMessageId: "out-1" });
    vi.mocked(getActiveWhatsAppProvider).mockResolvedValue({ establishmentId: "tenant-a", runtime: { credentials_ref: {} }, provider: { meta: { id: "uazapi" }, sendTestMessage: send } } as any);
  });

  it("17. Agent usa contexto e configuração do tenant", async () => { await processAgentMessage({ conversationId: "conv-a", inboundText: "ajuda", flowId: "flow-a", stepId: "step-a" }); const calls = vi.mocked(generateAgentResponse).mock.calls; expect(calls[0][0].systemPrompt).toContain("Conta A"); });
  it("18. Agent envia e persiste a resposta", async () => { await processAgentMessage({ conversationId: "conv-a", inboundText: "ajuda", flowId: "flow-a", stepId: "step-a" }); expect(send).toHaveBeenCalled(); expect(rows.crm_messages[rows.crm_messages.length - 1].body).toBe("Resposta IA"); });
  it("19. falha do provider não persiste falso sucesso", async () => { send.mockResolvedValue({ ok: false, message: "offline" }); await expect(processAgentMessage({ conversationId: "conv-a", inboundText: "ajuda", flowId: "flow-a", stepId: "step-a" })).rejects.toThrow(); expect(rows.crm_messages).toHaveLength(1); });
  it("20. Agent ignora conversa humana", async () => { rows.crm_conversations[0].status = "assigned"; expect(await processAgentMessage({ conversationId: "conv-a", inboundText: "oi", flowId: "flow-a", stepId: "step-a" })).toEqual({ action: "ignored" }); expect(send).not.toHaveBeenCalled(); });
  it("21. Agent ignora suporte ativo mesmo em status bot", async () => { rows.crm_conversations[0].metadata = { support: { active: true } }; await processAgentMessage({ conversationId: "conv-a", inboundText: "oi", flowId: "flow-a", stepId: "step-a" }); expect(send).not.toHaveBeenCalled(); });
  it("22. histórico é sempre filtrado pela conversa e tenant", async () => { rows.crm_messages.push({ conversation_id: "conv-b", establishment_id: "tenant-b", body: "SEGREDO B", direction: "inbound" }); await processAgentMessage({ conversationId: "conv-a", inboundText: "oi", flowId: "flow-a", stepId: "step-a" }); const calls = vi.mocked(generateAgentResponse).mock.calls; expect(JSON.stringify(calls[0][0])).not.toContain("SEGREDO B"); });
});
