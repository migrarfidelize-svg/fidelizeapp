/**
 * Sessão pronta — evita loops de redirecionamento durante a inicialização do login.
 *
 * Problema: em cold start (refresh, PWA reaberto, aba nova) o cliente de auth
 * ainda está reidratando a sessão do storage. `getSession()` pode responder
 * `null` por alguns milissegundos. Se o guard do /_authenticated redirecionar
 * nesse instante, a tela de login já enxerga a sessão e devolve o usuário para
 * a rota privada — ping-pong infinito ("Carregando…" eterno).
 *
 * Solução: antes de decidir qualquer redirecionamento, esperamos a sessão
 * "assentar" — mas só quando há indício de sessão persistida no storage.
 * Sem indício, respondemos na hora (login legítimo, sem espera artificial).
 */
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const MAX_WAIT_MS = 3000;
const POLL_MS = 100;

/** Existe token persistido no localStorage? (chave `sb-<ref>-auth-token`) */
export function hasPersistedSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const raw = localStorage.getItem(key);
        if (raw && raw !== "null" && raw.length > 2) return true;
      }
    }
  } catch {
    // storage bloqueado (modo privado) — trata como "sem indício"
  }
  return false;
}

/**
 * Retorna a sessão atual, aguardando a inicialização quando há token no storage.
 * Nunca lança: em erro devolve `null` para o chamador decidir o fluxo.
 */
export async function getSettledSession(maxWaitMs = MAX_WAIT_MS): Promise<Session | null> {
  try {
    const first = await supabase.auth.getSession();
    if (first.data.session?.user) return first.data.session;
  } catch {
    return null;
  }

  // Sem sessão e sem indício de token guardado → decisão imediata.
  if (!hasPersistedSession()) return null;

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session;
      // Token sumiu do storage no meio do caminho (logout em outra aba).
      if (!hasPersistedSession()) return null;
    } catch {
      return null;
    }
  }
  return null;
}
