import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAuthenticatedAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Buscamos o tipo de conta real e o papel administrativo em paralelo
    const [{ data: adminRole }, { data: accountType, error: typeError }] =
      await Promise.all([
        supabase
          .from("app_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin")
          .maybeSingle(),
        supabase.rpc("my_account_type"),
      ]);

    if (typeError) {
       console.error("[account-access] erro na RPC my_account_type:", typeError);
    }

    // Se for super_admin no app_roles ou a RPC retornar super_admin
    const isSuperAdmin = adminRole?.role === "super_admin" || accountType === "super_admin";
    
    // Se a RPC falhar ou retornar nulo, o padrão para segurança é "customer"
    // a menos que seja um Super Admin confirmado.
    const finalAccountType = isSuperAdmin 
      ? "super_admin" 
      : (accountType as "establishment" | "customer" | null) || "customer";

    return {
      userId,
      isSuperAdmin,
      accountType: finalAccountType,
    };
  });
