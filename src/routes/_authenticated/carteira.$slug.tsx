import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getMyEstablishmentCard } from "@/lib/wallet.functions";
import { LoyaltyVoucher } from "@/components/LoyaltyVoucher";
import { formatDate } from "@/lib/format";
import { ArrowLeft, Phone, MessageCircle, Instagram, MapPin } from "lucide-react";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["my-wallet", slug],
    queryFn: () => getMyEstablishmentCard({ data: { slug } }),
    staleTime: 10_000,
  });

export const Route = createFileRoute("/_authenticated/carteira/$slug")({
  ssr: false,
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${(loaderData.establishment as { name: string }).name} — Minha carteira`
          : "Estabelecimento — Minha carteira",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WalletEstablishment,
  notFoundComponent: () => (
    <div className="pt-10 text-center">
      <p className="text-sm text-muted-foreground">Você ainda não participa deste programa.</p>
      <Link to="/carteira" className="mt-4 inline-block text-sm text-primary underline">
        ← Voltar para minha carteira
      </Link>
    </div>
  ),
});

function WalletEstablishment() {
  const { data } = useSuspenseQuery(opts(Route.useParams().slug));
  const d = data!;
  const est = d.establishment as {
    name: string; logo_url: string | null; primary_color: string; address: string | null;
    phone: string | null; whatsapp: string | null; instagram: string | null; description: string | null;
    active: boolean;
  };

  const card = d.cards[0];
  const req = card ? (card.campaign as { stamps_required: number }).stamps_required || 1 : 1;
  const stamps = card?.stamps ?? 0;

  return (
    <div className="space-y-5 pb-6">
      <Link to="/carteira" className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Minha carteira
      </Link>

      <header className="rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border/60 bg-muted text-xl font-bold uppercase"
            style={{ color: est.primary_color || undefined }}
          >
            {est.logo_url ? (
              <img src={est.logo_url} alt={est.name} className="h-full w-full object-cover" />
            ) : (
              est.name.slice(0, 2)
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold leading-tight">{est.name}</h1>
            {est.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{est.description}</p>}
          </div>
        </div>
      </header>

      {!est.active && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-300">
          Este estabelecimento está temporariamente indisponível. Os carimbos ficam salvos.
        </div>
      )}

      {card ? (
        <LoyaltyVoucher
          establishmentName={est.name}
          logoUrl={est.logo_url}
          primaryColor={est.primary_color}
          customerName={d.customer.name}
          customerCode={d.customer.code}
          stamps={stamps}
          stampsRequired={req}
          reward={(card.campaign as { reward: string }).reward}
          campaignIcon={(card.campaign as { icon: string | null }).icon}
          campaignColor={(card.campaign as { color: string | null }).color}
          cycle={card.cycle}
          qrValue={typeof window !== "undefined" ? `${window.location.origin}/c/${d.customer.token}` : `/c/${d.customer.token}`}
          tier={d.customer.tier}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/30 p-6 text-center text-sm text-muted-foreground">
          Você ainda não possui carimbos aqui. Mostre seu QR Code no próximo atendimento.
        </div>
      )}

      {card && (card.campaign as { rules: string | null }).rules && (
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Regras do programa</h2>
          <p className="mt-2 whitespace-pre-line text-sm">{(card.campaign as { rules: string }).rules}</p>
        </section>
      )}

      {(est.phone || est.whatsapp || est.instagram || est.address) && (
        <section className="rounded-2xl border border-border/60 bg-card/40 p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Contato</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {est.address && (
              <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /> {est.address}</li>
            )}
            {est.phone && (
              <li><a href={`tel:${est.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone className="h-4 w-4 text-muted-foreground" /> {est.phone}</a></li>
            )}
            {est.whatsapp && (
              <li><a target="_blank" rel="noreferrer" href={`https://wa.me/${est.whatsapp.replace(/\D/g, "")}`} className="flex items-center gap-2 hover:text-primary"><MessageCircle className="h-4 w-4 text-muted-foreground" /> WhatsApp</a></li>
            )}
            {est.instagram && (
              <li><a target="_blank" rel="noreferrer" href={`https://instagram.com/${est.instagram.replace(/^@/, "")}`} className="flex items-center gap-2 hover:text-primary"><Instagram className="h-4 w-4 text-muted-foreground" /> @{est.instagram.replace(/^@/, "")}</a></li>
            )}
          </ul>
        </section>
      )}

      {d.customer.lastVisitAt && (
        <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          Última visita: {formatDate(d.customer.lastVisitAt)}
        </p>
      )}
    </div>
  );
}
