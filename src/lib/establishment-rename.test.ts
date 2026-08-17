import { describe, expect, it } from "vitest";
import { renameEstablishmentSchema } from "./settings.functions";

const id = "00000000-0000-4000-8000-000000000001";
describe("rename do nome de exibição", () => {
  it("trima e valida o nome", () => expect(renameEstablishmentSchema.parse({ establishment_id: id, name: "  Café Aurora Premium  " }).name).toBe("Café Aurora Premium"));
  it.each(["", " ", "x"])("rejeita nome inválido", (name) => expect(() => renameEstablishmentSchema.parse({ establishment_id: id, name })).toThrow());
  it("não aceita slug no payload", () => expect(renameEstablishmentSchema.strict().safeParse({ establishment_id: id, name: "Café Aurora", slug: "novo" }).success).toBe(false));
});
