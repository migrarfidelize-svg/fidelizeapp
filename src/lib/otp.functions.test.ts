import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestOTPHandler } from "./otp.functions";
import { getProvider } from "./integrations/registry";
import { checkAuthRateLimit } from "./auth-rate-limit.server";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: vi.fn((table: string) => new Query(table)) },
}));
vi.mock("./integrations/registry", () => ({ getProvider: vi.fn() }));
vi.mock("./integrations/crypt.server", () => ({ decryptSecret: vi.fn(async (value: string) => value) }));
vi.mock("./auth-rate-limit.server", () => ({
  checkAuthRateLimit: vi.fn(async () => ({ allowed: true })),
  clientIpFromHeaders: vi.fn(() => "127.0.0.1"),
}));

let integrations: any[] = [];
let authOtps: any[] = [];

class Query {
  private filters: Array<[string, unknown]> = [];
  private operation: "select" | "insert" | "update" = "select";
  private value: any;
  constructor(private readonly table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.filters.push([key, value]); return this; }
  order() { return this; }
  limit() { return this; }
  insert(value: any) { this.operation = "insert"; this.value = value; return this; }
  update(value: any) { this.operation = "update"; this.value = value; return this; }
  private rows() {
    const source = this.table === "integrations" ? integrations : this.table === "auth_otps" ? authOtps : [];
    return source.filter((row) => this.filters.every(([key, value]) => row[key] === value));
  }
  private result() {
    if (this.operation === "insert") {
      authOtps.push({ id: `otp-${authOtps.length + 1}`, used: false, ...this.value });
      return { data: null, error: null };
    }
    if (this.operation === "update") this.rows().forEach((row) => Object.assign(row, this.value));
    return { data: this.rows(), error: null };
  }
  then(resolve: (value: any) => unknown) { return Promise.resolve(this.result()).then(resolve); }
}

const integration = {
  id: "integration-a",
  establishment_id: "tenant-a",
  category: "otp",
  provider: "uazapi",
  enabled: true,
  updated_at: "2026-08-18T00:00:00Z",
  mode: "production",
  config: { baseUrl: "https://whatsapp.example", auth_scope: "global" },
  credentials: { token: "valid-token" },
  credentials_ref: {},
};

describe("requestOTP controlado", () => {
  beforeEach(() => {
    integrations = [structuredClone(integration)];
    authOtps = [];
    process.env.AUTH_OTP_HMAC_SECRET = "test-secret-that-is-long-enough";
    vi.mocked(checkAuthRateLimit).mockResolvedValue({ allowed: true } as any);
    vi.mocked(getProvider).mockReturnValue({
      meta: { id: "uazapi" },
      sendTestMessage: vi.fn(async () => ({ ok: true, message: "accepted", providerMessageId: "msg-1" })),
    } as any);
  });

  it("envia com provider válido e persiste o OTP", async () => {
    const result = await requestOTPHandler({ whatsapp: "11999999999" }, new Headers());
    expect(result).toEqual({ ok: true, phone: "+5511999999999" });
    expect(authOtps).toHaveLength(1);
    expect(authOtps[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retorna erro controlado quando o provider está ausente", async () => {
    integrations = [];
    await expect(requestOTPHandler({ whatsapp: "11999999999" }, new Headers())).resolves.toEqual({
      ok: false,
      error: { code: "whatsapp_not_configured", message: "A integração WhatsApp não está configurada." },
    });
  });

  it("invalida o OTP e retorna JSON quando o provider responde HTTP error", async () => {
    vi.mocked(getProvider).mockReturnValue({
      meta: { id: "uazapi" },
      sendTestMessage: vi.fn(async () => ({ ok: false, httpStatus: 503, message: "offline" })),
    } as any);
    const result = await requestOTPHandler({ whatsapp: "11999999999" }, new Headers());
    expect(result).toEqual({ ok: false, error: { code: "provider_unavailable", message: "O provedor WhatsApp está indisponível no momento." } });
    expect(authOtps[0].used).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/<!doctype|<html/i);
  });

  it("invalida o OTP quando o provider lança exception", async () => {
    vi.mocked(getProvider).mockReturnValue({
      meta: { id: "uazapi" },
      sendTestMessage: vi.fn(async () => { throw new Error("network down"); }),
    } as any);
    const result = await requestOTPHandler({ whatsapp: "11999999999" }, new Headers());
    expect(result.ok).toBe(false);
    expect(authOtps[0].used).toBe(true);
  });

  it("retorna rate limit controlado", async () => {
    vi.mocked(checkAuthRateLimit).mockResolvedValue({ allowed: false } as any);
    await expect(requestOTPHandler({ whatsapp: "11999999999" }, new Headers())).resolves.toEqual({
      ok: false,
      error: { code: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos." },
    });
  });
});
