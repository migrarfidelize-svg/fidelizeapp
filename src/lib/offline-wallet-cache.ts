/**
 * Cache local (localStorage) do último estado da carteira do cliente.
 * Permite mostrar QR + progresso sem internet.
 *
 * Estrutura:
 *   {
 *     savedAt: ISO,
 *     items: WalletItem[]   // saída de getMyWallet
 *   }
 */

const KEY = "fidelize:wallet-cache:v1";
const MAX_AGE_DAYS = 30;

export type WalletCache<T> = { savedAt: string; items: T[] };

export function saveWalletCache<T>(items: T[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: WalletCache<T> = { savedAt: new Date().toISOString(), items };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota / privacy mode */
  }
}

export function readWalletCache<T>(): WalletCache<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletCache<T>;
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWalletCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/**
 * Contador de carimbos totais na carteira (usado como sinal
 * "cliente já teve valor" para gates contextuais como o prompt de instalação).
 */
export function totalStampsFromCache<T extends { card: { stamps: number } | null }>(): number {
  const c = readWalletCache<T>();
  if (!c) return 0;
  return c.items.reduce((sum, it) => sum + (it.card?.stamps ?? 0), 0);
}
