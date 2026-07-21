/**
 * Núcleo puro (sem dependência do supabase-js) do fluxo de vínculo de um
 * cliente autenticado a um estabelecimento via QR/link. Isolar aqui permite:
 *
 *  1. Testes unitários com um fake DB em memória (ver my-wallet-core.test.ts).
 *  2. Idempotência robusta em acessos simultâneos: um `idempotency_key`
 *     determinístico por `(user_id, establishment_id, phone_matched)` é
 *     calculado antes de qualquer escrita e registrado no audit log — se
 *     duas requisições racearem, ambas produzem o mesmo `idempotency_key`
 *     e a segunda cai no ramo `existing` graças à unique violation
 *     `(establishment_id, user_id)` capturada pelo adapter.
 */

export class AttachEstablishmentError extends Error {
  code: "not_found" | "inactive";
  /** Nome do estabelecimento quando conhecido (indefinido para not_found). */
  establishmentName?: string;
  /** Slug pedido pelo cliente — sempre presente para telemetria. */
  slug: string;
  constructor(code: "not_found" | "inactive", message: string, slug: string, establishmentName?: string) {
    super(message);
    this.code = code;
    this.name = "AttachEstablishmentError";
    this.slug = slug;
    this.establishmentName = establishmentName;
  }
}

export type AttachStatus = "created" | "adopted" | "existing";

export interface AttachEstablishmentInput {
  userId: string;
  slug: string;
}

export interface AttachEstablishmentResult {
  ok: true;
  slug: string;
  name: string;
  status: AttachStatus;
  /** Chave idempotente gravada no audit log — útil para diagnóstico. */
  idempotencyKey: string;
  /** Preenchido apenas quando `status === "adopted"`. */
  adoptedCustomerId: string | null;
}

/** Estabelecimento minimal necessário para o fluxo. */
export interface AttachEst {
  id: string;
  slug: string;
  name: string;
  active: boolean;
}

/** Interface de dados injetada no core — implementada pela camada Supabase. */
export interface AttachDb {
  getEstablishmentBySlug(slug: string): Promise<AttachEst | null>;
  getProfile(userId: string): Promise<{ full_name: string | null; phone: string | null } | null>;
  getMyCustomer(userId: string, estId: string): Promise<{ id: string } | null>;
  findOrphanByPhone(estId: string, phoneDigits: string): Promise<{ id: string } | null>;
  linkOrphan(customerId: string, userId: string): Promise<void>;
  /**
   * Cria a linha em `customers`. Deve lançar um objeto `{ code: "23505" }`
   * quando violar a unique `(establishment_id, user_id)` — o core trata como
   * race e refaz o SELECT para devolver o registro vencedor.
   */
  createCustomer(input: {
    establishmentId: string;
    userId: string;
    name: string;
    phone: string;
  }): Promise<{ id: string }>;
  createConsent(input: { customerId: string; establishmentId: string }): Promise<void>;
  getFirstActiveCampaign(estId: string): Promise<{ id: string } | null>;
  getCard(customerId: string, campaignId: string): Promise<{ id: string } | null>;
  createCard(input: { customerId: string; campaignId: string; establishmentId: string }): Promise<void>;
  insertAuditLog(row: {
    establishmentId: string;
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
}

/** Deriva os dígitos do telefone (BR: DDD+número, até 11). */
export function normalizePhoneDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "").slice(0, 11);
}

/**
 * Chave idempotente por `(user_id, establishment_id, phone_matched)`.
 * Não é criptográfica — serve como carimbo para o audit log e para
 * detectar em diagnóstico qual "identidade lógica" gerou o vínculo.
 */
export function buildAttachIdempotencyKey(args: {
  userId: string;
  establishmentId: string;
  phoneMatched: boolean;
}): string {
  return `attach:${args.userId}:${args.establishmentId}:${args.phoneMatched ? "phone" : "user"}`;
}

/** Detecta o erro de unique_violation propagado pelo Postgres/PostgREST. */
function isUniqueViolation(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "23505";
}

export async function attachEstablishmentCore(
  db: AttachDb,
  input: AttachEstablishmentInput,
): Promise<AttachEstablishmentResult> {
  const est = await db.getEstablishmentBySlug(input.slug);
  if (!est) {
    throw new AttachEstablishmentError(
      "not_found",
      `Não encontramos o estabelecimento "${input.slug}". Verifique o QR ou o link.`,
      input.slug,
    );
  }
  if (!est.active) {
    await db
      .insertAuditLog({
        establishmentId: est.id,
        userId: input.userId,
        action: "wallet.attach_blocked_inactive",
        entityType: "establishment",
        entityId: est.id,
        metadata: { slug: est.slug, reason: "inactive_or_suspended" },
      })
      .catch(() => {
        /* auditoria best-effort */
      });
    throw new AttachEstablishmentError(
      "inactive",
      `${est.name} está temporariamente indisponível (inativo/suspenso). Tente novamente mais tarde.`,
      est.slug,
      est.name,
    );
  }

  const profile = await db.getProfile(input.userId);
  const phoneDigits = normalizePhoneDigits(profile?.phone);

  // 1) Já existe customer deste user neste estabelecimento?
  let mine = await db.getMyCustomer(input.userId, est.id);

  // 2) Adota linha órfã pelo telefone.
  let adopted = false;
  let adoptedCustomerId: string | null = null;
  if (!mine && phoneDigits.length >= 10) {
    const orphan = await db.findOrphanByPhone(est.id, phoneDigits);
    if (orphan) {
      await db.linkOrphan(orphan.id, input.userId);
      mine = { id: orphan.id };
      adopted = true;
      adoptedCustomerId = orphan.id;
    }
  }

  // 3) Cria uma nova linha se ainda não houver — com proteção contra race.
  let created = false;
  if (!mine) {
    try {
      mine = await db.createCustomer({
        establishmentId: est.id,
        userId: input.userId,
        name: profile?.full_name ?? "Cliente Fidelize",
        phone: phoneDigits,
      });
      created = true;
      await db
        .createConsent({ customerId: mine.id, establishmentId: est.id })
        .catch(() => {
          /* consent é opcional para o fluxo — não bloqueia */
        });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Race: outra requisição do mesmo user criou primeiro. Recarrega.
      const winner = await db.getMyCustomer(input.userId, est.id);
      if (!winner) throw err;
      mine = winner;
    }
  }

  // 4) Garante cartão na campanha ativa mais antiga.
  const campaign = await db.getFirstActiveCampaign(est.id);
  if (campaign) {
    const existingCard = await db.getCard(mine.id, campaign.id);
    if (!existingCard) {
      await db
        .createCard({
          customerId: mine.id,
          campaignId: campaign.id,
          establishmentId: est.id,
        })
        .catch((err) => {
          // Idem: race na criação do cartão é aceitável.
          if (!isUniqueViolation(err)) throw err;
        });
    }
  }

  const status: AttachStatus = created ? "created" : adopted ? "adopted" : "existing";
  const idempotencyKey = buildAttachIdempotencyKey({
    userId: input.userId,
    establishmentId: est.id,
    phoneMatched: adopted,
  });

  await db
    .insertAuditLog({
      establishmentId: est.id,
      userId: input.userId,
      action: "wallet.attach_establishment",
      entityType: "customer",
      entityId: mine.id,
      metadata: {
        slug: est.slug,
        status,
        via: "qr_or_link",
        adopted_customer_id: adoptedCustomerId,
        phone_matched: adopted,
        idempotency_key: idempotencyKey,
      },
    })
    .catch(() => {
      /* auditoria best-effort */
    });

  return {
    ok: true,
    slug: est.slug,
    name: est.name,
    status,
    idempotencyKey,
    adoptedCustomerId,
  };
}
