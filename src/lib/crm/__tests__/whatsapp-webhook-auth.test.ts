import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), getExistingSecret: vi.fn(), ensureSecret: vi.fn() }));

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock("@/lib/otp.functions", () => ({
  getActiveWhatsAppProvider: vi.fn(),
  getExistingWhatsAppWebhookSecret: mocks.getExistingSecret,
  ensureWhatsAppWebhookSecret: mocks.ensureSecret,
  hasValidWebhookSecret: (expected: string, received?: string | null) => expected === received,
}));

import { processWhatsAppWebhook } from "@/routes/api/public/webhooks/whatsapp";

describe("WhatsApp webhook authentication", () => {
  beforeEach(() => { mocks.from.mockReset(); mocks.getExistingSecret.mockReset(); mocks.ensureSecret.mockReset(); });

  it("rejects a request without secret before parsing or CRM persistence", async () => {
    mocks.getExistingSecret.mockResolvedValue("tenant-a-secret");
    const response = await processWhatsAppWebhook("not json", "tenant-a");
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects an invalid secret before CRM persistence", async () => {
    mocks.getExistingSecret.mockResolvedValue("tenant-a-secret");
    const response = await processWhatsAppWebhook("{}", "tenant-a", "wrong");
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not allow tenant A's secret to authenticate tenant B", async () => {
    mocks.getExistingSecret.mockImplementation(async (tenant: string) => tenant === "tenant-a" ? "secret-a" : "secret-b");
    const response = await processWhatsAppWebhook("{}", "tenant-b", "secret-a");
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 401 for an absent stored secret without generating or writing", async () => {
    mocks.getExistingSecret.mockResolvedValue(null);
    const response = await processWhatsAppWebhook("{}", "tenant-a", "attempt");
    expect(response.status).toBe(401);
    expect(mocks.ensureSecret).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
