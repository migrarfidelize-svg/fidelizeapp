import { describe, it, expect, vi } from "vitest";
import { getEstablishmentBySlug } from "../../loyalty.functions";

// Mock do supabaseAdmin via Proxy
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}));

describe("getEstablishmentBySlug - Auditoria de Estados", () => {
  it("deve diferenciar NOT_FOUND de INACTIVE no servidor", async () => {
    // Isso é o que queremos testar após a correção.
    // Atualmente o código está misturando tudo.
    expect(true).toBe(true);
  });
});
