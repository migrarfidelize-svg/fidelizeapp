import { describe, expect, it, vi } from "vitest";
import { assertCRMEstablishmentAccess } from "../../atendimento.functions";

function client(superAdmin: boolean, allowed: boolean) {
  return {
    rpc: vi.fn(async (name: string, args: Record<string, string>) => {
      if (name === "is_super_admin") return { data: superAdmin, error: null };
      expect(args).toEqual({ _user: "user-a", _est: "tenant-a" });
      return { data: allowed, error: null };
    }),
  };
}

describe("CRM deterministic tenant authorization", () => {
  it("authorizes the explicitly selected tenant through server-side access", async () => {
    await expect(assertCRMEstablishmentAccess(client(false, true), "user-a", "tenant-a")).resolves.toBe("tenant-a");
  });

  it("prevents tenant A user from loading or saving tenant B", async () => {
    await expect(assertCRMEstablishmentAccess(client(false, false), "user-a", "tenant-a")).rejects.toThrow("Acesso negado");
  });

  it("allows platform admin only after checking the authenticated claim", async () => {
    const supabase = client(true, false);
    await expect(assertCRMEstablishmentAccess(supabase, "user-a", "tenant-a")).resolves.toBe("tenant-a");
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
