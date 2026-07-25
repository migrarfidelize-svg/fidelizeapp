import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  audience: z.enum(["merchant", "customer"]),
  event_type: z.enum([
    "install_prompt_shown",
    "install_accepted",
    "install_dismissed",
    "install_manual_guide",
    "push_enabled",
    "push_denied",
    "push_blocked",
    "push_dismissed",
    "push_disabled",
    "push_failed",
  ]),
  platform: z.string().max(40).optional(),
  browser: z.string().max(40).optional(),
  standalone: z.boolean().optional(),
  ua: z.string().max(300).optional(),
  establishment_id: z.string().uuid().optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

/**
 * Registra adesão do usuário ao app instalado e às notificações.
 * Usado para acompanhamento de ativação e segmentação em campanhas internas.
 */
export const logAppEngagement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let establishmentId = data.establishment_id ?? null;
    if (!establishmentId && data.audience === "merchant") {
      const { data: member } = await supabase
        .from("establishment_members")
        .select("establishment_id")
        .eq("user_id", userId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      establishmentId = member?.establishment_id ?? null;
    }
    if (!establishmentId && data.audience === "customer") {
      const { data: customer } = await supabase
        .from("customers")
        .select("establishment_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      establishmentId = customer?.establishment_id ?? null;
    }

    const { error } = await supabase.from("app_engagement_events").insert({
      user_id: userId,
      establishment_id: establishmentId,
      audience: data.audience,
      event_type: data.event_type,
      platform: data.platform ?? null,
      browser: data.browser ?? null,
      standalone: data.standalone ?? null,
      ua: data.ua ?? null,
      meta: data.meta ?? {},
    });
    if (error) return { ok: false as const };
    return { ok: true as const };
  });
