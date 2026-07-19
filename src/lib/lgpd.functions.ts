import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * LGPD — Direitos do titular (art. 18).
 * - exportMyData: portabilidade / acesso.
 * - deleteMyAccount: eliminação (via RPC delete_my_account).
 */

export const exportMyData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profile, roles, memberships, hdMembers, invites] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("app_roles").select("role, created_at").eq("user_id", userId),
      supabase
        .from("establishment_members")
        .select("id, establishment_id, role, active, created_at, establishments(name, slug)")
        .eq("user_id", userId),
      supabase
        .from("helpdesk_members")
        .select("id, establishment_id, role, active, created_at")
        .eq("user_id", userId),
      supabase
        .from("team_invites")
        .select("id, establishment_id, email, role, status, created_at")
        .eq("email", (await supabase.auth.getUser()).data.user?.email ?? ""),
    ]);

    return {
      generated_at: new Date().toISOString(),
      user_id: userId,
      profile: profile.data ?? null,
      platform_roles: roles.data ?? [],
      establishment_memberships: memberships.data ?? [],
      helpdesk_memberships: hdMembers.data ?? [],
      team_invites: invites.data ?? [],
      legal_basis: "LGPD art. 18, II (acesso) e V (portabilidade)",
    };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { confirmation: string }) => {
    if (d.confirmation !== "EXCLUIR MINHA CONTA") {
      throw new Error('Digite exatamente "EXCLUIR MINHA CONTA" para confirmar.');
    }
    return d;
  })
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { error } = await supabase.rpc("delete_my_account");
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
