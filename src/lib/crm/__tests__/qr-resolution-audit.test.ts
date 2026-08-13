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

describe("Auditoria 15 Cenários", () => {
  beforeEach(() => { 
    vi.clearAllMocks(); 
    fluent.maybeSingle.mockReset(); 
    fluent.single.mockReset(); 
  });

  it("1: ACTIVE", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    const res = await resolveEstablishmentBySlug("f");
    expect(res.status).toBe("ACTIVE");
  });

  it("2: INACTIVE", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: false }, error: null });
    const res = await resolveEstablishmentBySlug("i");
    expect(res.status).toBe("INACTIVE");
  });

  it("3: NOT_FOUND", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await resolveEstablishmentBySlug("n");
    expect(res.status).toBe("NOT_FOUND");
  });

  it("4: DATABASE_ERROR", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "500", message: "Error" } });
    const res = await resolveEstablishmentBySlug("e");
    expect(res.status).toBe("DATABASE_ERROR");
  });

  it("5: Normalização Espaço", async () => {
    fluent.maybeSingle.mockResolvedValue({ data: { id: "e1", active: true }, error: null });
    await resolveEstablishmentBySlug(" f ");
    expect(fluent.eq).toHaveBeenCalledWith("slug", "f");
  });

  it("6: Normalização Case", async () => {
    fluent.maybeSingle.mockResolvedValue({ data: { id: "e1", active: true }, error: null });
    await resolveEstablishmentBySlug("F");
    expect(fluent.eq).toHaveBeenCalledWith("slug", "f");
  });

  it("7: Slug Vazio", async () => {
    const res = await resolveEstablishmentBySlug("");
    expect(res.status).toBe("NOT_FOUND");
  });

  it("8: Campanha Inativa -> CAMPAIGN_NOT_FOUND", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const p = registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999" } });
    await expect(p).rejects.toThrow("CAMPAIGN_NOT_FOUND");
  });

  it("9: Cliente Scoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null }); // Campaign
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "cust1" }, error: null }); // Customer
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "card1" }, error: null }); // Card
    await registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999" } });
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });

  it("10: Cartão Scoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "cust1" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "card1" }, error: null });
    await registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999" } });
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });

  it("11: Erro 23502", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null });
    fluent.maybeSingle.mockRejectedValueOnce(new Error("23502"));
    const p = registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999" } });
    await expect(p).rejects.toThrow();
  });

  it("12: Campanha Unscoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const p = registerOrLoginCustomer({ data: { establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999" } });
    await expect(p).rejects.toThrow("CAMPAIGN_NOT_FOUND");
  });

  it("13: Campanhas Scoped", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    await resolveEstablishmentBySlug("f");
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });

  it("14: Unicode", async () => {
    fluent.maybeSingle.mockResolvedValue({ data: { id: "e1", active: true }, error: null });
    await resolveEstablishmentBySlug("pão");
    expect(fluent.eq).toHaveBeenCalledWith("slug", "pão");
  });

  it("15: Exception", async () => {
    fluent.maybeSingle.mockRejectedValueOnce(new Error("X"));
    const res = await resolveEstablishmentBySlug("f");
    expect(res.status).toBe("DATABASE_ERROR");
  });
});
