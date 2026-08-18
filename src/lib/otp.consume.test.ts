import { describe, expect, it } from "vitest";
import { consumeValidOTP } from "./otp.functions";

type Row = { id: string; identifier: string; code_hash: string; used: boolean; expires_at: string; created_at: string };

function client(rows: Row[]) {
  class Query {
    filters: Array<(row: Row) => boolean> = [];
    patch: Partial<Row> | null = null;
    select() { return this; }
    eq(key: keyof Row, value: unknown) { this.filters.push((row) => row[key] === value); return this; }
    gt(key: keyof Row, value: string) { this.filters.push((row) => String(row[key]) > value); return this; }
    order() { return this; }
    limit() { return this; }
    update(value: Partial<Row>) { this.patch = value; return this; }
    async maybeSingle() {
      const found = rows.filter((row) => this.filters.every((filter) => filter(row)))[0] || null;
      if (found && this.patch) Object.assign(found, this.patch);
      return { data: found ? (this.patch ? { id: found.id } : { ...found }) : null, error: null };
    }
  }
  return { from: () => new Query() };
}

describe("consumo atômico de OTP", () => {
  const now = new Date("2026-08-18T12:00:00Z");
  const makeRow = (): Row => ({ id: "otp-1", identifier: "wa:5511999999999", code_hash: "correct", used: false, expires_at: "2026-08-18T12:10:00Z", created_at: "2026-08-18T11:59:00Z" });

  it("aceita OTP válido", async () => {
    const rows = [makeRow()];
    expect((await consumeValidOTP(client(rows), rows[0].identifier, "correct", now))?.id).toBe("otp-1");
    expect(rows[0].used).toBe(true);
  });

  it("recusa OTP inválido", async () => {
    const rows = [makeRow()];
    expect(await consumeValidOTP(client(rows), rows[0].identifier, "wrong", now)).toBeNull();
    expect(rows[0].used).toBe(false);
  });

  it("impede reutilização", async () => {
    const rows = [makeRow()];
    await consumeValidOTP(client(rows), rows[0].identifier, "correct", now);
    expect(await consumeValidOTP(client(rows), rows[0].identifier, "correct", now)).toBeNull();
  });
});
