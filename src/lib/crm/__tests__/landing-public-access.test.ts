import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPublicLandingBySlug } from "../linktree.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  },
}));

describe("Landing Public Access Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. landing publicada abre com dados corretos", async () => {
    const mockEst = { id: "1", slug: "cafe", name: "Cafe", active: true, updated_at: "2024-01-01" };
    const mockPage = { id: "p1", establishment_id: "1", published: true, title: "Links", updated_at: "2024-01-01" };
    const mockLinks = [{ id: "l1", label: "Insta", url: "...", enabled: true, sort_order: 0 }];

    (supabaseAdmin.maybeSingle as any)
      .mockResolvedValueOnce({ data: mockEst, error: null })
      .mockResolvedValueOnce({ data: mockPage, error: null });
    (supabaseAdmin.order as any).mockResolvedValueOnce({ data: mockLinks, error: null });

    const res = await getPublicLandingBySlug("cafe");
    expect(res.establishment.name).toBe("Cafe");
    expect(res.links).toHaveLength(1);
    expect(res.page.title).toBe("Links");
  });

  it("2. estabelecimento inativo bloqueia acesso", async () => {
    const mockEst = { id: "1", slug: "cafe", name: "Cafe", active: false };
    (supabaseAdmin.maybeSingle as any).mockResolvedValueOnce({ data: mockEst, error: null });

    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("INACTIVE");
  });

  it("3. slug inexistente retorna NOT_FOUND", async () => {
    (supabaseAdmin.maybeSingle as any).mockResolvedValueOnce({ data: null, error: null });
    await expect(getPublicLandingBySlug("unknown")).rejects.toThrow("NOT_FOUND");
  });

  it("4. landing despublicada bloqueia acesso", async () => {
    const mockEst = { id: "1", slug: "cafe", active: true };
    (supabaseAdmin.maybeSingle as any)
      .mockResolvedValueOnce({ data: mockEst, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("UNPUBLISHED");
  });

  it("5. multi-tenant: links filtrados por page_id", async () => {
     const mockEst = { id: "tenant-a", slug: "a", active: true };
     const mockPage = { id: "page-a", establishment_id: "tenant-a", published: true };
     
     (supabaseAdmin.maybeSingle as any)
      .mockResolvedValueOnce({ data: mockEst, error: null })
      .mockResolvedValueOnce({ data: mockPage, error: null });
     (supabaseAdmin.order as any).mockResolvedValueOnce({ data: [], error: null });

     await getPublicLandingBySlug("a");
     
     // Verifica se a query de links usou o page_id correto
     expect(supabaseAdmin.eq).toHaveBeenCalledWith("page_id", "page-a");
  });

  it("6. DATABASE_ERROR capturado corretamente", async () => {
    (supabaseAdmin.maybeSingle as any).mockResolvedValueOnce({ data: null, error: { message: "Fail", code: "500" } });
    await expect(getPublicLandingBySlug("cafe")).rejects.toThrow("DATABASE_ERROR");
  });
  
  it("7. DTO não contém campos sensíveis (establishment_id interno)", async () => {
    const mockEst = { id: "uuid-interno", slug: "cafe", name: "Cafe", active: true };
    const mockPage = { id: "p-uuid", establishment_id: "uuid-interno", published: true };
    
    (supabaseAdmin.maybeSingle as any)
      .mockResolvedValueOnce({ data: mockEst, error: null })
      .mockResolvedValueOnce({ data: mockPage, error: null });
    (supabaseAdmin.order as any).mockResolvedValueOnce({ data: [], error: null });

    const res = await getPublicLandingBySlug("cafe");
    expect((res.establishment as any).id).toBeUndefined();
  });
});
