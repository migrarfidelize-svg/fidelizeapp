import { describe, expect, it } from "vitest";
import { afterHumanTransition, fallbackDecision, shouldWelcomeContact, timedOutAction } from "./flow-engine.server";

describe("políticas funcionais do Agent", () => {
  it("respeita boas-vindas diferentes para contato novo e conhecido", () => {
    expect(shouldWelcomeContact({ welcomeNew: true, welcomeKnown: false }, true)).toBe(true);
    expect(shouldWelcomeContact({ welcomeNew: true, welcomeKnown: false }, false)).toBe(false);
  });

  it("executa ação configurada após timeout", () => {
    expect(timedOutAction({ timeoutMinutes: 10, timeoutAction: "close" }, "2026-01-01T00:00:00Z", Date.parse("2026-01-01T00:11:00Z"))).toBe("close");
    expect(timedOutAction({ timeoutMinutes: 10 }, "2026-01-01T00:05:00Z", Date.parse("2026-01-01T00:11:00Z"))).toBeNull();
  });

  it("aplica maxFailures e fallback.action", () => {
    expect(fallbackDecision({ maxFailures: 2, action: "transfer_to_queue" }, 0)).toEqual({ failures: 1, action: "retry" });
    expect(fallbackDecision({ maxFailures: 2, action: "transfer_to_queue" }, 1)).toEqual({ failures: 2, action: "transfer_to_queue" });
  });

  it("respeita a política pós-atendimento humano", () => {
    expect(afterHumanTransition("stay_closed")).toEqual({ reopen: false, restart: false });
    expect(afterHumanTransition("return_to_bot")).toEqual({ reopen: true, restart: false });
    expect(afterHumanTransition("restart_flow")).toEqual({ reopen: true, restart: true });
  });
});
