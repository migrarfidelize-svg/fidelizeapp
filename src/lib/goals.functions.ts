import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function monthKey(d: Date = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export const getGoalsForMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ establishment_id: z.string().uuid(), month: z.string().optional() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const month = data.month ?? monthKey();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await (context.supabase as any)
      .from("establishment_goals")
      .select("*")
      .eq("establishment_id", data.establishment_id)
      .eq("month", month)
      .maybeSingle();
    return (row as {
      stamps_goal: number; customers_goal: number; rewards_goal: number; revenue_goal: number; month: string;
    } | null) ?? {
      month, stamps_goal: 0, customers_goal: 0, rewards_goal: 0, revenue_goal: 0,
    };
  });

export const upsertGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      establishment_id: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}-01$/).optional(),
      stamps_goal: z.number().int().min(0).max(1_000_000),
      customers_goal: z.number().int().min(0).max(1_000_000),
      rewards_goal: z.number().int().min(0).max(1_000_000),
      revenue_goal: z.number().min(0).max(100_000_000),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const month = data.month ?? monthKey();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (context.supabase as any)
      .from("establishment_goals")
      .upsert({
        establishment_id: data.establishment_id,
        month,
        stamps_goal: data.stamps_goal,
        customers_goal: data.customers_goal,
        rewards_goal: data.rewards_goal,
        revenue_goal: data.revenue_goal,
        created_by: context.userId,
      }, { onConflict: "establishment_id,month" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
