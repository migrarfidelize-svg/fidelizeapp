import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCardByToken } from "@/lib/loyalty.functions";
import { LoyaltyVoucher } from "@/components/LoyaltyVoucher";
import { WalletButtons } from "@/components/WalletButtons";
import { formatDate } from "@/lib/format";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const opts = (token: string) => queryOptions({
  queryKey: ["card", token],
  queryFn: () => getCardByToken({ data: { token } }),
  refetchInterval: 30_000,
  refetchOnWindowFocus: true,
});

export const Route = createFileRoute("/c/$token")({
  ssr: false,
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.token));
    if (!d) throw notFound();
    return d;
  },
  head: () => ({ meta: [{ title: "Meu cartão — Fidelize" }, { name: "robots", content: "noindex" }] }),
  component: CustomerCard,
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-center text-muted-foreground">
      Cartão não encontrado.
    </div>
  ),
});

function CustomerCard() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(opts(token));
  const qc = useQueryClient();
  const d = data!;
  const est = d.establishment!;
  const customerId = d.customer.id;
  const cardIds = d.cards.map((c) => c.id);
  // QR payload MUST match the token the staff scanner extracts (see extractToken in app.carimbar.tsx: /\/c\/([A-Za-z0-9_-]{20,80})/)
  const qrValue = typeof window !== "undefined" ? `${window.location.origin}/c/${token}` : `/c/${token}`;
  const cards = d.cards;
  const multi = cards.length > 1;

  // Realtime: refresh voucher instantly when staff adds a stamp / unlocks a reward.
  useEffect(() => {
    if (!customerId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["card", token] });
    const channel = supabase
      .channel(`card-${token}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loyalty_cards", filter: `customer_id=eq.${customerId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `id=eq.${customerId}` }, invalidate);
    if (cardIds.length) {
      const filter = `card_id=in.(${cardIds.join(",")})`;
      channel
        .on("postgres_changes", { event: "*", schema: "public", table: "stamps", filter }, invalidate)
        .on("postgres_changes", { event: "*", schema: "public", table: "rewards", filter }, invalidate);
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [token, customerId, cardIds.join(","), qc]);


  return (
    <div
      className="min-h-dvh pb-16"
      style={{
        background: `radial-gradient(1200px 500px at 50% -10%, ${est.primary_color}22, transparent 60%), hsl(var(--background))`,
      }}
    >
      <div className="mx-auto max-w-xl px-3 pt-6 sm:px-6 sm:pt-10">
        {multi ? (
          <>
            <div className="mb-3 flex items-center justify-between px-2 text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-widest">Seus cartões</span>
              <span>{cards.length} campanhas · deslize →</span>
            </div>
            <div className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {cards.map((card) => (
                <div key={card.id} className="min-w-[92%] snap-center sm:min-w-full">
                  <VoucherFor card={card} d={d} est={est} qrValue={qrValue} />
                </div>
              ))}
            </div>
          </>
        ) : (
          cards.map((card) => (
            <VoucherFor key={card.id} card={card} d={d} est={est} qrValue={qrValue} />
          ))
        )}

        {cards.length === 0 && (
          <div className="rounded-3xl border bg-card p-8 text-center text-muted-foreground">
            Você ainda não tem cartões ativos neste estabelecimento.
          </div>
        )}

        {cards.length > 0 && <WalletButtons token={token} />}

        {/* History */}
        <section className="mt-8 rounded-3xl border bg-card/70 p-5 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4" /> Histórico recente
          </div>
          <div className="mt-3 divide-y">
            {d.stamps.length === 0 && (
              <div className="py-4 text-sm text-muted-foreground">
                Nenhum carimbo ainda. Peça um na sua próxima visita!
              </div>
            )}
            {d.stamps.filter((s) => !s.reverted_at).slice(0, 10).map((s) => (
              <div key={s.id} className="flex justify-between py-2 text-sm">
                <span>Carimbo adicionado</span>
                <span className="text-muted-foreground">{formatDate(s.created_at)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Powered by Fidelize · Guarde este link, é seu cartão pessoal.
        </div>
      </div>
    </div>
  );
}

type CardRow = {
  id: string;
  stamps: number;
  cycle: number;
  updated_at?: string | null;
  campaigns: { name: string; stamps_required: number; reward_title: string; stamp_icon: string | null; primary_color?: string | null; accent_color?: string | null } | null;
};

function VoucherFor({
  card, d, est, qrValue,
}: {
  card: CardRow;
  d: NonNullable<Awaited<ReturnType<typeof getCardByToken>>>;
  est: NonNullable<NonNullable<Awaited<ReturnType<typeof getCardByToken>>>["establishment"]>;
  qrValue: string;
}) {
  const campaign = card.campaigns!;
  const pending = d.rewards.find((r) => r.card_id === card.id && !r.redeemed_at);
  const cardStamps = d.stamps.filter((s) => s.card_id === card.id && !s.reverted_at);
  const lastStampAt = cardStamps[0]?.created_at ?? null;

  return (
    <LoyaltyVoucher
      brandName={est.name}
      logoUrl={est.logo_url}
      campaignName={campaign.name}
      customerName={d.customer.name}
      customerCode={d.customer.code}
      cardNumber={card.id.slice(0, 8).toUpperCase()}
      qrValue={qrValue}
      stamps={card.stamps}
      required={campaign.stamps_required}
      reward={campaign.reward_title}
      primary={campaign.primary_color || est.primary_color}
      accent={campaign.accent_color || est.accent_color}
      icon={campaign.stamp_icon ?? "star"}
      lastStampAt={lastStampAt}
      expiresAt={pending?.expires_at ?? null}
      rewardAvailable={!!pending}
    />
  );
}
