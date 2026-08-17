import { describe, expect, it, vi } from "vitest";
import { resolveWalletCardOwner, WalletCardAccessError } from "./my-wallet.functions";

const establishment = { id: "est-a", slug: "cafe-aurora", active: true };
function db(est: any = establishment, customer: any = { id: "customer-a" }, errors: any = {}) {
  return { findEstablishment: vi.fn(async () => ({ data: est, error: errors.establishment || null })), findCustomer: vi.fn(async () => ({ data: customer, error: errors.customer || null })) };
}

describe("resolução do cartão da carteira", () => {
  it("normaliza slug e encontra o customer do mesmo estabelecimento", async () => {
    const adapter = db();
    const result = await resolveWalletCardOwner(adapter, "user-a", "  CAFE-AURORA ");
    expect(adapter.findEstablishment).toHaveBeenCalledWith("cafe-aurora");
    expect(adapter.findCustomer).toHaveBeenCalledWith("user-a", "est-a");
    expect(result.customer.id).toBe("customer-a");
  });
  it("não retorna customer de outro tenant", async () => expect((await resolveWalletCardOwner(db(establishment, null), "user-a", "cafe-aurora")).customer).toBeNull());
  it.each([[null, "NOT_FOUND"], [{ ...establishment, active: false }, "INACTIVE"]])("diferencia estabelecimento indisponível", async (est, code) => {
    await expect(resolveWalletCardOwner(db(est), "user-a", "x")).rejects.toMatchObject({ code });
  });
  it("não transforma falha de banco em ausência de vínculo", async () => {
    await expect(resolveWalletCardOwner(db(establishment, null, { customer: { code: "500" } }), "user-a", "x")).rejects.toEqual(expect.objectContaining<Partial<WalletCardAccessError>>({ code: "DATABASE_ERROR" }));
  });
  it("diferencia acesso negado", async () => {
    await expect(resolveWalletCardOwner(db(establishment, null, { customer: { code: "42501" } }), "user-a", "x")).rejects.toMatchObject({ code: "ACCESS_DENIED" });
  });
});
