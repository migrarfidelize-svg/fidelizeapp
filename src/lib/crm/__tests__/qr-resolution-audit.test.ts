import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do supabaseAdmin ANTES de qualquer import
const mockSingle = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: () => mockSingle(),
    order: vi.fn().mockReturnThis(),
  },
}));

// Mock do createServerFn MAIS agressivo
vi.mock("@tanstack/react-start", () => {
  const createServerFn = (options: any) => {
    // Retorna uma função que executa o handler diretamente ignorando o wrapper do TanStack
    const fn = async (input: any) => {
      // Se options for o objeto com .handler
      if (options.handler) {
        return options.handler(input);
      }
      return options(input);
    };
    fn.inputValidator = () => fn;
    fn.middleware = () => fn;
    fn.validator = () => fn;
    fn.handler = (h: any) => async (input: any) => h(input);
    return fn;
  };
  return { createServerFn };
});

// Agora importamos a função (que usará os mocks acima)
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
    
    // Chamamos o handler diretamente se for uma server function mockada
    // Dependendo de como o mock foi feito, pode ser await getEstablishmentBySlug({ data: ... })
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
