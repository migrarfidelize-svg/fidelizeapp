/**
 * Enforcement de assinatura no servidor.
 *
 * As policies de escrita já bloqueiam INSERTs no banco, mas as server functions
 * sensíveis também validam aqui para devolver um erro claro (e cobrir updates,
 * disparos de push, exportações e integrações que não passam por INSERT).
 */

export const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Sua conta não possui um plano ativo. Assine um plano em /app/planos para usar este recurso.";

/**
 * Lança erro quando o estabelecimento não tem plano pago vigente.
 * Usa o client autenticado do contexto (RLS aplicada) — a RPC é SECURITY DEFINER.
 */
export async function assertActiveSubscription(supabase: any, establishmentId: string) {
  if (!establishmentId) throw new Error("Estabelecimento não informado.");
  const { data, error } = await supabase.rpc("has_active_subscription", { _est: establishmentId });
  if (error) throw new Error("Não foi possível validar sua assinatura. Tente novamente.");
  if (data !== true) throw new Error(SUBSCRIPTION_REQUIRED_MESSAGE);
}

/** Versão booleana, para telas que só precisam esconder/desabilitar ações. */
export async function isSubscriptionActive(supabase: any, establishmentId: string) {
  if (!establishmentId) return false;
  const { data } = await supabase.rpc("has_active_subscription", { _est: establishmentId });
  return data === true;
}
