import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const atendimento = readFileSync("src/lib/atendimento.functions.ts", "utf8");
const broadcasts = readFileSync("src/lib/broadcasts.functions.ts", "utf8");
const push = readFileSync("src/lib/push.functions.ts", "utf8");

describe("invariantes de segurança CRM", () => {
  it("não deriva silenciosamente o primeiro tenant", () => {
    expect(atendimento).not.toContain("resolveCRMEstablishmentId");
    expect(atendimento).not.toContain("order(\"created_at\", { ascending: true }).limit(1)");
  });

  it("valida conversa e tenant antes de inserir nota", () => {
    const fn = atendimento.slice(atendimento.indexOf("export const sendCRMMessage"), atendimento.indexOf("export const updateCRMConversationStatus"));
    expect(fn.indexOf('from("crm_conversations")')).toBeLessThan(fn.indexOf('from("crm_internal_notes")'));
    expect(fn).toContain('.eq("establishment_id", establishmentId)');
    expect(fn).toContain('establishment_id: establishmentId');
  });

  it("isola recursos e disparos pelo tenant explícito", () => {
    for (const name of ["crm_contacts", "crm_templates", "crm_tags", "crm_quick_replies"]) {
      expect(atendimento).toMatch(new RegExp(`from\\(\\"${name}\\"\\)[\\s\\S]{0,300}establishment_id`));
    }
    expect(broadcasts).toContain('.eq("establishment_id", establishmentId)');
  });

  it("desativa endpoint VAPID anterior após persistência nos três escopos", () => {
    expect(push.match(/vapid_key_rotated/g)?.length).toBeGreaterThanOrEqual(3);
    expect(push).toContain("previousEndpoint");
  });
});
