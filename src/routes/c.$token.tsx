import { createFileRoute, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getCardByToken } from "@/lib/loyalty.functions";
import { StampCard } from "@/components/StampCard";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { Gift, Clock, QrCode } from "lucide-react";


const opts = (token: string) => queryOptions({
  queryKey: ["card", token],
  queryFn: () => getCardByToken({ data: { token } }),
  refetchInterval: 15_000,
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
  notFoundComponent: () => <div className="min-h-screen grid place-items-center p-6 text-center text-muted-foreground">Cartão não encontrado.</div>,
});

function CustomerCard() {
  const { token } = Route.useParams();
  const { data } = useSuspenseQuery(opts(token));
  const d = data!;
  const est = d.establishment!;
  const bg = `linear-gradient(135deg, ${est.primary_color} 0%, ${est.accent_color} 130%)`;
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    const url = `${window.location.origin}/c/${token}`;
    QRCode.toDataURL(url, { width: 512, margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })
      .then(setQrDataUrl).catch(() => {});
  }, [token]);

  return (

    <div className="min-h-screen bg-muted/30 pb-16">
      <div className="h-40" style={{ background: bg }} />
      <div className="mx-auto max-w-xl px-4 -mt-24">
        {d.cards.map((card) => {
          const campaign = card.campaigns as { name: string; stamps_required: number; reward_title: string; stamp_icon: string | null };
          const pending = d.rewards.filter((r) => r.card_id === card.id && !r.redeemed_at);
          return (
            <div key={card.id} className="mb-6">
              <StampCard brandName={est.name} logoUrl={est.logo_url} customerName={d.customer.name} stamps={card.stamps} required={campaign.stamps_required} reward={campaign.reward_title} primary={est.primary_color} accent={est.accent_color} icon={campaign.stamp_icon ?? "star"} code={d.customer.code} />
              {pending.length > 0 && (
                <Card className="mt-4 border-success/30">
                  <CardContent className="p-5 flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-success/15 text-success"><Gift className="h-5 w-5" /></div>
                    <div>
                      <div className="font-display font-semibold">Recompensa disponível!</div>
                      <div className="text-sm text-muted-foreground">Mostre este cartão ao estabelecimento para resgatar <strong>{campaign.reward_title}</strong>.</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}

        <Card className="mb-4">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <div className="flex items-center gap-2 text-sm font-semibold"><QrCode className="h-4 w-4" /> Seu QR Code</div>
            <div className="text-xs text-muted-foreground mt-1">Mostre esta tela ao atendente para carimbar</div>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR do cartão" className="mt-4 w-56 h-56 rounded-lg border" />
            ) : <div className="mt-4 w-56 h-56 rounded-lg bg-muted animate-pulse" />}
            <div className="mt-3 text-xs text-muted-foreground">Código: <span className="font-mono">{d.customer.code}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">

            <div className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" /> Histórico recente</div>
            <div className="mt-3 divide-y">
              {d.stamps.length === 0 && <div className="py-4 text-sm text-muted-foreground">Nenhum carimbo ainda. Peça um na sua próxima visita!</div>}
              {d.stamps.filter((s) => !s.reverted_at).slice(0, 10).map((s) => (
                <div key={s.id} className="py-2 flex justify-between text-sm">
                  <span>Carimbo adicionado</span>
                  <span className="text-muted-foreground">{formatDate(s.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-muted-foreground">Powered by Fidelize · Guarde este link, é seu cartão pessoal.</div>
      </div>
    </div>
  );
}
