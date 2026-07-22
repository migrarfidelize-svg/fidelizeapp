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
    const email = (await supabase.auth.getUser()).data.user?.email ?? "";

    // 1) Identidade e vínculos corporativos
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
        .eq("email", email),
    ]);

    // 2) Perfil "cliente final": customers + cartões, carimbos, recompensas, avaliações
    // Cast pontual para "any" evita explosão de tipos aninhados do postgrest-js.
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: unknown) => Promise<{ data: unknown[] | null; error: unknown }> & {
            in: (c: string, v: unknown[]) => Promise<{ data: unknown[] | null; error: unknown }>;
            maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
          };
          in: (c: string, v: unknown[]) => Promise<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };

    const { data: customers } = (await sb
      .from("customers")
      .select("id, establishment_id, name, phone, email, birthdate, tier, visits_count, access_token, marketing_opt_in, created_at")
      .eq("user_id", userId)) as { data: Array<{ id: string }> | null };
    const customerIds = (customers ?? []).map((c) => c.id);

    const [cards, stamps, rewards, reviewsRes, achievements, pushSubs] = await Promise.all([
      customerIds.length
        ? sb.from("loyalty_cards").select("id, customer_id, campaign_id, stamps, cycle, created_at").in("customer_id", customerIds)
        : Promise.resolve({ data: [] }),
      customerIds.length
        ? sb
            .from("stamps")
            .select("id, card_id, created_at, reverted_at, note, loyalty_cards!inner(customer_id)")
            .in("loyalty_cards.customer_id", customerIds)
        : Promise.resolve({ data: [] }),
      customerIds.length
        ? sb
            .from("rewards")
            .select("id, card_id, campaign_id, establishment_id, expires_at, redeemed_at, created_at, loyalty_cards!inner(customer_id)")
            .in("loyalty_cards.customer_id", customerIds)
        : Promise.resolve({ data: [] }),
      customerIds.length
        ? sb.from("reviews").select("id, establishment_id, rating, nps, comment, created_at, is_public").in("customer_id", customerIds)
        : Promise.resolve({ data: [] }),
      sb.from("customer_achievements").select("achievement_code, unlocked_at, establishment_id").eq("user_id", userId),
      sb.from("push_subscriptions").select("endpoint, created_at, user_agent, preferences").eq("user_id", userId),
    ]);

    return {
      generated_at: new Date().toISOString(),
      user_id: userId,
      email,
      identity: {
        profile: profile.data ?? null,
        platform_roles: roles.data ?? [],
        establishment_memberships: memberships.data ?? [],
        helpdesk_memberships: hdMembers.data ?? [],
        team_invites: invites.data ?? [],
      },
      loyalty: {
        customers: customers ?? [],
        loyalty_cards: cards.data ?? [],
        stamps: stamps.data ?? [],
        rewards: rewards.data ?? [],
        reviews: reviewsRes.data ?? [],
        achievements: achievements.data ?? [],
      },
      preferences: {
        push_subscriptions: pushSubs.data ?? [],
      },
      legal_basis: "LGPD art. 18, II (acesso) e V (portabilidade)",
      notes:
        "Este pacote contém todos os dados pessoais tratados pela Fidelize associados a esta conta. Registros retidos por obrigação legal (ex.: comprovantes fiscais) não são removidos com a exclusão da conta.",
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
