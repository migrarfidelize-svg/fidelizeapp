import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAIProviderUsable, resolveAIProviderRuntime } from "../ai-adapter.server";

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("@/lib/integrations/crypt.server", () => ({ decryptSecret: vi.fn(async (value: string) => value) }));

const integrations = [
  { id: "integration-a", establishment_id: "tenant-a", category: "ai", provider: "openai", enabled: true, credentials: { OPENAI_API_KEY: "credential-a-that-is-long-enough" }, credentials_ref: {}, config: {} },
  { id: "integration-b", establishment_id: "tenant-b", category: "ai", provider: "openai", enabled: true, credentials: { OPENAI_API_KEY: "credential-b-that-is-long-enough" }, credentials_ref: {}, config: {} },
];

class IntegrationQuery {
  private filters: Array<[string, unknown]> = [];
  select() { return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  async maybeSingle() {
    const matches = integrations.filter(row => this.filters.every(([column, value]) => row[column as keyof typeof row] === value));
    return matches.length <= 1
      ? { data: matches[0] ?? null, error: null }
      : { data: null, error: new Error("multiple rows") };
  }
}

describe("AI adapter multi-tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabaseAdmin.from).mockImplementation(() => new IntegrationQuery() as never);
  });

  it("carrega somente a credencial A ao resolver o Tenant A", async () => {
    const runtime = await resolveAIProviderRuntime("tenant-a", "openai");
    expect(runtime?.integration.id).toBe("integration-a");
    expect(runtime?.finalEnv.OPENAI_API_KEY).toBe("credential-a-that-is-long-enough");
    expect(runtime?.finalEnv.OPENAI_API_KEY).not.toContain("credential-b");
  });

  it("carrega somente a credencial B ao resolver o Tenant B", async () => {
    const runtime = await resolveAIProviderRuntime("tenant-b", "openai");
    expect(runtime?.integration.id).toBe("integration-b");
    expect(runtime?.finalEnv.OPENAI_API_KEY).toBe("credential-b-that-is-long-enough");
    expect(runtime?.finalEnv.OPENAI_API_KEY).not.toContain("credential-a");
  });

  it("retorna false quando o provider não existe no tenant atual", async () => {
    await expect(isAIProviderUsable("tenant-c", "openai")).resolves.toBe(false);
    await expect(isAIProviderUsable("tenant-a", "groq")).resolves.toBe(false);
  });
});
