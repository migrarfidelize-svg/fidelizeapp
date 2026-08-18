import { describe, expect, it } from "vitest";
import { updateFlowStepPayload } from "./FlowEditor";

describe("FlowEditor payload", () => {
  it("preserva campos desconhecidos ao editar", () => {
    const steps = [{ id: "step-1", payload: { type: "agent", text: "Antes", context: "ctx", customRule: { score: 10 } } }];
    const updated = updateFlowStepPayload(steps, "step-1", { text: "Depois" });
    expect(updated[0].payload).toEqual({ type: "agent", text: "Depois", context: "ctx", customRule: { score: 10 } });
  });
});
