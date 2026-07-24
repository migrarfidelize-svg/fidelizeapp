import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exporta todos os usuários (auth.users) como um array JSON pronto pra
 * importar no Supabase de destino via Admin API.
 *
 * Preserva `encrypted_password` (hash bcrypt), metadata, telefones e emails.
 * A extensão Fidelize Migrator consome esse JSON direto.
 *
 * Acesso restrito a super_admin.
 */
export const exportAuthUsersJson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Verifica super_admin usando o client autenticado (RLS-safe)
    const { data: isAdmin, error: roleErr } = await supabase.rpc("is_super_admin", { _user: userId });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Acesso restrito: apenas super admin.");

    // Só depois de autorizar é que carregamos o admin client
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pagina por listUsers (Admin API) — 1000 por página
    const perPage = 1000;
    let page = 1;
    const all: any[] = [];
    // Loop até acabar
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error(error.message);
      if (!data?.users?.length) break;
      all.push(...data.users);
      if (data.users.length < perPage) break;
      page += 1;
      if (page > 100) break; // safety
    }

    // Complementa com hash de senha via SQL direto (listUsers não retorna encrypted_password)
    const { data: pwRows, error: pwErr } = await supabaseAdmin
      .schema("auth" as any)
      .from("users")
      .select("id, encrypted_password");
    if (pwErr) {
      // Fallback: tenta via RPC nada — apenas segue sem senhas
      console.warn("Sem acesso a auth.users.encrypted_password:", pwErr.message);
    }
    const pwMap = new Map<string, string>();
    (pwRows || []).forEach((r: any) => { if (r.encrypted_password) pwMap.set(r.id, r.encrypted_password); });

    const exported = all.map((u: any) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      email_confirmed_at: u.email_confirmed_at,
      phone_confirmed_at: u.phone_confirmed_at,
      created_at: u.created_at,
      user_metadata: u.user_metadata || {},
      app_metadata: u.app_metadata || {},
      encrypted_password: pwMap.get(u.id) || null,
    }));

    return { users: exported, count: exported.length, generated_at: new Date().toISOString() };
  });
