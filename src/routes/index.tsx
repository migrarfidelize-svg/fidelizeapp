import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { StampCard } from "@/components/StampCard";
import { HeroStampCardLoop } from "@/components/HeroStampCardLoop";
import { SegmentsCarousel } from "@/components/SegmentsCarousel";
import { CursorTrail } from "@/components/CursorTrail";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, QrCode, Smartphone, ShieldCheck, BarChart3, Sparkles, Coffee, Scissors, Pizza, ShoppingBag, Wrench, IceCream, Store, PawPrint, Check } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SITE_URL = "https://warm-hug-genie.lovable.app";
const PAGE_TITLE = "Fidelize — Cartão fidelidade digital para clientes fiéis";
const PAGE_DESC = "Crie cartões fidelidade digitais com QR Code, painel de análise em tempo real e campanhas que fazem seus clientes voltarem sempre. Comece grátis hoje.";

const FAQ_ITEMS: Array<[string, string]> = [
  ["Meu cliente precisa baixar um app?", "Não. Tudo funciona direto pelo navegador do celular. Ele escaneia o QR Code, informa nome e telefone e já sai com o cartão pronto."],
  ["Como impedir que o cliente carimbe sozinho?", "Somente sua equipe autenticada pode adicionar carimbos. Cada ação fica registrada com data, hora e nome do funcionário responsável."],
  ["Posso cancelar quando quiser?", "Sim. Cancele a qualquer momento, sem multa. Seus dados ficam preservados caso queira voltar."],
  ["Posso ter mais de uma campanha?", "Sim, a partir do plano Inicial. No Profissional você tem até 5 campanhas ativas simultaneamente."],
  ["Funciona sem internet do cliente?", "No momento do carimbo, precisamos de internet. Mas a experiência é super leve — abre rapidinho em qualquer 3G."],
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESC },
      { name: "keywords", content: "cartão fidelidade digital, programa de fidelidade, QR Code, fidelização de clientes, PME, cafeteria, barbearia" },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { property: "og:site_name", content: "Fidelize" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: "Fidelize", url: SITE_URL, logo: `${SITE_URL}/favicon.ico` },
            { "@type": "WebSite", name: "Fidelize", url: SITE_URL, inLanguage: "pt-BR" },
            {
              "@type": "SoftwareApplication",
              name: "Fidelize",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQ_ITEMS.map(([q, a]) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <Segments />
        <HowItWorks />
        <Benefits />
        <Comparison />
        <Examples />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
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
          <ThemeToggle />
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
  const CYAN = "#00ffff";
  const OBSIDIAN = "#020617";
  return (
    <section className="relative overflow-hidden" style={{ background: OBSIDIAN }}>
      {/* Fixed-color ambient — no gradients on text/CTA */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            `radial-gradient(ellipse at 20% 10%, ${CYAN}22, transparent 55%),` +
            `radial-gradient(ellipse at 80% 90%, ${CYAN}18, transparent 60%)`,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            `linear-gradient(${CYAN} 1px, transparent 1px), linear-gradient(90deg, ${CYAN} 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
        }}
      />
      <CursorTrail />
      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div className="text-white">
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: `${CYAN}14`, border: `1px solid ${CYAN}55`, color: CYAN }}
          >
            <Sparkles className="h-3 w-3" /> Cartão fidelidade digital para o seu negócio
          </span>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            Transforme visitantes em{" "}
            <span style={{ color: CYAN, textShadow: `0 0 40px ${CYAN}55` }}>clientes fiéis</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/70">
            Crie seu cartão fidelidade digital, compartilhe por QR Code e faça seus clientes voltarem mais vezes. Sem aplicativo, sem cartão de papel.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="font-bold hover:brightness-110 transition-all"
              style={{ background: CYAN, color: OBSIDIAN, boxShadow: `0 0 30px ${CYAN}55` }}
            >
              <Link to="/auth" search={{ mode: "signup" }}>
                Criar meu cartão grátis <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-white/20 hover:bg-white/10 hover:text-white"
            >
              <a href="#como-funciona">Ver como funciona</a>
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-6 text-xs text-white/60">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4" style={{ color: CYAN }} /> Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4" style={{ color: CYAN }} /> Configure em 5 minutos
            </span>
          </div>
        </div>
        <div className="relative flex justify-center">
          <HeroStampCardLoop />
        </div>
      </div>
    </section>
  );
}

function Segments() {
  return (
    <section id="segmentos" className="border-y bg-background py-20">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Feito para</div>
        <h2 className="mt-2 font-display text-3xl font-bold md:text-4xl">Negócios que vivem de clientes que voltam</h2>
        <div className="mt-14">
          <SegmentsCarousel />
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Crie seu cartão",
      desc: "Escolha suas cores, adicione sua logo e defina a recompensa que seus clientes vão amar.",
      color: "#00ffff",
    },
    {
      n: "02",
      title: "Compartilhe o QR",
      desc: "Coloque o QR Code no seu balcão ou envie o link. O cliente escaneia e já sai com o cartão no celular.",
      color: "#ff2bd6",
    },
    {
      n: "03",
      title: "Carimbe e fidelize",
      desc: "A cada visita, você escaneia o cartão dele. Ele acumula, ganha e volta sempre.",
      color: "#a855f7",
    },
  ];

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;

    const cards = Array.from(stage.querySelectorAll<HTMLElement>(".hiw-node"));
    const links = Array.from(stage.querySelectorAll<SVGPathElement>(".hiw-link path.hiw-link-main"));
    const roots = Array.from(stage.querySelectorAll<SVGGElement>(".hiw-link g.hiw-root"));
    const heads = Array.from(stage.querySelectorAll<SVGCircleElement>(".hiw-link circle.hiw-head"));
    const badge = stage.querySelector<HTMLElement>(".hiw-finish-badge");

    // pre-compute path lengths (fallback 700)
    const lengths = links.map((p) => {
      try { return p.getTotalLength(); } catch { return 700; }
    });
    links.forEach((p, i) => {
      p.style.strokeDasharray = String(lengths[i]);
      p.style.strokeDashoffset = String(lengths[i]);
    });

    const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    let raf = 0;
    const tick = () => {
      raf = 0;
      const rect = wrap.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const scrollable = Math.max(1, rect.height - vh);
      const p = clamp(-rect.top / scrollable);

      const c1 = ease(clamp(p / 0.08));
      const c2 = ease(clamp((p - 0.28) / 0.14));
      const c3 = ease(clamp((p - 0.62) / 0.14));
      const cardProgress = [c1, c2, c3];
      cards.forEach((el, i) => {
        const v = cardProgress[i] ?? 0;
        el.style.opacity = String(v);
        el.style.transform = `translateY(${(1 - v) * 28}px)`;
        el.style.filter = `blur(${(1 - v) * 6}px)`;
      });

      const l1 = ease(clamp((p - 0.10) / 0.22));
      const l2 = ease(clamp((p - 0.44) / 0.22));
      const lineProgress = [l1, l2];
      links.forEach((path, i) => {
        const v = lineProgress[i] ?? 0;
        const len = lengths[i];
        path.style.strokeDashoffset = String(len * (1 - v));
        path.style.opacity = String(clamp(v * 1.6));

        // moving glowing head at the tip
        const head = heads[i];
        if (head) {
          if (v > 0.001 && v < 0.999) {
            const pt = path.getPointAtLength(len * v);
            head.setAttribute("cx", String(pt.x));
            head.setAttribute("cy", String(pt.y));
            head.style.opacity = "1";
          } else {
            head.style.opacity = "0";
          }
        }

        // root branches: fade in after main line arrives
        const root = roots[i];
        if (root) {
          const rv = clamp((v - 0.85) / 0.15);
          root.style.opacity = String(rv);
          root.style.transform = `scale(${0.6 + rv * 0.4})`;
        }
      });

      if (p >= 0.82) {
        stage.classList.add("hiw-complete");
        if (badge) badge.style.opacity = "1";
      } else {
        stage.classList.remove("hiw-complete");
        if (badge) badge.style.opacity = "0";
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section id="como-funciona" className="relative">
      {/* Tall wrapper drives scroll progress; inner stage is sticky/pinned */}
      <div ref={wrapRef} className="relative h-[260vh] md:h-[280vh]">
        <div ref={stageRef} className="sticky top-0 flex h-screen items-center overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-cyan-500/5 blur-[120px]" />
          <div aria-hidden className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full blur-[120px]" style={{ background: "rgba(255,43,214,0.05)" }} />

          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mb-14 text-center">
              <span className="font-display text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#00ffff" }}>
                Fluxo de experiência
              </span>
              <h2 className="mt-3 font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                Três passos simples para seus clientes voltarem sempre
              </h2>
              <p className="mt-4 text-white/60">Do primeiro cadastro à recompensa, tudo funciona pelo navegador.</p>
            </div>

            <div className="relative grid gap-10 md:grid-cols-3 md:gap-6">
              {/* AI-style connectors between nodes (desktop only) */}
              <svg
                aria-hidden
                className="hiw-link pointer-events-none absolute inset-0 hidden h-full w-full md:block"
                viewBox="0 0 1000 400"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="hiwLinkA" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#00ffff" />
                    <stop offset="100%" stopColor="#ff2bd6" />
                  </linearGradient>
                  <linearGradient id="hiwLinkB" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#ff2bd6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                  <filter id="hiwGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {/* Link 1: 01 → 02 (endpoint ~500,110) */}
                <path
                  className="hiw-link-main"
                  d="M 260 110 C 340 110, 380 110, 500 110"
                  stroke="url(#hiwLinkA)"
                  strokeWidth="2.5"
                  fill="none"
                  filter="url(#hiwGlow)"
                  strokeLinecap="round"
                  style={{ opacity: 0 }}
                />
                <g className="hiw-root" style={{ opacity: 0, transformOrigin: "500px 110px" }}>
                  <path d="M 500 110 C 508 108, 514 100, 520 92" stroke="#ff2bd6" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                  <path d="M 500 110 C 508 112, 514 120, 520 128" stroke="#ff2bd6" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                  <path d="M 500 110 L 522 110" stroke="#ff2bd6" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                </g>
                <circle className="hiw-head" r="5" fill="#fff" filter="url(#hiwGlow)" style={{ opacity: 0 }} />

                {/* Link 2: 02 → 03 (endpoint ~833,110) */}
                <path
                  className="hiw-link-main"
                  d="M 594 110 C 700 110, 750 110, 833 110"
                  stroke="url(#hiwLinkB)"
                  strokeWidth="2.5"
                  fill="none"
                  filter="url(#hiwGlow)"
                  strokeLinecap="round"
                  style={{ opacity: 0 }}
                />
                <g className="hiw-root" style={{ opacity: 0, transformOrigin: "833px 110px" }}>
                  <path d="M 833 110 C 841 108, 847 100, 853 92" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                  <path d="M 833 110 C 841 112, 847 120, 853 128" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                  <path d="M 833 110 L 855 110" stroke="#a855f7" strokeWidth="1.5" fill="none" strokeLinecap="round" filter="url(#hiwGlow)" opacity="0.85" />
                </g>
                <circle className="hiw-head" r="5" fill="#fff" filter="url(#hiwGlow)" style={{ opacity: 0 }} />
              </svg>

              {steps.map((s, i) => (
                <div
                  key={s.n}
                  data-idx={i}
                  className="hiw-node hiw-card relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm"
                  style={{ ["--acc" as string]: s.color, opacity: 0, transform: "translateY(28px)", filter: "blur(6px)" }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="relative grid h-14 w-14 flex-none place-items-center rounded-xl border bg-[#050505]"
                      style={{ borderColor: `${s.color}55`, boxShadow: `0 0 20px ${s.color}33, inset 0 0 10px ${s.color}22` }}
                    >
                      <span className="font-display text-xl font-extrabold tracking-tighter" style={{ color: s.color }}>
                        {s.n}
                      </span>
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="absolute -left-[7px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-[#050505]"
                          style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
                        />
                      )}
                      {i < steps.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute -right-[7px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ring-2 ring-[#050505]"
                          style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
                        />
                      )}
                    </div>
                    <h3 className="font-display text-2xl font-bold tracking-tight text-white">{s.title}</h3>
                  </div>
                  <p className="mt-5 text-white/60 md:text-[15px]">{s.desc}</p>

                  {i === steps.length - 1 && (
                    <span
                      aria-hidden
                      className="hiw-finish-badge pointer-events-none absolute -top-3 right-4 rounded-full border border-cyan-400/40 bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300 opacity-0 transition-opacity duration-500"
                    >
                      Pronto ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


function Benefits() {
  const items = [
    { icon: Smartphone, title: "Sem app para baixar", desc: "Acesso direto pelo navegador. Zero atrito.", color: "#00ffff" },
    { icon: QrCode, title: "QR Code exclusivo", desc: "Cada empresa, campanha e cliente com ID seguro.", color: "#22d3ee" },
    { icon: ShieldCheck, title: "Anti-fraude", desc: "Só sua equipe carimba. Tudo registrado.", color: "#a855f7" },
    { icon: BarChart3, title: "Painel completo", desc: "Clientes, visitas, retorno e alertas num só lugar.", color: "#ff2bd6" },
    { icon: Sparkles, title: "Página personalizada", desc: "Sua marca, suas cores, sua vitrine digital.", color: "#f472b6" },
    { icon: Store, title: "Multi-unidade", desc: "Uma empresa, várias lojas. Relatórios consolidados.", color: "#60a5fa" },
  ];
  const N = items.length;

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,255,255,0.06),transparent_60%)]" />

      <div className="mx-auto max-w-6xl px-5 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.25em] md:text-xs" style={{ color: "#00ffff" }}>
            Ecossistema Fidelize
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            Tudo o que você precisa para fidelizar
          </h2>
          <p className="mt-3 text-sm text-white/60 md:text-base">Uma plataforma. Seis pilares girando em torno da sua marca.</p>
        </div>

        {/* ============ DESKTOP / TABLET: orbit stage ============ */}
        <div className="fz-orbit relative mx-auto mt-16 hidden aspect-square w-full max-w-[720px] md:block">
          {/* LED ring loops */}
          <div aria-hidden className="fz-ring fz-ring-1" />
          <div aria-hidden className="fz-ring fz-ring-2" />
          <div aria-hidden className="fz-ring fz-ring-3" />

          {/* Central logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 512 512" className="fz-core-mark h-56 w-56" aria-hidden="true">
              <defs>
                <linearGradient id="fzHeroCyan" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7dfcff" />
                  <stop offset="1" stopColor="#00ffff" />
                </linearGradient>
              </defs>
              <path d="M 384 256 A 128 128 0 1 1 256 128" fill="none" stroke="url(#fzHeroCyan)" strokeWidth="28" strokeLinecap="round" opacity="0.85" />
              <path d="M 236 108 L 268 128 L 236 148 Z" fill="url(#fzHeroCyan)" />
              <g fill="url(#fzHeroCyan)">
                <rect x="196" y="156" width="40" height="216" rx="12" />
                <rect x="196" y="156" width="140" height="40" rx="12" />
                <rect x="196" y="244" width="104" height="36" rx="10" />
              </g>
            </svg>
          </div>

          {/* n8n connector */}
          <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 720" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="fzLink" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#00ffff" />
                <stop offset="0.5" stopColor="#a855f7" />
                <stop offset="1" stopColor="#ff2bd6" />
              </linearGradient>
              <filter id="fzLinkGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="360" cy="360" r="260" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
            <circle cx="360" cy="360" r="260" fill="none" stroke="url(#fzLink)" strokeWidth="2.5" strokeLinecap="round" filter="url(#fzLinkGlow)" className="fz-n8n-run" />
          </svg>

          {/* Static chips positioned around */}
          <div className="absolute inset-0">
            {items.map((it, i) => {
              const angle = (360 / N) * i - 90;
              const Icon = it.icon;
              return (
                <div
                  key={it.title}
                  className="absolute left-1/2 top-1/2"
                  style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(calc(-1 * var(--fz-radius))) rotate(${-angle}deg)` }}
                >
                  <div className="fz-chip-static" style={{ ["--acc" as string]: it.color }}>
                    <div className="fz-chip">
                      <div className="fz-chip-icon" style={{ color: it.color, boxShadow: `0 0 22px ${it.color}55, inset 0 0 10px ${it.color}33`, borderColor: `${it.color}66` }}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="fz-chip-body">
                        <h3 className="font-display text-sm font-bold text-white">{it.title}</h3>
                        <p className="mt-0.5 text-[11px] leading-snug text-white/60">{it.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============ MOBILE: logo em destaque + grid 2 colunas ============ */}
        <div className="mt-10 md:hidden">
          {/* Centro: logo + rings + n8n */}
          <div className="relative mx-auto aspect-square w-full max-w-[280px]">
            <div aria-hidden className="fz-ring fz-ring-1" />
            <div aria-hidden className="fz-ring fz-ring-2" />
            <div aria-hidden className="fz-ring fz-ring-3" />
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 720 720">
              <circle cx="360" cy="360" r="300" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx="360" cy="360" r="300" fill="none" stroke="url(#fzLink)" strokeWidth="3" strokeLinecap="round" filter="url(#fzLinkGlow)" className="fz-n8n-run-mobile" />
              <defs>
                <linearGradient id="fzLink" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#00ffff" />
                  <stop offset="0.5" stopColor="#a855f7" />
                  <stop offset="1" stopColor="#ff2bd6" />
                </linearGradient>
                <filter id="fzLinkGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
            </svg>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <svg viewBox="0 0 512 512" className="fz-core-mark h-40 w-40" aria-hidden="true">
                <defs>
                  <linearGradient id="fzHeroCyanM" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#7dfcff" />
                    <stop offset="1" stopColor="#00ffff" />
                  </linearGradient>
                </defs>
                <path d="M 384 256 A 128 128 0 1 1 256 128" fill="none" stroke="url(#fzHeroCyanM)" strokeWidth="28" strokeLinecap="round" opacity="0.85" />
                <path d="M 236 108 L 268 128 L 236 148 Z" fill="url(#fzHeroCyanM)" />
                <g fill="url(#fzHeroCyanM)">
                  <rect x="196" y="156" width="40" height="216" rx="12" />
                  <rect x="196" y="156" width="140" height="40" rx="12" />
                  <rect x="196" y="244" width="104" height="36" rx="10" />
                </g>
              </svg>
            </div>
          </div>

          {/* Grid dos 6 pilares */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <div key={it.title} className="fz-chip" style={{ ["--acc" as string]: it.color }}>
                  <div className="fz-chip-icon shrink-0" style={{ color: it.color, boxShadow: `0 0 18px ${it.color}55, inset 0 0 8px ${it.color}33`, borderColor: `${it.color}66` }}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[13px] font-bold leading-tight text-white">{it.title}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-white/60">{it.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
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
  return (
    <section id="faq" className="border-y bg-muted/40 py-24">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-center font-display text-4xl font-bold">Dúvidas frequentes</h2>
        <Accordion type="single" collapsible className="mt-10">
          {FAQ_ITEMS.map(([q, a]) => (
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
