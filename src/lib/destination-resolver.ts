import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getAuthenticatedAccountAccess } from "./account-access.functions";

export type AccountAccess = {
  isSuperAdmin: boolean;
  accountType: "super_admin" | "establishment" | "customer";
};

/**
 * Resolve o destino autoritativo de uma sessão autenticada.
 * Centraliza a lógica para evitar que clientes caiam no onboarding ou no /app.
 */
export async function resolveAuthenticatedDestination(providedAccess?: AccountAccess) {
  try {
    const access = providedAccess ?? (await getAuthenticatedAccountAccess());
    
    // 1. Super Admin -> Painel Administrativo
    if (access.isSuperAdmin || access.accountType === "super_admin") {
      return "/hash";
    }
    
    // 2. Estabelecimento
    if (access.accountType === "establishment") {
      // Verifica se já possui estabelecimento criado
      const { data: gate } = await supabase.rpc("my_subscription_gate");
      const hasEstablishment = (gate as any)?.has_establishment;
      
      if (hasEstablishment) {
        return "/app";
      }
      return "/onboarding";
    }
    
    // 3. Cliente (Padrão) -> Carteira
    return "/carteira";
  } catch (error) {
    console.error("[destination-resolver] Erro ao resolver destino:", error);
    return "/carteira"; // Fallback seguro
  }
}
