import { describe, it, expect } from "vitest";
import {
  attachEstablishmentCore,
  buildAttachIdempotencyKey,
  AttachEstablishmentError,
  type AttachDb,
  type AttachEst,
} from "@/lib/my-wallet-core";

/**
 * Fake in-memory DB para testar o núcleo do attach sem tocar no supabase.
 *
 * Mantém contadores e um "log" de operações para asserções fortes de
 * "não criou duplicata" e "adotou a linha órfã correta".
 */
function makeDb(seed: {
  est?: AttachEst;
  profile?: { full_name: string | null; phone: string | null };
  orphan?: { id: string; phone: string };
  existingCustomer?: { id: string };
  campaign?: { id: string };
  /** Se true, `createCustomer` lança `{ code: "23505" }` na 1ª chamada. */
  simulateRaceOnCreate?: boolean;
}) {
  const state = {
    createCustomerCalls: 0,
    createConsentCalls: 0,
    createCardCalls: 0,
    linkOrphanCalls: 0,
    auditLogs: [] as Array<{ action: string; metadata: Record<string, unknown>; entityId: string }>,
    // customer "vencedor" (via create ou adoção)
    customerId: seed.existingCustomer?.id ?? null as string | null,
  };
  const db: AttachDb = {
    async getEstablishmentBySlug(slug) {
      return seed.est && seed.est.slug === slug ? seed.est : null;
    },
    async getProfile() {
      return seed.profile ?? null;
    },
    async getMyCustomer() {
      return state.customerId ? { id: state.customerId } : null;
    },
    async findOrphanByPhone(_est, phone) {
      if (seed.orphan && seed.orphan.phone === phone) return { id: seed.orphan.id };
      return null;
    },
    async linkOrphan(customerId) {
      state.linkOrphanCalls++;
      state.customerId = customerId;
    },
    async createCustomer() {
      state.createCustomerCalls++;
      if (seed.simulateRaceOnCreate && state.createCustomerCalls === 1) {
        // Simula: outra requisição concorrente inseriu antes → PostgREST devolve 23505.
        state.customerId = "c_race_winner";
        throw { code: "23505", message: "duplicate key value violates unique constraint" };
      }
      state.customerId = "c_new_" + state.createCustomerCalls;
      return { id: state.customerId };
    },
    async createConsent() {
      state.createConsentCalls++;
    },
    async getFirstActiveCampaign() {
      return seed.campaign ?? null;
    },
    async getCard() {
      return null;
    },
    async createCard() {
      state.createCardCalls++;
    },
    async insertAuditLog(row) {
      state.auditLogs.push({ action: row.action, metadata: row.metadata, entityId: row.entityId });
    },
  };
  return { db, state };
}

const est: AttachEst = { id: "e1", slug: "cafe-aurora", name: "Café Aurora", active: true };

describe("buildAttachIdempotencyKey", () => {
  it("é determinística e distingue vínculo por telefone vs por login", () => {
    const a = buildAttachIdempotencyKey({ userId: "u1", establishmentId: "e1", phoneMatched: false });
    const b = buildAttachIdempotencyKey({ userId: "u1", establishmentId: "e1", phoneMatched: true });
    const c = buildAttachIdempotencyKey({ userId: "u1", establishmentId: "e1", phoneMatched: false });
    expect(a).toBe(c);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^attach:u1:e1:user$/);
    expect(b).toMatch(/^attach:u1:e1:phone$/);
  });
});

describe("attachEstablishmentCore — erros amigáveis", () => {
  it("lança AttachEstablishmentError('not_found') com slug quando estabelecimento não existe", async () => {
    const { db } = makeDb({});
    await expect(attachEstablishmentCore(db, { userId: "u1", slug: "nada" })).rejects.toMatchObject({
      code: "not_found",
      slug: "nada",
    });
  });

  it("lança AttachEstablishmentError('inactive') com nome quando estabelecimento está suspenso e audita o bloqueio", async () => {
    const { db, state } = makeDb({ est: { ...est, active: false } });
    await expect(attachEstablishmentCore(db, { userId: "u1", slug: est.slug })).rejects.toBeInstanceOf(
      AttachEstablishmentError,
    );
    expect(state.auditLogs[0]).toMatchObject({
      action: "wallet.attach_blocked_inactive",
      metadata: { reason: "inactive_or_suspended", slug: est.slug },
    });
    expect(state.createCustomerCalls).toBe(0);
  });
});

describe("attachEstablishmentCore — adoção de órfão", () => {
  it("adota linha órfã com o mesmo telefone e não cria customer novo", async () => {
    const orphanId = "c_orphan_9";
    const { db, state } = makeDb({
      est,
      profile: { full_name: "Ana", phone: "(11) 99999-9999" },
      orphan: { id: orphanId, phone: "11999999999" },
      campaign: { id: "camp1" },
    });

    const r = await attachEstablishmentCore(db, { userId: "u1", slug: est.slug });

    expect(r.status).toBe("adopted");
    expect(r.adoptedCustomerId).toBe(orphanId);
    expect(r.idempotencyKey).toBe("attach:u1:e1:phone");
    expect(state.linkOrphanCalls).toBe(1);
    // NÃO deve criar customer novo — a linha órfã foi reaproveitada.
    expect(state.createCustomerCalls).toBe(0);
    // Cartão da campanha ativa foi provisionado no órfão adotado.
    expect(state.createCardCalls).toBe(1);
    // Audit log final registra a adoção + idempotency_key.
    const attach = state.auditLogs.find((l) => l.action === "wallet.attach_establishment");
    expect(attach?.metadata).toMatchObject({
      status: "adopted",
      adopted_customer_id: orphanId,
      phone_matched: true,
      idempotency_key: "attach:u1:e1:phone",
    });
  });

  it("não adota quando o telefone do profile é curto/ausente — cria novo customer", async () => {
    const { db, state } = makeDb({
      est,
      profile: { full_name: "Ana", phone: null },
      orphan: { id: "c_orphan_x", phone: "11999999999" },
    });
    const r = await attachEstablishmentCore(db, { userId: "u2", slug: est.slug });
    expect(r.status).toBe("created");
    expect(r.adoptedCustomerId).toBeNull();
    expect(state.linkOrphanCalls).toBe(0);
    expect(state.createCustomerCalls).toBe(1);
  });
});

describe("attachEstablishmentCore — idempotência (sem duplicatas)", () => {
  it("segunda chamada com mesmo (user, est) devolve 'existing' e não cria linha nova", async () => {
    const { db, state } = makeDb({
      est,
      profile: { full_name: "Ana", phone: null },
      campaign: { id: "camp1" },
    });

    const r1 = await attachEstablishmentCore(db, { userId: "u1", slug: est.slug });
    const r2 = await attachEstablishmentCore(db, { userId: "u1", slug: est.slug });

    expect(r1.status).toBe("created");
    expect(r2.status).toBe("existing");
    // Só criou UMA linha em customers no total.
    expect(state.createCustomerCalls).toBe(1);
    // Chaves idempotentes iguais para a mesma dupla user/est sem match de telefone.
    expect(r1.idempotencyKey).toBe(r2.idempotencyKey);
    expect(r1.idempotencyKey).toBe("attach:u1:e1:user");
  });

  it("captura unique_violation (23505) em race concorrente e converte em 'existing'", async () => {
    const { db, state } = makeDb({
      est,
      profile: { full_name: "Ana", phone: null },
      simulateRaceOnCreate: true,
    });

    const r = await attachEstablishmentCore(db, { userId: "u1", slug: est.slug });

    // Não vazou o erro 23505 — foi convertido em fluxo idempotente.
    expect(r.status).toBe("existing");
    expect(r.adoptedCustomerId).toBeNull();
    // Tentou criar uma vez (que falhou) — não fez retry cego.
    expect(state.createCustomerCalls).toBe(1);
    // Audit log final foi gravado com o entity_id do vencedor da race.
    const attach = state.auditLogs.find((l) => l.action === "wallet.attach_establishment");
    expect(attach?.entityId).toBe("c_race_winner");
    expect(attach?.metadata).toMatchObject({ status: "existing", idempotency_key: "attach:u1:e1:user" });
  });
});
