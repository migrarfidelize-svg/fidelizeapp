import { createFileRoute } from "@tanstack/react-router";

/**
 * Beacon endpoint do funil de planos.
 *
 * POST /api/public/t/plan
 * body: { session_id, stage, plan_slug?, plan_name?, amount?, source?, provider?, meta? }
 *
 * Registra qual plano foi escolhido na landing e qual plano abriu no checkout,
 * permitindo detectar divergências. Fire-and-forget: sempre responde 204.
 */
const STAGES = ["landing_select", "auth_intent", "checkout_open", "checkout_mismatch"] as const;
type Stage = (typeof STAGES)[number];

const str = (v: unknown, max = 120): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s ? s.slice(0, max) : null;
};

export const Route = createFileRoute("/api/public/t/plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
          const stage = String(body.stage ?? "") as Stage;
          if (!STAGES.includes(stage)) return new Response(null, { status: 204 });

          const amountRaw = Number(body.amount);
          const amount = Number.isFinite(amountRaw) && amountRaw >= 0 ? Math.min(amountRaw, 999999) : null;

          const meta = body.meta && typeof body.meta === "object" ? body.meta : {};

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("plan_funnel_events").insert({
            session_id: str(body.session_id, 64),
            stage,
            plan_slug: str(body.plan_slug, 60),
            plan_name: str(body.plan_name, 80),
            amount,
            source: str(body.source, 40),
            provider: str(body.provider, 40),
            user_id: null,
            meta,
          });
        } catch {
          /* swallow — analytics nunca pode quebrar o fluxo */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
