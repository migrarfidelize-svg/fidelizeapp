import { describe, expect, it } from "vitest";
import { remapCRMFlowSteps, validateCRMFlowDestinations } from "../atendimento.functions";

describe("integridade de conexões do fluxo", () => {
  it("rejeita payload.nextStepId e option.nextStepId externos", () => {
    expect(() => validateCRMFlowDestinations([{ id: "a", payload: { nextStepId: "external" } }])).toThrow(/destino/);
    expect(() => validateCRMFlowDestinations([{ id: "a", payload: { options: [{ nextStepId: "external" }] } }])).toThrow(/destino/);
  });

  it("duplica IDs e remapeia todas as conexões internas", () => {
    const ids = ["new-a", "new-b"];
    const copy = remapCRMFlowSteps([
      { id: "a", payload: { nextStepId: "b", options: [{ nextStepId: "b" }] } },
      { id: "b", payload: {} },
    ], () => ids.shift()!);
    expect(copy[0].id).toBe("new-a");
    expect(copy[0].payload.nextStepId).toBe("new-b");
    expect(copy[0].payload.options[0].nextStepId).toBe("new-b");
  });
});
