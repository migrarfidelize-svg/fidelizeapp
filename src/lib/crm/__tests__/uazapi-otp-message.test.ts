import { describe, expect, it, vi } from "vitest";
import { uazapiOtp } from "@/lib/integrations/otp/uazapi";

describe("OTP pela modalidade UAZAPI configurada", () => {
  it("mantém fallback textual seguro, com somente o código isolado", async () => {
    const send = vi.spyOn(uazapiOtp, "sendTestMessage").mockResolvedValue({ ok: true, message: "ok" });
    await uazapiOtp.sendOtp({ config: {}, credentials_ref: {} } as any, {} as any, "11999999999", "123456");
    expect(send).toHaveBeenCalledWith(expect.anything(), expect.anything(), "11999999999", "Seu código de acesso Afidelize é:\n\n123456\n\nEste código é válido por alguns minutos. Não compartilhe com ninguém.");
    expect(send.mock.calls[0]).toHaveLength(4);
    send.mockRestore();
  });

  it("propaga falha do envio textual sem fabricar botão reply", async () => {
    const send = vi.spyOn(uazapiOtp, "sendTestMessage").mockResolvedValue({ ok: false, message: "provider unavailable" });
    await expect(uazapiOtp.sendOtp({ config: {}, credentials_ref: {} } as any, {} as any, "11999999999", "654321")).resolves.toEqual({ ok: false, message: "provider unavailable" });
    expect(send.mock.calls[0][4]).toBeUndefined();
    send.mockRestore();
  });
});
