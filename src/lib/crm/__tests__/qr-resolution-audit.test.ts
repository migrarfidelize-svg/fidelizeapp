import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global robusto para @tanstack/react-start
vi.mock("@tanstack/react-start", () => {
  const middleware = {
    server: (h: any) => h,
    client: (h: any) => h,
  };
  const fnWrapper = (options: any) => {
    const fn = async (input: any) => {
      if (options.handler) return options.handler(input);
      return options(input);
    };
    fn.inputValidator = () => fn;
    fn.middleware = () => fn;
    fn.validator = () => fn;
    fn.handler = (h: any) => async (input: any) => h(input);
    return fn;
  };
  return { 
    createServerFn: fnWrapper,
    createMiddleware: () => middleware,
    registerGlobalMiddleware: () => {}
  };
});

// Mock do auth-middleware
vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: { server: (h: any) => h, client: (h: any) => h }
}));

// Mocks internos
const mockSingle = vi.fn();
const mockAdmin = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: () => mockSingle(),
  order: vi.fn().mockReturnThis(),
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: mockAdmin,
}));

// Agora importamos a função
import { getEstablishmentBySlug } from "../../loyalty.functions";

describe("Auditoria de Resolução de Estabelecimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Cenário 1: active=true deve retornar o estabelecimento", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "ativo", active: true, name: "Ativo" },
      error: null,
    });
    mockSingle.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    
    const result = await (getEstablishmentBySlug as any)({ data: { slug: "ativo" } });
    expect(result.establishment.slug).toBe("ativo");
    expect(result.establishment.active).toBe(true);
  });

  it("Cenário 2: active=false deve lançar erro INACTIVE", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "inativo", active: false, name: "Inativo" },
      error: null,
    });
    
    await expect((getEstablishmentBySlug as any)({ data: { slug: "inativo" } }))
      .rejects.toThrow("INACTIVE");
  });

  it("Cenário 3: slug inexistente deve lançar erro NOT_FOUND", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    
    await expect((getEstablishmentBySlug as any)({ data: { slug: "inexistente" } }))
      .rejects.toThrow("NOT_FOUND");
  });

  it("Cenário 4: erro de banco deve lançar erro DATABASE_ERROR", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Internal Server Error" },
    });
    
    await expect((getEstablishmentBySlug as any)({ data: { slug: "erro" } }))
      .rejects.toThrow("DATABASE_ERROR");
  });
});
