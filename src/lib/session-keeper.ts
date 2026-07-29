// Silent session refresh — mantém o usuário conectado no PWA/browser
// renovando o access token proativamente antes de expirar.
//
// Estratégia:
//  • Ao carregar, agenda um refresh para ~60s antes do expires_at.
//  • Reagenda em TOKEN_REFRESHED / SIGNED_IN.
//  • Em focus/visibilitychange/online, se faltarem menos de 2min p/ expirar,
//    dispara refresh imediato (cobre o caso do PWA voltar do background).
//  • Idempotente: chamar startSessionKeeper() mais de uma vez é seguro.

import { supabase } from "@/integrations/supabase/client";

const REFRESH_LEAD_MS = 60 * 1000; // renova 60s antes de expirar
const FOREGROUND_THRESHOLD_MS = 2 * 60 * 1000; // <2min → refresh imediato
const MIN_TIMER_MS = 5 * 1000;
const MAX_TIMER_MS = 55 * 60 * 1000; // teto de 55min entre agendamentos

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let lastFailureAt = 0;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

async function doRefresh(reason: string) {
  if (refreshing) return;
  // Backoff simples em caso de falha (ex.: offline).
  if (Date.now() - lastFailureAt < 15_000) return;
  refreshing = true;
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      lastFailureAt = Date.now();
      // eslint-disable-next-line no-console
      console.debug("[session-keeper] refresh falhou", reason, error.message);
      return;
    }
    if (data.session) scheduleFrom(data.session.expires_at);
  } catch (err) {
    lastFailureAt = Date.now();
    // eslint-disable-next-line no-console
    console.debug("[session-keeper] refresh erro", reason, err);
  } finally {
    refreshing = false;
  }
}

function scheduleFrom(expiresAtSec: number | undefined | null) {
  clearTimer();
  if (!expiresAtSec) return;
  const msUntilExpiry = expiresAtSec * 1000 - Date.now();
  const delay = Math.min(MAX_TIMER_MS, Math.max(MIN_TIMER_MS, msUntilExpiry - REFRESH_LEAD_MS));
  timer = setTimeout(() => void doRefresh("scheduled"), delay);
}

async function refreshIfNearExpiry(reason: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s) return;
    const msLeft = s.expires_at ? s.expires_at * 1000 - Date.now() : 0;
    if (msLeft < FOREGROUND_THRESHOLD_MS) {
      await doRefresh(reason);
    } else {
      scheduleFrom(s.expires_at);
    }
  } catch {
    /* noop */
  }
}

export function startSessionKeeper() {
  if (started || typeof window === "undefined") return;
  started = true;

  // Agenda inicial a partir da sessão atual.
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) scheduleFrom(data.session.expires_at);
  })();

  // Reagenda em qualquer evento que atualize o token.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      clearTimer();
      return;
    }
    if (session?.expires_at) scheduleFrom(session.expires_at);
  });

  const onForeground = () => void refreshIfNearExpiry("foreground");
  const onVisibility = () => {
    if (document.visibilityState === "visible") onForeground();
  };
  window.addEventListener("focus", onForeground);
  window.addEventListener("online", onForeground);
  window.addEventListener("pageshow", onForeground);
  document.addEventListener("visibilitychange", onVisibility);
}

// Preferência "Manter-me conectado" (padrão: true).
// Persistida em localStorage; usada apenas como reforço visual/telemetria —
// a sessão do Supabase já é persistida automaticamente.
const KEEP_SIGNED_IN_KEY = "fidelize:keep-signed-in";

export function getKeepSignedIn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(KEEP_SIGNED_IN_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

export function setKeepSignedIn(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEEP_SIGNED_IN_KEY, value ? "1" : "0");
  } catch {
    /* noop */
  }
}
