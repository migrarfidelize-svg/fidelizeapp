import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Alterna o "fixado" do vínculo cliente↔estabelecimento.
 * Cliente final usa para deixar as lojas favoritas no topo da carteira.
 */
export const toggleCustomerPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid(), pinned: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("customers")
      // pinned_at é uma coluna nova adicionada por migração; types.ts ainda pode não refletir.
      .update({ pinned_at: data.pinned ? new Date().toISOString() : null } as never)
      .eq("id", data.customer_id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

const prefsSchema = z.object({
  stamp: z.boolean(),
  reward: z.boolean(),
  campaign: z.boolean(),
  birthday: z.boolean(),
});

/**
 * Agrega as preferências de push de todos os dispositivos vinculados aos
 * clientes deste usuário. Se qualquer dispositivo tiver a categoria ligada,
 * consideramos ligada (ou -operação) — o toggle no perfil replica o novo
 * valor para todos os dispositivos.
 */
export const getMyPushPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) return { deviceCount: 0, preferences: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("preferences, active")
      .in("customer_id", ids)
      .eq("active", true);

    const rows = subs ?? [];
    if (rows.length === 0) return { deviceCount: 0, preferences: null };

    const agg = { stamp: false, reward: false, campaign: false, birthday: false };
    for (const r of rows) {
      const p = (r.preferences ?? {}) as Record<string, boolean>;
      agg.stamp = agg.stamp || p.stamp !== false;
      agg.reward = agg.reward || p.reward !== false;
      agg.campaign = agg.campaign || p.campaign !== false;
      agg.birthday = agg.birthday || p.birthday !== false;
    }
    return { deviceCount: rows.length, preferences: agg };
  });

/**
 * Aplica as preferências a todos os dispositivos push vinculados a qualquer
 * cartão deste usuário. Não cria assinatura nova — se o cliente ainda não
 * habilitou push em algum cartão, o fluxo tradicional de opt-in continua
 * na página do voucher.
 */
export const updateMyPushPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ preferences: prefsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: customers } = await context.supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId);
    const ids = (customers ?? []).map((c) => c.id);
    if (ids.length === 0) return { ok: true, updated: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("push_subscriptions")
      .update({ preferences: data.preferences })
      .in("customer_id", ids)
      .select("id");
    if (error) throw error;
    return { ok: true, updated: (updated ?? []).length };
  });
