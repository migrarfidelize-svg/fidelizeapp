import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ days: z.number().int().min(1).max(90).default(7) }).default({ days: 7 });

/**
 * Resumo do funil de planos (super admin): escolhas na landing x checkouts
 * abertos, com destaque para divergências.
 */
export const adminPlanFunnelSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d ?? { days: 7 }))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabase
      .from("plan_funnel_events")
      .select("id,created_at,stage,plan_slug,plan_name,amount,source,provider,meta,session_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return { ok: false as const, rows: [], byStage: {}, mismatches: [] };

    const list = rows ?? [];
    const byStage: Record<string, number> = {};
    for (const r of list) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;

    const mismatches = list.filter((r) => r.stage === "checkout_mismatch").slice(0, 50);

    return { ok: true as const, rows: list.slice(0, 100), byStage, mismatches };
  });
