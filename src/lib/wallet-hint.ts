/**
 * Wallet hint — memoriza o WhatsApp do cliente entre contextos.
 *
 * Objetivo: quando o cliente instala o PWA (adiciona à tela de início),
 * o iOS abre o app em um contêiner com storage isolado — o localStorage
 * do Safari NÃO é herdado. Sem um lembrete, o cliente cai na tela de
 * login com o campo vazio e sente que "foi deslogado".
 *
 * Estratégia: além do localStorage (rápido, funciona em Android/desktop),
 * gravamos um cookie `SameSite=Lax; Max-Age=1 ano`, que em iOS 16.4+ é
 * compartilhado entre o Safari e o PWA instalado da mesma origem.
 *
 * Só guardamos os dígitos do WhatsApp — não é credencial, é hint UX.
 * Cabe ao cliente confirmar tocando em "Entrar".
 */

const KEY = "fdl_wa";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function normalizeDigits(input: string | null | undefined): string {
  return String(input ?? "").replace(/\D/g, "").slice(0, 11);
}

export function setWalletHint(input: string | null | undefined): void {
  if (typeof document === "undefined") return;
  const digits = normalizeDigits(input);
  if (digits.length < 10) return; // ignore inválido — evita gravar lixo
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${KEY}=${digits}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${secure}`;
  try { localStorage.setItem(KEY, digits); } catch { /* storage bloqueado */ }
}

export function getWalletHint(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)fdl_wa=([^;]+)/);
  if (m) return normalizeDigits(decodeURIComponent(m[1]));
  try {
    return normalizeDigits(localStorage.getItem(KEY));
  } catch {
    return "";
  }
}

export function clearWalletHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

/** Formata dígitos em `(11) 91234-5678` para preencher inputs de UI. */
export function formatWalletHint(digits: string): string {
  const d = normalizeDigits(digits);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Verdadeiro quando a página está rodando como PWA instalado (home-screen). */
export function isStandaloneLaunch(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    // iOS legacy
    if ((navigator as unknown as { standalone?: boolean }).standalone) return true;
  } catch { /* noop */ }
  return false;
}
