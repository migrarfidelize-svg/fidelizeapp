import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { StampCard } from "@/components/StampCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, QrCode, Smartphone, ShieldCheck, BarChart3, Sparkles, Coffee, Scissors, Pizza, ShoppingBag, Wrench, IceCream, Store, PawPrint, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fidelize — Transforme visitantes em clientes fiéis" },
      { name: "description", content: "Cartão fidelidade digital, QR Code e painel de análise. Seus clientes voltam mais vezes — sem app, sem cartão de papel." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <Hero />
      <Segments />
      <HowItWorks />
      <Benefits />
      <Comparison />
      <Examples />
      <Pricing />
      <FAQ />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  const { data: session } = useQuery({ queryKey: ["session"], queryFn: async () => (await supabase.auth.getSession()).data.session });
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/"><Logo /></Link>
        <nav className="hidden gap-8 md:flex text-sm text-muted-foreground">
          <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
          <a href="#segmentos" className="hover:text-foreground">Para quem é</a>
          <Link to="/precos" className="hover:text-foreground">Preços</Link>
          <a href="#faq" className="hover:text-foreground">Dúvidas</a>
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <Button asChild><Link to="/app">Meu painel</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Entrar</Link></Button>
              <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Testar grátis</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-primary-soft),transparent_60%)]" />
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" /> Cartão fidelidade digital para o seu negócio
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Transforme visitantes em <span className="bg-clip-text text-transparent gradient-brand">clientes fiéis</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Crie seu cartão fidelidade digital, compartilhe por QR Code e faça seus clientes voltarem mais vezes. Sem aplicativo, sem cartão de papel.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gradient-brand text-primary-foreground surface-glow">
              <Link to="/auth" search={{ mode: "signup" }}>Criar meu cartão grátis <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline"><a href="#como-funciona">Ver como funciona</a></Button>
          </div>
          <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Sem cartão de crédito</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Configure em 5 minutos</span>
          </div>
        </div>
        <div className="relative flex justify-center">
          <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(circle,var(--color-accent-soft),transparent_70%)]" />
          <StampCard brandName="Café do Centro" customerName="Ana Silva" stamps={7} required={10} reward="Um café especial grátis" primary="#7C2D12" accent="#F59E0B" icon="coffee" code="CDC7A2" />
        </div>
      </div>
    </section>
  );
}

const SEGMENTS = [
  { icon: Coffee, label: "Cafeterias" },
  { icon: Scissors, label: "Barbearias" },
  { icon: Sparkles, label: "Salões" },
  { icon: Pizza, label: "Pizzarias" },
  { icon: IceCream, label: "Sorveterias" },
  { icon: Store, label: "Padarias" },
  { icon: PawPrint, label: "Pet Shops" },
  { icon: Wrench, label: "Oficinas" },
  { icon: ShoppingBag, label: "Lojas" },
];

function Segments() {
  return (
    <section id="segmentos" className="border-y bg-muted/40 py-16">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Feito para</div>
        <h2 className="mt-2 font-display text-3xl font-bold">Negócios que vivem de clientes que voltam</h2>
        <div className="mt-10 grid grid-cols-3 gap-6 md:grid-cols-9">
          {SEGMENTS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-card border shadow-sm"><s.icon className="h-6 w-6" /></div>
              <div className="text-xs font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Crie seu cartão", desc: "Escolha suas cores, adicione sua logo e defina a recompensa que seus clientes vão amar." },
    { n: "02", title: "Compartilhe o QR", desc: "Coloque o QR Code no seu balcão ou envie o link. O cliente escaneia e já sai com o cartão no celular." },
    { n: "03", title: "Carimbe e fidelize", desc: "A cada visita, você escaneia o cartão dele. Ele acumula, ganha e volta sempre." },
  ];
  return (
    <section id="como-funciona" className="py-24">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <h2 className="font-display text-4xl font-bold">Três passos simples para seus clientes voltarem sempre</h2>
        <p className="mt-3 text-muted-foreground">Do primeiro cadastro à recompensa, tudo funciona pelo navegador.</p>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border bg-card p-8 text-left shadow-sm">
              <div className="font-display text-5xl font-black text-primary/20">{s.n}</div>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    { icon: Smartphone, title: "Sem app para baixar", desc: "O cliente acessa tudo direto pelo navegador do celular. Zero atrito." },
    { icon: QrCode, title: "QR Code exclusivo", desc: "Cada empresa, campanha e cliente tem sua própria identificação segura." },
    { icon: ShieldCheck, title: "Seguro contra fraude", desc: "Só a sua equipe autorizada pode carimbar. Cada ação fica registrada." },
    { icon: BarChart3, title: "Painel completo", desc: "Clientes ativos, visitas, retorno, ranking e alertas — tudo num só lugar." },
    { icon: Sparkles, title: "Página personalizada", desc: "Sua marca, suas cores, sua vitrine digital. Um link para chamar de seu." },
    { icon: Store, title: "Multi-unidade", desc: "Uma empresa, várias lojas. Relatórios consolidados por unidade." },
  ];
  return (
    <section className="border-y bg-muted/40 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-bold">Tudo o que você precisa para fidelizar</h2>
          <p className="mt-3 text-muted-foreground">Ferramentas modernas, pensadas para quem atende cliente todos os dias.</p>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {items.map((b) => (
            <div key={b.title} className="rounded-2xl border bg-card p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl gradient-brand text-primary-foreground"><b.icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-display font-semibold">{b.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    ["Precisa baixar aplicativo", "Não", "Sim"],
    ["O cliente perde o cartão", "Nunca", "Sempre"],
    ["Rastreamento de visitas", "Automático", "Manual e falho"],
    ["Análise de clientes", "Painel completo", "Nenhuma"],
    ["Fraude com carimbos", "Bloqueada", "Fácil"],
    ["Custo por cliente", "Zero", "Impressão e reposição"],
  ];
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl px-4">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">Cartão de papel × Fidelize</h2>
          <p className="mt-3 text-muted-foreground">Por que empresas modernas já trocaram.</p>
        </div>
        <div className="mt-10 overflow-hidden rounded-3xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-4 font-medium"></th>
                <th className="p-4 font-display font-semibold text-primary">Fidelize</th>
                <th className="p-4 font-medium text-muted-foreground">Cartão de papel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, a, b]) => (
                <tr key={k} className="border-t">
                  <td className="p-4 font-medium">{k}</td>
                  <td className="p-4 text-primary font-semibold">{a}</td>
                  <td className="p-4 text-muted-foreground">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Examples() {
  const examples = [
    "Compre 9 cafés e ganhe o 10º",
    "A cada 5 cortes, um desconto",
    "Complete 10 lavagens, uma grátis",
    "4 pedidos, uma sobremesa",
    "Complete o cartão e receba um cupom",
    "Acumule pontos e troque por produtos",
  ];
  return (
    <section className="border-y bg-muted/40 py-20">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <h2 className="font-display text-3xl font-bold">Exemplos de campanhas que funcionam</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {examples.map((e) => (
            <span key={e} className="rounded-full border bg-card px-4 py-2 text-sm">{e}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const plans = [
    { name: "Gratuito", price: "R$ 0", desc: "Para começar a testar", features: ["Até 100 clientes", "1 campanha", "1 funcionário", "Relatórios básicos"] },
    { name: "Inicial", price: "R$ 49", desc: "Para o dia a dia", features: ["Até 1.000 clientes", "2 campanhas", "3 funcionários", "Exportação de dados"], highlight: false },
    { name: "Profissional", price: "R$ 129", desc: "Para negócios em crescimento", features: ["Até 10.000 clientes", "5 campanhas", "10 funcionários", "Segmentação e relatórios avançados", "Sem marca Fidelize"], highlight: true },
    { name: "Empresarial", price: "R$ 349", desc: "Para redes e franquias", features: ["Clientes ilimitados", "Multi-unidade", "Suporte prioritário", "Limites personalizados"] },
  ];
  return (
    <section id="precos" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">Planos simples e transparentes</h2>
          <p className="mt-3 text-muted-foreground">Comece grátis e evolua quando fizer sentido para o seu negócio.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {plans.map((p) => (
            <div key={p.name} className={`relative rounded-3xl border p-6 ${p.highlight ? "border-primary bg-card surface-glow" : "bg-card"}`}>
              {p.highlight && <span className="absolute -top-3 left-6 rounded-full gradient-brand px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">Mais popular</span>}
              <div className="font-display font-semibold">{p.name}</div>
              <div className="mt-2 font-display text-3xl font-bold">{p.price}<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <div className="text-sm text-muted-foreground">{p.desc}</div>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success shrink-0" />{f}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={p.highlight ? "default" : "outline"}>
                <Link to="/auth" search={{ mode: "signup" }}>Começar agora</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    ["Meu cliente precisa baixar um app?", "Não. Tudo funciona direto pelo navegador do celular. Ele escaneia o QR Code, informa nome e telefone e já sai com o cartão pronto."],
    ["Como impedir que o cliente carimbe sozinho?", "Somente sua equipe autenticada pode adicionar carimbos. Cada ação fica registrada com data, hora e nome do funcionário responsável."],
    ["Posso cancelar quando quiser?", "Sim. Cancele a qualquer momento, sem multa. Seus dados ficam preservados caso queira voltar."],
    ["Posso ter mais de uma campanha?", "Sim, a partir do plano Inicial. No Profissional você tem até 5 campanhas ativas simultaneamente."],
    ["Funciona sem internet do cliente?", "No momento do carimbo, precisamos de internet. Mas a experiência é super leve — abre rapidinho em qualquer 3G."],
  ];
  return (
    <section id="faq" className="border-y bg-muted/40 py-24">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center font-display text-4xl font-bold">Dúvidas frequentes</h2>
        <Accordion type="single" collapsible className="mt-10">
          {qs.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger className="text-left font-medium">{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-4xl rounded-[2.5rem] gradient-brand p-12 text-center text-primary-foreground surface-glow">
        <h2 className="font-display text-4xl font-bold">Pronto para seus clientes voltarem sempre?</h2>
        <p className="mt-3 text-primary-foreground/80">Crie seu cartão fidelidade digital em minutos. Sem cartão de crédito.</p>
        <Button asChild size="lg" variant="secondary" className="mt-8">
          <Link to="/auth" search={{ mode: "signup" }}>Começar de graça agora <ArrowRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
        <Logo />
        <nav className="flex flex-wrap gap-6">
          <Link to="/precos">Preços</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/privacidade">Privacidade</Link>
        </nav>
        <div>© {new Date().getFullYear()} Fidelize</div>
      </div>
    </footer>
  );
}
