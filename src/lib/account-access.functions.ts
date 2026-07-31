import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAuthenticatedAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: adminRole, error: roleError }, { data: accountType, error: typeError }] =
      await Promise.all([
        supabase
          .from("app_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "super_admin")
          .maybeSingle(),
        supabase.rpc("my_account_type"),
      ]);

    if (roleError) throw new Error(`Não foi possível carregar o papel administrativo: ${roleError.message}`);
    if (typeError) throw new Error(`Não foi possível carregar o tipo da conta: ${typeError.message}`);

    const isSuperAdmin = adminRole?.role === "super_admin" || accountType === "super_admin";
    return {
      userId,
      isSuperAdmin,
      accountType: isSuperAdmin ? ("super_admin" as const) : accountType,
    };
  });