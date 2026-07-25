/**
 * Suporte offline do balcão (/app/carimbar).
 *
 * 1. Cache da lista de clientes: última página consultada fica salva por
 *    estabelecimento, para o atendente continuar achando o cliente sem internet.
 * 2. Fila de carimbos pendentes: quando o carimbo falha por falta de conexão,
 *    ele é guardado e reenviado automaticamente quando a internet volta.
 *
 * Browser-only.
 */

const CUSTOMERS_KEY = "fidelize:offline-customers:v1";
const QUEUE_KEY = "fidelize:offline-stamp-queue:v1";
const MAX_AGE_DAYS = 7;

export type OfflineCustomer = {
  id: string;
  name: string | null;
  phone: string | null;
  code: string | null;
  visits_count?: number | null;
};

type CustomersCache = { savedAt: string; establishmentId: string; customers: OfflineCustomer[] };

export type PendingStamp = {
  id: string;
  card_id: string;
  customer_name: string | null;
  establishment_id: string;
  createdAt: string;
  attempts: number;
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / modo privado */
  }
}

// ---------- Cache de clientes ----------

export function saveOfflineCustomers(establishmentId: string, customers: OfflineCustomer[]): void {
  if (!establishmentId || customers.length === 0) return;
  const prev = readJson<CustomersCache>(CUSTOMERS_KEY);
  const base = prev && prev.establishmentId === establishmentId ? prev.customers : [];
  const byId = new Map<string, OfflineCustomer>();
  for (const c of [...base, ...customers]) byId.set(c.id, c);
  const merged = Array.from(byId.values()).slice(-500);
  writeJson(CUSTOMERS_KEY, { savedAt: new Date().toISOString(), establishmentId, customers: merged } satisfies CustomersCache);
}

/** Busca local por nome, telefone ou código. Vazio se o cache expirou. */
export function searchOfflineCustomers(establishmentId: string, query: string): { customers: OfflineCustomer[]; savedAt: string | null } {
  const cache = readJson<CustomersCache>(CUSTOMERS_KEY);
  if (!cache || cache.establishmentId !== establishmentId) return { customers: [], savedAt: null };
  const ageMs = Date.now() - new Date(cache.savedAt).getTime();
  if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return { customers: [], savedAt: null };
  const q = query.trim().toLowerCase();
  const list = !q
    ? cache.customers
    : cache.customers.filter((c) =>
        [c.name, c.phone, c.code].some((v) => (v ?? "").toLowerCase().includes(q)),
      );
  return { customers: list.slice(0, 50), savedAt: cache.savedAt };
}

// ---------- Fila de carimbos ----------

export function readStampQueue(): PendingStamp[] {
  return readJson<PendingStamp[]>(QUEUE_KEY) ?? [];
}

export function enqueueStamp(item: Omit<PendingStamp, "id" | "createdAt" | "attempts">): PendingStamp {
  const entry: PendingStamp = {
    ...item,
    id: `${item.card_id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  writeJson(QUEUE_KEY, [...readStampQueue(), entry]);
  return entry;
}

export function removeFromStampQueue(id: string): void {
  writeJson(QUEUE_KEY, readStampQueue().filter((i) => i.id !== id));
}

export function clearStampQueue(): void {
  writeJson(QUEUE_KEY, []);
}

/** Erro de rede/offline (não erro de regra de negócio, que não deve ir para a fila). */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|network|offline|load failed|timeout|networkerror/i.test(msg);
}

/**
 * Reenvia a fila. `send` deve lançar em caso de falha.
 * Itens rejeitados pelo servidor (erro de regra) saem da fila após 5 tentativas.
 */
export async function flushStampQueue(
  send: (item: PendingStamp) => Promise<unknown>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const item of readStampQueue()) {
    try {
      await send(item);
      removeFromStampQueue(item.id);
      sent++;
    } catch (err) {
      failed++;
      if (isOfflineError(err)) break; // ainda sem internet: tenta depois
      const next = readStampQueue().map((i) => (i.id === item.id ? { ...i, attempts: i.attempts + 1 } : i));
      writeJson(QUEUE_KEY, next.filter((i) => i.attempts < 5));
    }
  }
  return { sent, failed };
}
