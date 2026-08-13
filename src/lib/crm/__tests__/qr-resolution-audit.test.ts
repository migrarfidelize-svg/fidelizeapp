import { describe, it, expect, vi, beforeEach } from "vitest";

// 1. Mock TanStack Start
vi.mock("@tanstack/react-start", () => {
  const handler = vi.fn((cb) => cb);
  return {
    createServerFn: vi.fn(() => ({
      middleware: vi.fn(() => ({ inputValidator: vi.fn(() => ({ handler })), handler })),
      inputValidator: vi.fn(() => ({ handler })),
      handler
    })),
  };
});

// 2. Fluente Mock for Supabase
const createMock = () => {
  const m: any = {
    select: vi.fn(() => m),
    insert: vi.fn(() => m),
    eq: vi.fn(() => m),
    order: vi.fn(() => m),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  return m;
};

const fluent = createMock();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => fluent),
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: vi.fn(async (ctx) => ctx),
}));

import { resolveEstablishmentBySlug } from "../../establishment-resolution.server";
import { registerOrLoginCustomer } from "../../loyalty.functions";

describe("Auditoria de Resolução de Estabelecimento (15 Cenários)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fluent.maybeSingle.mockReset();
    fluent.single.mockReset();
  });

  it("Cenário 1: Sucesso (ACTIVE)", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: true, slug: "fidelize" }, error: null });
    fluent.maybeSingle.mockResolvedValueOnce({ data: [], error: null });
    const res = await resolveEstablishmentBySlug("fidelize");
    expect(res.status).toBe("ACTIVE");
  });

  it("Cenário 2: Estabelecimento Inativo (INACTIVE)", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "e1", active: false }, error: null });
    const res = await resolveEstablishmentBySlug("inativo");
    expect(res.status).toBe("INACTIVE");
  });

  it("Cenário 3: Não Encontrado (NOT_FOUND)", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await resolveEstablishmentBySlug("nao-existe");
    expect(res.status).toBe("NOT_FOUND");
  });

  it("Cenário 4: Erro de Banco (DATABASE_ERROR)", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Fail" } });
    const res = await resolveEstablishmentBySlug("erro");
    expect(res.status).toBe("DATABASE_ERROR");
  });

  it("Cenário 10: registerOrLoginCustomer falha se campanha não existe", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const promise = registerOrLoginCustomer({ data: {
      establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999"
    }});
    await expect(promise).rejects.toThrow("CAMPAIGN_NOT_FOUND");
  });

  it("Cenário 11: registerOrLoginCustomer busca cliente filtrando por establishment_id", async () => {
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "c1", establishment_id: "e1" }, error: null }); // Campaign
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "cust1", establishment_id: "e1" }, error: null }); // Customer
    fluent.maybeSingle.mockResolvedValueOnce({ data: { id: "card1" }, error: null }); // Card
    
    await registerOrLoginCustomer({ data: {
      establishment_id: "e1", campaign_id: "c1", name: "U", phone: "11999999999"
    }});
    
    expect(fluent.eq).toHaveBeenCalledWith("establishment_id", "e1");
  });
});
