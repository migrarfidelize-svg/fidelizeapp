import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tanstack/react-start", () => {
  const h = vi.fn((cb) => cb);
  return { createServerFn: vi.fn(() => ({ middleware: vi.fn(() => ({ inputValidator: vi.fn(() => ({ handler: h })), handler: h })), inputValidator: vi.fn(() => ({ handler: h })), handler: h })) };
});

const fluent: any = { select: vi.fn(() => fluent), insert: vi.fn(() => fluent), eq: vi.fn(() => fluent), order: vi.fn(() => fluent), maybeSingle: vi.fn(), single: vi.fn() };
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn(() => fluent) } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: vi.fn(async (c) => c) }));

import { resolveEstablishmentBySlug } from "../../establishment-resolution.server";
import { registerOrLoginCustomer } from "../../loyalty.functions";

describe("Auditoria de Resolução de Estabelecimento (15 Cenários)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("1: Sucesso (ACTIVE)", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    expect((await resolveEstablishmentBySlug("f")).status).toBe("ACTIVE");
  });

  it("2: Inativo", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: false }, error: null });
    expect((await resolveEstablishmentBySlug("i")).status).toBe("INACTIVE");
  });

  it("3: Não Encontrado", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await resolveEstablishmentBySlug("n")).status).toBe("NOT_FOUND");
  });

  it("4: Erro Banco", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "X" } });
    expect((await resolveEstablishmentBySlug("e")).status).toBe("DATABASE_ERROR");
  });

  it("5: Slug Normalização Espaço", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    await resolveEstablishmentBySlug(" f ");
    expect(fluent.eq).toHaveBeenCalledWith("slug", "f");
  });

  it("6: Slug Normalização Case", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    await resolveEstablishmentBySlug("F");
    expect(fluent.eq).toHaveBeenCalledWith("slug", "f");
  });

  it("7: Slug Vazio", async () => {
    expect((await resolveEstablishmentBySlug("")).status).toBe("NOT_FOUND");
  });

  it("8: Campanha Inativa", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "119" } })).rejects.toThrow("CAMPAIGN_NOT_FOUND");
  });

  it("9: Busca Cliente Tenant Scoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "cust1" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "card1" }, error: null });
    await registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "119" } });
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });

  it("10: Busca Cartão Tenant Scoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "cust1" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "card1" }, error: null });
    await registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "119" } });
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });

  it("11: Erro 23502", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null });
    fluent.maybeSingle.mockRejectedValueOnce(new Error("23502"));
    await expect(registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "119" } })).rejects.toThrow();
  });

  it("12: Campanha Pertence ao EstId", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c2", name: "U", phone: "119" } })).rejects.toThrow("CAMPAIGN_NOT_FOUND");
  });

  it("13: Busca Campanhas Tenant Scoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    await resolveEstablishmentBySlug("f");
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });

  it("14: Slug Unicode", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    await resolveEstablishmentBySlug("açúcar");
    expect(fluent.eq).toHaveBeenCalledWith("slug", "açúcar");
  });

  it("15: Unexpected Error", async () => {
    fluent.maybeSingle.mockRejectedValueOnce(new Error("boom"));
    expect((await resolveEstablishmentBySlug("f")).status).toBe("DATABASE_ERROR");
  });
});
