import { describe, expect, it } from "vitest";
import { getSimulationTransition } from "./FlowSimulator";

const steps = [
  { id: "start", payload: { type: "message", nextStepId: "menu" } },
  { id: "menu", payload: { type: "options", options: [
    { label: "Agent", value: "1", nextStepId: "agent" },
    { label: "Humano", value: "2", nextStepId: "transfer" },
  ] } },
  { id: "agent", payload: { type: "agent", context: "Teste" } },
];

describe("simulador CRM local", () => {
  it("percorre conexões sem chamar WhatsApp ou IA", () => {
    expect(getSimulationTransition(steps[0], steps)).toBe(steps[1]);
    expect(getSimulationTransition(steps[1], steps, "1")).toBe(steps[2]);
    expect(getSimulationTransition(steps[1], steps, "2")).toEqual({ terminal: "handoff" });
  });
});
