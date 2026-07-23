import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getEstablishmentBySlug, registerOrLoginCustomer } from "@/lib/loyalty.functions";
import { applyReferralByToken } from "@/lib/retention.functions";
import { attachEstablishmentBySlug } from "@/lib/my-wallet.functions";
import { listPublicPromotionsBySlug } from "@/lib/promotions.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StampCard } from "@/components/StampCard";
import { PublicRatingBlock } from "@/components/PublicRatingBlock";
import { toast } from "sonner";
import { Sparkles, MapPin, Phone, LogIn, Megaphone, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

const opts = (slug: string) => queryOptions({
  queryKey: ["est", slug],
  queryFn: () => getEstablishmentBySlug({ data: { slug } }),
});

export const Route = createFileRoute("/cartao/$slug")({
  ssr: false,
  beforeLoad: async ({ params }) => {
    // Se o visitante já está logado, tenta vincular esta empresa à conta e
    // manda direto para a carteira — sem re-preencher o formulário.
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const { data: accType } = await supabase.rpc("my_account_type");
      // Só faz auto-attach para clientes; estabelecimento/admin veem a página pública.
      if (accType !== "customer") return;
      const r = await attachEstablishmentBySlug({ data: { slug: params.slug } });
      // Toast contextual mostrado após o redirect (persistido só entre navegações).
      try {
        const msg = r.status === "created"
          ? `Cartão de ${r.name} adicionado à sua carteira.`
          : r.status === "adopted"
          ? `Encontramos seu cadastro em ${r.name} e vinculamos à sua conta.`
          : `Você já tinha cartão em ${r.name}. Bem-vindo de volta!`;
        sessionStorage.setItem("wallet:flash", JSON.stringify({ kind: "success", msg }));
      } catch { /* ignore */ }
      throw redirect({ to: `/carteira/${r.slug}` });
    } catch (e) {
      // redirect() lança — deixa passar.
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
      // Erros de negócio (inativo/não encontrado): mostra toast e manda para a carteira.
      const code = (e as { code?: string } | null)?.code;
      const name = (e as { establishmentName?: string } | null)?.establishmentName;
      if (code === "inactive" || code === "not_found") {
        const msg = code === "inactive"
          ? `${name ?? params.slug} está inativo/suspenso. Não vinculamos o cartão à sua carteira.`
          : `Estabelecimento "${params.slug}" não encontrado. Verifique o QR ou peça um novo link.`;
        try {
          sessionStorage.setItem("wallet:flash", JSON.stringify({ kind: "error", msg }));
        } catch { /* ignore */ }
        throw redirect({ to: "/carteira" });
      }
      // Outros erros: cai no fluxo público.
    }
  },
  loader: async ({ params, context }) => {
    const d = await context.queryClient.ensureQueryData(opts(params.slug));
    if (!d) throw notFound();
    return d;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.establishment.name} — Cartão fidelidade digital` },
      { name: "description", content: loaderData.establishment.description ?? `Ganhe recompensas em ${loaderData.establishment.name}. Cartão fidelidade digital, sem app.` },
      { property: "og:title", content: loaderData.establishment.name },
      { property: "og:description", content: loaderData.establishment.description ?? "Cartão fidelidade digital" },
    ] : [{ title: "Não encontrado" }, { name: "robots", content: "noindex" }],
  }),
  component: PublicPage,
  notFoundComponent: () => (
    <div className="min-h-dvh grid place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-3xl font-bold">Não encontramos essa página</h1>
        <p className="text-muted-foreground mt-2">Verifique o link ou peça um novo QR ao estabelecimento.</p>
        <Button asChild className="mt-6"><Link to="/">Ir para o início</Link></Button>
      </div>
    </div>
  ),
});

function PublicPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(opts(slug));
  const navigate = useNavigate();
  const register = useServerFn(registerOrLoginCustomer);
  const applyRef = useServerFn(applyReferralByToken);
  const [f, setF] = useState({ name: "", phone: "", email: "", opt: true });
  const [loading, setLoading] = useState(false);

  const est = data!.establishment;
  const campaign = data!.campaigns[0];

  const bg = `linear-gradient(135deg, ${est.primary_color} 0%, ${est.accent_color} 130%)`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign) return;
    setLoading(true);
    try {
      const r = await register({ data: {
        establishment_id: est.id, campaign_id: campaign.id,
        name: f.name, phone: f.phone.replace(/\D/g, ""), email: f.email, marketing_opt_in: f.opt,
      }});
      // Aplica indicação (carimbos-bônus) se o cliente veio de /r/:code — promessa da landing.
      let refMsg: string | null = null;
      try {
        const refCode = typeof window !== "undefined"
          ? sessionStorage.getItem("fidelize_referral_code")
          : null;
        if (refCode) {
          const res = await applyRef({ data: { token: r.access_token, code: refCode } });
          sessionStorage.removeItem("fidelize_referral_code");
          if (res?.bonus && res.bonus > 0) {
            refMsg = `Indicação de ${res.referrer} aplicada — você ganhou ${res.bonus} ${res.bonus === 1 ? "carimbo-bônus" : "carimbos-bônus"}!`;
          }
        }
      } catch (refErr) {
        // Não bloqueia o cadastro se a indicação falhar (código inválido, já usado, etc).
        console.warn("Referral apply failed:", refErr);
      }
      toast.success(refMsg ?? "Bem-vindo!");
      navigate({ to: "/c/$token", params: { token: r.access_token } });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro"); }
    finally { setLoading(false); }
  }


  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="h-40 md:h-56" style={{ background: bg }} />
      <div className="mx-auto max-w-3xl px-4 -mt-20 pb-12">
        <div className="rounded-3xl bg-card border shadow-xl p-6 md:p-10">
          <div className="flex items-center gap-4">
            {est.logo_url ? <img src={est.logo_url} alt="" className="h-16 w-16 rounded-2xl object-cover" /> : <div className="h-16 w-16 rounded-2xl grid place-items-center text-white font-display font-bold text-xl" style={{ background: bg }}>{est.name[0]}</div>}
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold">{est.name}</h1>
              {est.description && <p className="text-sm text-muted-foreground">{est.description}</p>}
            </div>
          </div>

          {(est.address || est.phone) && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {est.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {est.address}</span>}
              {est.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {est.phone}</span>}
            </div>
          )}

          {campaign && (
            <div className="mt-8 grid gap-8 md:grid-cols-[1fr_320px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-medium"><Sparkles className="h-3 w-3" /> Programa ativo</div>
                <h2 className="mt-3 font-display text-xl font-bold">{campaign.name}</h2>
                <p className="mt-1 text-muted-foreground">Acumule {campaign.stamps_required} carimbos e ganhe <strong className="text-foreground">{campaign.reward_title}</strong>.</p>

                <Link
                  to="/auth"
                  search={{ mode: "signin", as: "customer", est_slug: slug }}
                  className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm transition hover:bg-primary-soft"
                >
                  <span className="flex items-center gap-2 text-primary font-medium">
                    <LogIn className="h-4 w-4" /> Já tenho conta Fidelize
                  </span>
                  <span className="text-xs text-muted-foreground">Entrar com WhatsApp</span>
                </Link>

                <div className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <div className="h-px flex-1 bg-border" /> ou crie sua conta <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={submit} className="mt-4 space-y-4">
                  <div>
                    <Label>Seu nome</Label>
                    <Input required minLength={2} maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>WhatsApp</Label>
                    <Input required inputMode="numeric" placeholder="(11) 99999-9999" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>E-mail (opcional)</Label>
                    <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                  </div>
                  <label className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Checkbox checked={f.opt} onCheckedChange={(v) => setF({ ...f, opt: !!v })} />
                    <span>Aceito receber avisos sobre novidades e promoções deste estabelecimento.</span>
                  </label>
                  <Button type="submit" disabled={loading} size="lg" className="w-full text-white" style={{ background: bg }}>
                    {loading ? "Aguarde…" : "Quero meu cartão"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">Ao continuar, você concorda com os termos deste programa. Powered by Fidelize.</p>
                </form>
              </div>
              <div className="hidden md:block">
                <StampCard brandName={est.name} logoUrl={est.logo_url} stamps={0} required={campaign.stamps_required} reward={campaign.reward_title} primary={est.primary_color} accent={est.accent_color} icon={campaign.stamp_icon ?? "star"} />
              </div>
            </div>
          )}
        </div>
        <PromotionsSection slug={slug} brand={bg} />
        <div className="mt-6">
          <PublicRatingBlock slug={slug} source="linktree" />
        </div>
        <div className="text-center mt-6 text-xs text-muted-foreground"><Link to="/">Crie o cartão fidelidade do seu negócio · Fidelize</Link></div>
      </div>
    </div>
  );
}

// ---------- Public promotions block ----------

type Media = { path: string; type: "image" | "video"; url?: string | null };

function PromotionsSection({ slug, brand }: { slug: string; brand: string }) {
  const listFn = useServerFn(listPublicPromotionsBySlug);
  const q = useQuery({
    queryKey: ["public-promotions-linktree", slug],
    queryFn: () => listFn({ data: { slug } }),
    staleTime: 60_000,
  });
  const promos = q.data?.promotions ?? [];
  const globalLinks = q.data?.establishment?.external_links ?? [];

  if (promos.length === 0 && globalLinks.length === 0) return null;

  return (
    <section className="mt-6 rounded-3xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Megaphone className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Promoções e links</h2>
      </div>

      {globalLinks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {globalLinks.map((l, i) => (
            <a
              key={`${l.url}-${i}`}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" /> {l.label}
            </a>
          ))}
        </div>
      )}

      {promos.length > 0 && (
        <ul className="mt-4 space-y-4">
          {promos.map((p) => (
            <PublicPromoCard
              key={p.id}
              promo={p}
              brand={brand}
              globalLinks={globalLinks}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PublicPromoCard({
  promo,
  brand,
  globalLinks,
}: {
  promo: {
    id: string;
    title: string;
    body: string | null;
    media: Media[];
    external_links: { label: string; url: string }[];
    ends_at: string | null;
  };
  brand: string;
  globalLinks: { label: string; url: string }[];
}) {
  const [idx, setIdx] = useState(0);
  const media = promo.media.filter((m) => !!m.url);
  const current = media[idx];
  const combined = [
    ...promo.external_links,
    ...globalLinks.filter((g) => !promo.external_links.some((p) => p.url === g.url)),
  ];

  return (
    <li className="overflow-hidden rounded-2xl border bg-background">
      {current && (
        <div className="relative aspect-video w-full bg-black">
          {current.type === "video" ? (
            <video src={current.url ?? undefined} className="h-full w-full object-contain" controls playsInline />
          ) : (
            <img src={current.url ?? undefined} alt="" className="h-full w-full object-cover" />
          )}
          {media.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIdx((idx - 1 + media.length) % media.length)}
                className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIdx((idx + 1) % media.length)}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                aria-label="Próxima"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}
      <div className="space-y-2 p-4">
        <h3 className="font-display text-base font-bold">{promo.title}</h3>
        {promo.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{promo.body}</p>}
        {promo.ends_at && (
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Válido até {new Date(promo.ends_at).toLocaleDateString("pt-BR")}
          </p>
        )}
        {combined.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {combined.map((l, i) => (
              <a
                key={`${l.url}-${i}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm transition-transform active:scale-95"
                style={{ background: brand }}
              >
                <ExternalLink className="h-3.5 w-3.5" /> {l.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
