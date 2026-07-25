import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Prévia do valor a pagar em um upgrade (com crédito pró-rata de até 7 dias). */
export const getUpgradeQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), plan_slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: member } = await supabase
      .from("establishment_members")
      .select("role")
      .eq("establishment_id", data.establishment_id)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle();
    if (!member) throw new Error("Sem acesso a este estabelecimento.");

    const { data: plan } = await supabase
      .from("plans")
      .select("slug, name, price_monthly, is_active, archived_at")
      .eq("slug", data.plan_slug)
      .maybeSingle();
    if (!plan || !plan.is_active || plan.archived_at) throw new Error("Plano indisponível.");

    const { computeUpgradeCharge } = await import("@/lib/plan-proration.server");
    return computeUpgradeCharge(data.establishment_id, plan as never);
  });
