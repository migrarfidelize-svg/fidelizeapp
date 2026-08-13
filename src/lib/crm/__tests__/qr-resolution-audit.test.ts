import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks do @tanstack/react-start
vi.mock("@tanstack/react-start", () => ({
  createServerFn: (options: any) => {
    const fn = async (input: any) => {
      if (options.handler) return options.handler(input);
      return options(input);
    };
    fn.inputValidator = () => fn;
    fn.middleware = () => fn;
    fn.validator = () => fn;
    fn.handler = (h: any) => async (input: any) => h(input);
    return fn;
  },
  createMiddleware: () => ({ server: (h: any) => h, client: (h: any) => h }),
  registerGlobalMiddleware: () => {}
}));

// Mock do supabaseAdmin
const mockSingle = vi.fn();
const mockSelect = vi.fn().mockReturnThis();
const mockAdmin = {
  from: vi.fn().mockReturnThis(),
  select: mockSelect,
  eq: vi.fn().mockReturnThis(),
  maybeSingle: mockSingle,
  order: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockAdmin,
}));

import { resolveEstablishmentBySlug } from "../../establishment-resolution.server";

describe("Auditoria de Resolução de Estabelecimento (Código Real)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Cenário: slug ativo deve retornar ACTIVE", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "ativo", active: true },
      error: null,
    });
    // Segunda chamada para campanhas
    mockSelect.mockResolvedValueOnce({
      data: [{ id: "c1", name: "C1" }],
      error: null,
    });
    
    const result = await resolveEstablishmentBySlug("ativo");
    expect(result.status).toBe("ACTIVE");
    expect(result.establishment.id).toBe("123");
    expect(result.campaigns).toHaveLength(1);
  });

  it("Cenário: active=false deve retornar INACTIVE", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "inativo", active: false },
      error: null,
    });
    
    const result = await resolveEstablishmentBySlug("inativo");
    expect(result.status).toBe("INACTIVE");
  });

  it("Cenário: slug inexistente deve retornar NOT_FOUND", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    
    const result = await resolveEstablishmentBySlug("inexistente");
    expect(result.status).toBe("NOT_FOUND");
  });

  it("Cenário: erro de banco deve retornar DATABASE_ERROR", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "500", message: "Internal Server Error" },
    });
    
    const result = await resolveEstablishmentBySlug("erro");
    expect(result.status).toBe("DATABASE_ERROR");
  });

  it("Cenário: slug com espaços e maiúsculas deve ser normalizado", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "slug-ok", active: true },
      error: null,
    });
    mockSelect.mockResolvedValueOnce({ data: [], error: null });

    await resolveEstablishmentBySlug("  Slug-OK  ");
    expect(mockAdmin.eq).toHaveBeenCalledWith("slug", "slug-ok");
  });

  it("Cenário: estabelecimento ativo sem campanha deve retornar ACTIVE com campaigns vazio", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "sem-campanha", active: true },
      error: null,
    });
    mockSelect.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    
    const result = await resolveEstablishmentBySlug("sem-campanha");
    expect(result.status).toBe("ACTIVE");
    expect(result.campaigns).toHaveLength(0);
  });
});
