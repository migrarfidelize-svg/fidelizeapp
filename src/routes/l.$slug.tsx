import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getEstablishmentBySlug, registerOrLoginCustomer } from "@/lib/loyalty.functions";
import { attachEstablishmentBySlug } from "@/lib/my-wallet.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StampCard } from "@/components/StampCard";
import { PublicRatingBlock } from "@/components/PublicRatingBlock";
import { toast } from "sonner";
import { Sparkles, MapPin, Phone, LogIn } from "lucide-react";

const opts = (slug: string) => queryOptions({
  queryKey: ["est", slug],
  queryFn: () => getEstablishmentBySlug({ data: { slug } }),
});

export const Route = createFileRoute("/l/$slug")({
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
      throw redirect({ to: `/carteira/${r.slug}` });
    } catch (e) {
      // redirect() lança — deixa passar. Outros erros: cai no fluxo público.
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
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
      toast.success("Bem-vindo!");
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
        <div className="mt-6">
          <PublicRatingBlock slug={slug} source="linktree" />
        </div>
        <div className="text-center mt-6 text-xs text-muted-foreground"><Link to="/">Crie o cartão fidelidade do seu negócio · Fidelize</Link></div>
      </div>
    </div>
  );
}
