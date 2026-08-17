import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWhatsAppProviderForWebhook } from "../../otp.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const maybeSingle = vi.fn();
const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle } as any;
chain.select.mockReturnValue(chain);
chain.eq.mockReturnValue(chain);

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("../../integrations/registry", () => ({ getProvider: vi.fn(() => ({ meta: { id: "uazapi" } })) }));
vi.mock("../../integrations/crypt.server", () => ({ decryptSecret: vi.fn(async (value: string) => value) }));

describe("WhatsApp webhook tenant resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    vi.mocked(supabaseAdmin.from).mockReturnValue(chain);
  });

  it("resolves tenant from the enabled integration capability id", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", establishment_id: "tenant-a", provider: "uazapi", enabled: true, mode: "live", config: {}, credentials: {}, credentials_ref: {} }, error: null });
    const result = await getWhatsAppProviderForWebhook("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(result?.establishmentId).toBe("tenant-a");
    expect(chain.eq).toHaveBeenCalledWith("id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("rejects an arbitrary establishment id or malformed capability", async () => {
    await expect(getWhatsAppProviderForWebhook("tenant-a")).resolves.toBeNull();
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });
});
