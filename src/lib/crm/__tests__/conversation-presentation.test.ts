import { describe, expect, it } from "vitest";
import { getCRMConversationBadge, getCRMOperationalTab } from "../conversation-presentation";

describe("apresentação operacional do CRM", () => {
  it.each([
    ["bot", "open"], ["waiting", "queue"], ["assigned", "assigned"], ["closed", "closed"],
  ])("classifica %s", (status, tab) => expect(getCRMOperationalTab({ status })).toBe(tab));

  it("marca suporte ativo como fila", () => {
    expect(getCRMOperationalTab({ status: "bot", metadata: { support: { active: true } } })).toBe("queue");
    expect(getCRMConversationBadge({ status: "waiting" }).label).toBe("SUPORTE");
  });

  it("identifica o atendimento autônomo", () => {
    expect(getCRMConversationBadge({ status: "bot" }).label).toBe("IA ATENDENDO");
  });
});
