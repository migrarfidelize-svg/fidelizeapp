import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: send birthday retention pushes + emails.
 * Called daily by pg_cron via /api/public/cron/birthday
 */
export const Route = createFileRoute("/api/public/cron/birthday")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { sendPushToCustomer } = await import("@/lib/push.server");

          // Match customers whose birthday is today (MM-DD).
          const today = new Date();
          const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(today.getUTCDate()).padStart(2, "0");
          const suffix = `-${mm}-${dd}`;

          const { data: customers } = await supabaseAdmin
            .from("customers")
            .select("id, name, establishment_id, birthdate")
            .not("birthdate", "is", null);

          const matches = (customers ?? []).filter((c) =>
            (c.birthdate as unknown as string | null)?.endsWith(suffix),
          );

          const results: { customer_id: string; sent: number }[] = [];
          const establishments = new Set(matches.map((m) => m.establishment_id));
          const settingsByEst = new Map<string, { enabled: boolean; message: string }>();
          for (const eid of establishments) {
            const { data: s } = await supabaseAdmin
              .from("retention_settings")
              .select("birthday_enabled, birthday_message")
              .eq("establishment_id", eid)
              .maybeSingle();
            settingsByEst.set(eid, {
              enabled: s?.birthday_enabled ?? true,
              message:
                s?.birthday_message ??
                "Feliz aniversário! Um mimo especial te espera na sua próxima visita.",
            });
          }

          for (const c of matches) {
            const s = settingsByEst.get(c.establishment_id);
            if (!s || !s.enabled) continue;
            const r = await sendPushToCustomer(
              c.id,
              {
                title: `🎂 Feliz aniversário, ${c.name?.split(" ")[0] ?? ""}!`,
                body: s.message,
                tag: `birthday-${c.id}`,
              },
              "birthday",
            );
            await supabaseAdmin.from("retention_dispatches").insert({
              establishment_id: c.establishment_id,
              customer_id: c.id,
              kind: "birthday",
              channel: "push",
              status: r.sent > 0 ? "sent" : "skipped",
              meta: { sent: r.sent },
            });
            results.push({ customer_id: c.id, sent: r.sent });
          }

          return Response.json({ ok: true, processed: matches.length, results });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "error";
          return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
        }
      },
    },
  },
});
