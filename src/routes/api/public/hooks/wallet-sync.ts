// Webhook interno/externo para forçar atualização dos passes.
// POST /api/public/hooks/wallet-sync
// Header: x-wallet-secret: <WALLET_SYNC_SECRET>
// Body: { customer_id } | { establishment_id }
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  customer_id: z.string().uuid().optional(),
  establishment_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/public/hooks/wallet-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WALLET_SYNC_SECRET;
        if (!secret) return new Response("Webhook não configurado", { status: 503 });

        const provided = request.headers.get("x-wallet-secret") || "";
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(secret);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Payload inválido", { status: 400 });
        }

        const { syncCustomerWallet, syncEstablishmentWallets, defaultWalletOrigin } =
          await import("@/lib/wallet-sync.server");
        const origin = defaultWalletOrigin();

        if (parsed.customer_id) {
          const r = await syncCustomerWallet(parsed.customer_id, origin);
          return Response.json({ ok: true, result: r });
        }
        if (parsed.establishment_id) {
          const r = await syncEstablishmentWallets(parsed.establishment_id, origin);
          return Response.json({ ok: true, total: r.length });
        }
        return new Response("Informe customer_id ou establishment_id", { status: 400 });
      },
    },
  },
});
