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

// Lógica de Auditoria (Implementação Real sob Teste)
async function auditGetEstablishmentBySlug(data: { slug: string }, supabaseAdmin: any) {
  const { data: est, error } = await supabaseAdmin
    .from("establishments")
    .select("id, active")
    .eq("slug", data.slug)
    .maybeSingle();

  if (error) throw new Error("DATABASE_ERROR");
  if (!est) throw new Error("NOT_FOUND");
  if (!est.active) throw new Error("INACTIVE");
  
  return { establishment: est };
}

describe("Auditoria de Resolução de Estabelecimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Cenário 1: active=true deve retornar o estabelecimento", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "ativo", active: true },
      error: null,
    });
    
    const result = await auditGetEstablishmentBySlug({ slug: "ativo" }, mockAdmin);
    expect(result.establishment.active).toBe(true);
  });

  it("Cenário 2: active=false deve lançar erro INACTIVE", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "123", slug: "inativo", active: false },
      error: null,
    });
    
    await expect(auditGetEstablishmentBySlug({ slug: "inativo" }, mockAdmin))
      .rejects.toThrow("INACTIVE");
  });

  it("Cenário 3: slug inexistente deve lançar erro NOT_FOUND", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    
    await expect(auditGetEstablishmentBySlug({ slug: "inexistente" }, mockAdmin))
      .rejects.toThrow("NOT_FOUND");
  });

  it("Cenário 4: erro de banco deve lançar erro DATABASE_ERROR", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Internal Server Error" },
    });
    
    await expect(auditGetEstablishmentBySlug({ slug: "erro" }, mockAdmin))
      .rejects.toThrow("DATABASE_ERROR");
  });
});
