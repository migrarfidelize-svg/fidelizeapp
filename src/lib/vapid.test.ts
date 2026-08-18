import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureCompatiblePushSubscription, urlBase64ToUint8Array, VAPID_PUBLIC_KEY } from "./vapid";

describe("rotação VAPID", () => {
  beforeEach(() => localStorage.clear());

  it("mantém assinatura compatível", async () => {
    const current = { options: { applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer }, unsubscribe: vi.fn(), endpoint: "https://push/current" } as any;
    const registration = { pushManager: { getSubscription: vi.fn(async () => current), subscribe: vi.fn() } } as any;
    const result = await ensureCompatiblePushSubscription(registration);
    expect(result).toEqual({ subscription: current, rotated: false, previousEndpoint: undefined });
    expect(current.unsubscribe).not.toHaveBeenCalled();
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("cancela e recria assinatura ligada a outra chave", async () => {
    const old = { endpoint: "https://push/old", options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer }, unsubscribe: vi.fn(async () => true) } as any;
    const replacement = { endpoint: "https://push/new" } as any;
    const registration = { pushManager: { getSubscription: vi.fn(async () => old), subscribe: vi.fn(async () => replacement) } } as any;
    const result = await ensureCompatiblePushSubscription(registration);
    expect(result).toEqual({ subscription: replacement, rotated: true, previousEndpoint: "https://push/old" });
    expect(old.unsubscribe).toHaveBeenCalledOnce();
    expect(registration.pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it("usa exatamente a chave pública de produção", () => {
    expect(VAPID_PUBLIC_KEY).toBe("BFmbHB3cxbuLYopyPHbgLXv1Hn30WG5iY-KX3XVVWQQ7FBwEw4rA36tBeAzqAUtMJGufuebwk67gSvgBms0m0So");
  });
});
