import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/routes/api/public/webhooks/whatsapp.ts", "utf8");

describe("WhatsApp webhook production pipeline", () => {
  it("persiste contato e conversa no tenant resolvido pela integração", () => {
    expect(source).toContain('active.establishmentId');
    expect(source).toContain('.from("crm_contacts").upsert');
    expect(source).toContain('.from("crm_conversations")');
  });
  it("persiste inbound antes de executar automação", () => {
    expect(source.indexOf('.from("crm_messages").insert')).toBeLessThan(source.indexOf("executeFlow(conversation.id"));
  });
  it("usa provider_message_id para idempotência", () => {
    expect(source).toContain('eq("provider_message_id", normalized.remoteMessageId)');
    expect(source).toContain('messageResult.error.code === "23505"');
  });
  it("não confirma falha transitória de persistência", () => {
    expect(source).toContain('new Response("Failed to persist message", { status: 503 })');
    expect(source).toContain('new Response("Failed to persist contact", { status: 503 })');
  });
  it("só marca inbound processado depois da automação", () => {
    expect(source.lastIndexOf("executeFlow(conversation.id")).toBeLessThan(source.lastIndexOf("processed_at: new Date()"));
  });
});
