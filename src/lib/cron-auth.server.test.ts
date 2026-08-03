import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authorizeCronRequest } from "@/lib/cron-auth.server";

function buildRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/public/hooks/test", {
    method: "POST",
    headers,
  });
}

const VALID_SECRET = "cron-secret-abc123";
const WRONG_SECRET = "wrong-secret-xyz";
const PUBLISHABLE_KEY = "sb_publishable_mock";
const ANON_KEY = "sb_anon_mock";

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", VALID_SECRET);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
  vi.stubEnv("SUPABASE_ANON_KEY", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authorizeCronRequest", () => {
  // 1. segredo correto permite
  it("allows request with correct CRON_SECRET via apikey header", () => {
    const req = buildRequest({ apikey: VALID_SECRET });
    expect(authorizeCronRequest(req)).toBeNull();
  });

  it("allows request with correct CRON_SECRET via Authorization Bearer header", () => {
    const req = buildRequest({ authorization: `Bearer ${VALID_SECRET}` });
    expect(authorizeCronRequest(req)).toBeNull();
  });

  // 2. segredo incorreto bloqueia
  it("blocks request with wrong secret via apikey header", () => {
    const req = buildRequest({ apikey: WRONG_SECRET });
    const result = authorizeCronRequest(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("blocks request with wrong secret via Authorization Bearer header", () => {
    const req = buildRequest({ authorization: `Bearer ${WRONG_SECRET}` });
    const result = authorizeCronRequest(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  // 3. token ausente bloqueia
  it("blocks request with no auth header", () => {
    const req = buildRequest({});
    const result = authorizeCronRequest(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("blocks request with empty apikey header", () => {
    const req = buildRequest({ apikey: "" });
    const result = authorizeCronRequest(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  // 4. CRON_SECRET ausente bloqueia
  it("blocks when CRON_SECRET is not configured (503)", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const req = buildRequest({ apikey: VALID_SECRET });
    const result = authorizeCronRequest(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });

  // 5. publishable key não autentica
  it("does not authenticate with SUPABASE_PUBLISHABLE_KEY", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE_KEY);
    const req = buildRequest({ apikey: PUBLISHABLE_KEY });
    const result = authorizeCronRequest(req);
    // CRON_SECRET undefined → 503, not 401 — Supabase keys are not fallback
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });

  // 6. anon key não autentica
  it("does not authenticate with SUPABASE_ANON_KEY", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    vi.stubEnv("SUPABASE_ANON_KEY", ANON_KEY);
    const req = buildRequest({ apikey: ANON_KEY });
    const result = authorizeCronRequest(req);
    // CRON_SECRET undefined → 503, not 401 — Supabase keys are not fallback
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });
});
