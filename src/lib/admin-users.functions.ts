import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user: userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito: apenas administradores da plataforma.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { q?: string; account_type?: string; page?: number; pageSize?: number }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, data.pageSize ?? 25);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, account_type, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (data.account_type && data.account_type !== "all") {
      query = query.eq("account_type", data.account_type as any);
    }
    if (data.q && data.q.trim()) {
      const q = data.q.trim();
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    // Fetch emails + membership counts
    const ids = (rows ?? []).map((r: any) => r.id);
    const emails: Record<string, string> = {};
    await Promise.all(
      ids.map(async (id) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        if (u?.user?.email) emails[id] = u.user.email;
      })
    );
    const { data: memberships } = ids.length
      ? await supabaseAdmin
          .from("establishment_members")
          .select("user_id, establishment_id, role, active")
          .in("user_id", ids)
      : { data: [] as any[] };
    const { data: appRoles } = ids.length
      ? await supabaseAdmin.from("app_roles").select("user_id, role").in("user_id", ids)
      : { data: [] as any[] };

    const enriched = (rows ?? []).map((r: any) => ({
      ...r,
      email: emails[r.id] ?? null,
      memberships: (memberships ?? []).filter((m: any) => m.user_id === r.id),
      isSuperAdmin: (appRoles ?? []).some((a: any) => a.user_id === r.id && a.role === "super_admin"),
    }));

    return { rows: enriched, total: count ?? 0, page, pageSize };
  });

export const convertUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    target_user_id: string;
    to: "customer" | "establishment" | "super_admin";
    deactivate_memberships?: boolean;
  }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
    const { target_user_id, to } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prev, error: prevErr } = await supabaseAdmin
      .from("profiles")
      .select("account_type")
      .eq("id", target_user_id)
      .maybeSingle();
    if (prevErr) throw new Error(prevErr.message);
    if (!prev) throw new Error("Usuário não encontrado.");

    const fromRole = prev.account_type as string;

    // Update account_type
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ account_type: to })
      .eq("id", target_user_id);
    if (upErr) throw new Error(upErr.message);

    // If moving to customer, optionally deactivate merchant memberships
    if (to === "customer" && (data.deactivate_memberships ?? true)) {
      await supabaseAdmin
        .from("establishment_members")
        .update({ active: false })
        .eq("user_id", target_user_id);
    }

    // Manage super_admin role
    if (to === "super_admin") {
      await supabaseAdmin
        .from("app_roles")
        .upsert({ user_id: target_user_id, role: "super_admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("app_roles").delete().eq("user_id", target_user_id).eq("role", "super_admin");
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "user.role.change",
      entity_type: "profile",
      entity_id: target_user_id,
      metadata: { from: fromRole, to, deactivate_memberships: data.deactivate_memberships ?? true },
    });

    return { ok: true, from: fromRole, to };
  });
