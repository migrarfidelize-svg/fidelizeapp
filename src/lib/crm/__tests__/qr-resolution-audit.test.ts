import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEstablishmentBySlug } from "../loyalty.functions";

// Mock do supabaseAdmin
const mockSingle = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: () => mockSingle(),
  },
}));

describe("Auditoria de Resolução de Estabelecimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Cenário 1: active=true deve retornar o estabelecimento", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "123", slug: "ativo", active: true, name: "Ativo" },
      error: null,
    });
    
    // O mock do campaigns também seria necessário aqui, mas para este teste unitário
    // focamos no estabelecimento.
    const result = await getEstablishmentBySlug({ data: { slug: "ativo" } });
    expect(result.establishment.slug).toBe("ativo");
    expect(result.establishment.active).toBe(true);
  });

  it("Cenário 2: active=false deve lançar erro INACTIVE", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "123", slug: "inativo", active: false, name: "Inativo" },
      error: null,
    });
    
    await expect(getEstablishmentBySlug({ data: { slug: "inativo" } }))
      .rejects.toThrow("INACTIVE");
  });

  it("Cenário 3: slug inexistente deve lançar erro NOT_FOUND", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    
    await expect(getEstablishmentBySlug({ data: { slug: "inexistente" } }))
      .rejects.toThrow("NOT_FOUND");
  });

  it("Cenário 4: erro de banco deve lançar erro DATABASE_ERROR", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Internal Server Error" },
    });
    
    await expect(getEstablishmentBySlug({ data: { slug: "erro" } }))
      .rejects.toThrow("DATABASE_ERROR");
  });
});
