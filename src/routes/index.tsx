import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { StampCard } from "@/components/StampCard";
import { HeroStampCardLoop } from "@/components/HeroStampCardLoop";
import { SegmentsCarousel } from "@/components/SegmentsCarousel";
import { CursorTrail } from "@/components/CursorTrail";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, QrCode, Smartphone, ShieldCheck, BarChart3, Sparkles, Coffee, Scissors, Pizza, ShoppingBag, Wrench, IceCream, Store, PawPrint, Check, Cake, Clock, UserPlus, Crown, Gift, MessageCircle, Bell, Mail, Sprout, Zap, Building2, type LucideIcon } from "lucide-react";
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rect = wrap.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const raw = Math.min(1, Math.max(0, -rect.top / Math.max(1, total)));
        // Anima até 70% e segura no 100% pelos 30% restantes para o usuário
        // ver a cena totalmente montada antes de sair para a próxima âncora.
        // Anima até 45% do scroll e segura totalmente montado nos 55% restantes.
        const p = Math.min(1, raw / 0.45);
        stage.style.setProperty("--p", String(p));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pains = [
    "Cartão perdido",
    "Carimbo falso",
    "Zero dados do cliente",
    "Custo de reimpressão",
  ];
  const wins = [
    "100% na nuvem",
    "Anti-fraude nativo",
    "CRM + campanhas",
    "Zero custo por cartão",
  ];

  return (
    <section id="comparativo" className="relative bg-[#08090f]">
      <div ref={wrapRef} className="relative h-[480vh]">
        <div
          ref={stageRef}
          className="tear-stage sticky top-0 flex h-screen items-center overflow-hidden"
          style={{ ["--p" as never]: 0 }}
        >
          {/* Ambient glows */}
          <div aria-hidden className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-cyan-500/[0.06] blur-[120px]" />
          <div aria-hidden className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full blur-[120px]" style={{ background: "rgba(255,43,214,0.05)" }} />

          <div className="mx-auto w-full max-w-6xl px-6">
            <div className="mb-10 text-center md:mb-14">
              <span className="font-display text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "#00ffff" }}>
                Papel × Fidelize
              </span>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                O papel rasga. O digital escala.
              </h2>
              <p className="mt-4 text-white/60">Role para ver o que muda quando você troca o cartão de papel.</p>
            </div>

            {/* Stage: two cards stacked in the same slot */}
            <div className="tear-scene relative mx-auto h-[380px] w-full max-w-[720px] md:h-[440px]">
              {/* Digital card underneath */}
              <div className="tear-digital absolute inset-0 grid place-items-center">
                <div className="relative w-[86%] max-w-[520px] overflow-hidden rounded-3xl border border-cyan-400/40 p-6 md:p-8"
                  style={{
                    background: "linear-gradient(135deg, #0a1420 0%, #0d1a28 50%, #0a0f1a 100%)",
                    boxShadow: "0 40px 120px -20px rgba(0,255,255,0.45), 0 20px 60px -10px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-400/40 bg-cyan-400/10">
                        <Sparkles className="h-4 w-4" style={{ color: "#00ffff" }} />
                      </div>
                      <span className="font-display text-sm font-bold uppercase tracking-widest text-white">Fidelize</span>
                    </div>
                    <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#00ffff" }}>
                      Ativo
                    </span>
                  </div>
                  <div className="mt-5 grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className={`aspect-square rounded-xl border ${i < 7 ? "border-cyan-400/60 bg-cyan-400/15" : "border-white/10 bg-white/[0.02]"}`}
                        style={i < 7 ? { boxShadow: "0 0 18px rgba(0,255,255,0.35)" } : undefined}
                      >
                        {i < 7 && <div className="grid h-full w-full place-items-center"><Check className="h-4 w-4" style={{ color: "#00ffff" }} /></div>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs">
                    <span className="text-white/60">7 / 10 carimbos</span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-white/70">Cliente Ana Souza</span>
                  </div>
                </div>

                {/* Wins flying in */}
                {wins.map((w, i) => (
                  <span
                    key={w}
                    className="tear-win absolute rounded-full border border-cyan-400/40 bg-black/40 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur"
                    style={{
                      ["--i" as never]: i,
                      boxShadow: "0 0 24px rgba(0,255,255,0.25)",
                      color: "#e6ffff",
                    } as never}
                  >
                    <Check className="mr-1 inline h-3 w-3" style={{ color: "#00ffff" }} /> {w}
                  </span>
                ))}
              </div>

              {/* Paper card on top — splits in two halves */}
              <div className="tear-paper absolute inset-0 grid place-items-center">
                <div className="relative w-[86%] max-w-[560px]" style={{ height: 340 }}>
                  {/* Pains — margin notes in black ink, off-card */}
                  {pains.map((p, i) => (
                    <span
                      key={p}
                      className="tear-pain absolute z-20 whitespace-nowrap text-[13px] font-semibold text-white/85"
                      style={{
                        ["--i" as never]: i,
                        fontFamily: "'Caveat', 'Segoe Script', cursive",
                        textShadow: "0 1px 8px rgba(0,0,0,0.6)",
                      } as never}
                    >
                      <span className="mr-1 text-red-400">✗</span>
                      <span className="line-through decoration-red-400/80 decoration-2">{p}</span>
                    </span>
                  ))}
                  <PaperHalf side="left" />
                  <PaperHalf side="right" />
                </div>
              </div>
            </div>

            {/* CTA reveal at the end */}
            <div className="tear-cta mt-8 flex flex-col items-center gap-3 text-center md:mt-12">
              <p className="max-w-xl text-white/70">
                Chega de cartão perdido, carimbo torto e cliente esquecido. Ative o Fidelize em minutos.
              </p>
              <Button asChild size="lg" className="tear-cta-btn rounded-full px-8 font-bold" style={{ background: "#00ffff", color: "#001010" }}>
                <Link to="/auth">
                  Começar grátis <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InkStamp({ filled, rot, smudge }: { filled: boolean; rot: number; smudge?: boolean }) {
  // Realistic hand-inked circular stamp (coffee cup) — heavy on filled, empty ring otherwise
  return (
    <div
      className="relative grid h-12 w-12 place-items-center rounded-full"
      style={{
        transform: `rotate(${rot}deg)`,
        border: filled ? "2.5px solid #0a0a0a" : "2px dashed rgba(10,10,10,0.55)",
        boxShadow: filled
          ? "inset 0 0 0 1px rgba(0,0,0,0.35), 0 1px 0 rgba(0,0,0,0.15)"
          : "none",
        background: filled
          ? "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 55%), rgba(10,10,10,0.06)"
          : "transparent",
        filter: filled ? "url(#inkbleed)" : "none",
      }}
    >
      {filled ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z" />
          <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
          <path d="M7 3c.5 1-.5 2 0 3M11 3c.5 1-.5 2 0 3M15 3c.5 1-.5 2 0 3" />
        </svg>
      ) : (
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40">nº</span>
      )}
      {smudge && filled && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-3 top-3 h-3 w-6 rounded-full"
          style={{ background: "rgba(10,10,10,0.35)", filter: "blur(2px)", transform: `rotate(${rot + 20}deg)` }}
        />
      )}
    </div>
  );
}

function PaperHalf({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  // Jagged tear edge — irregular fibers on the inner side of each half
  const tearLeft =
    "polygon(0 0, 100% 0, 97% 3%, 99% 7%, 95% 12%, 98% 18%, 93% 23%, 99% 29%, 94% 35%, 100% 41%, 93% 47%, 99% 53%, 94% 59%, 100% 65%, 93% 71%, 98% 77%, 94% 83%, 99% 89%, 95% 95%, 98% 100%, 0 100%)";
  const tearRight =
    "polygon(0 0, 100% 0, 100% 100%, 2% 100%, 5% 95%, 1% 89%, 6% 83%, 2% 77%, 7% 71%, 0 65%, 6% 59%, 1% 53%, 7% 47%, 0 41%, 6% 35%, 1% 29%, 7% 23%, 2% 18%, 5% 12%, 1% 7%, 3% 3%)";

  // 10-stamp grid split 5/5 across halves. 7 filled = 7 carimbos torto
  // Left: stamps 1..5 (all filled). Right: stamps 6..10 (6-7 filled, 8-10 empty)
  const leftStamps: Array<{ filled: boolean; rot: number; smudge?: boolean }> = [
    { filled: true, rot: -8, smudge: true },
    { filled: true, rot: 6 },
    { filled: true, rot: -3 },
    { filled: true, rot: 11, smudge: true },
    { filled: true, rot: -6 },
  ];
  const rightStamps: Array<{ filled: boolean; rot: number; smudge?: boolean }> = [
    { filled: true, rot: 4 },
    { filled: true, rot: -9, smudge: true },
    { filled: false, rot: 2 },
    { filled: false, rot: -4 },
    { filled: false, rot: 7 },
  ];
  const stamps = isLeft ? leftStamps : rightStamps;

  return (
    <div
      className={`tear-half tear-half-${side} absolute top-0 h-full w-1/2 ${isLeft ? "left-0" : "right-0"}`}
      style={{
        background:
          // Paper fibers noise + subtle cream tint (kraft-like) so it doesn't look sterile
          "repeating-linear-gradient(92deg, rgba(0,0,0,0.018) 0 1px, transparent 1px 3px), repeating-linear-gradient(6deg, rgba(0,0,0,0.014) 0 1px, transparent 1px 4px), radial-gradient(ellipse at 30% 20%, rgba(0,0,0,0.05), transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(0,0,0,0.06), transparent 65%), linear-gradient(180deg, #fbfaf5 0%, #f2ede0 100%)",
        boxShadow:
          "0 30px 60px -20px rgba(0,0,0,0.6), inset 0 0 40px rgba(80,60,20,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        color: "#0a0a0a",
        transformOrigin: isLeft ? "right center" : "left center",
        clipPath: isLeft ? tearLeft : tearRight,
        borderRadius: isLeft ? "14px 0 0 14px" : "0 14px 14px 0",
      }}
    >
      {/* SVG filter for ink bleed effect */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <filter id="inkbleed">
          <feGaussianBlur stdDeviation="0.35" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 12 -5" />
        </filter>
      </svg>

      {/* Torn edge shading */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-6 z-10"
        style={{
          [isLeft ? "right" : "left"]: 0,
          background: isLeft
            ? "linear-gradient(90deg, transparent, rgba(0,0,0,0.22))"
            : "linear-gradient(-90deg, transparent, rgba(0,0,0,0.22))",
          mixBlendMode: "multiply",
        }}
      />
      {/* Torn fiber highlights */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-[3px] z-10"
        style={{
          [isLeft ? "right" : "left"]: 0,
          background:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.9) 0 1px, rgba(0,0,0,0.2) 1px 2px, transparent 2px 5px)",
        }}
      />
      {/* Fold crease across the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.15), transparent)" }}
      />

      <div className="relative h-full w-full p-5" style={{ fontFamily: "'Caveat', 'Segoe Script', cursive" }}>
        {isLeft ? (
          <>
            <div className="font-display text-[11px] font-black uppercase tracking-[0.2em] text-black/85">Cartão Fidelidade</div>
            <div className="mt-0.5 text-[13px] italic text-black/70">Café do Zé — desde 2011</div>
            <div className="mt-1 text-[11px] text-black/55">A cada 10 cafés, o próximo é por nossa conta ☕</div>
          </>
        ) : (
          <div className="flex items-start justify-between">
            <div className="text-[12px] italic text-black/60">Cliente: <span className="font-bold text-black/80">Ana S.</span></div>
            <div className="-mt-1 rotate-6 rounded border-2 border-dashed border-black/75 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-black">
              10 = grátis
            </div>
          </div>
        )}

        {/* Stamp grid — 5 stamps per half in a single row spanning both halves visually */}
        <div className="absolute inset-x-4 bottom-16 flex items-center justify-between">
          {stamps.map((s, i) => (
            <InkStamp key={i} filled={s.filled} rot={s.rot} smudge={s.smudge} />
          ))}
        </div>

        {/* Numbered slots under stamps */}
        <div className="absolute inset-x-4 bottom-9 flex items-center justify-between">
          {stamps.map((_, i) => (
            <span key={i} className="w-12 text-center text-[10px] font-bold text-black/45">
              {(isLeft ? i + 1 : i + 6).toString().padStart(2, "0")}
            </span>
          ))}
        </div>

        {isLeft ? (
          <>
            {/* Coffee ring stain */}
            <div
              aria-hidden
              className="absolute -left-2 bottom-2 h-16 w-16 rounded-full"
              style={{
                border: "3px solid rgba(107,58,30,0.35)",
                boxShadow: "inset 0 0 10px rgba(107,58,30,0.2)",
                transform: "rotate(-8deg) scale(0.9, 1)",
                filter: "blur(0.4px)",
              }}
            />
            {/* Small ink splash */}
            <div
              aria-hidden
              className="absolute right-8 top-4 h-2 w-2 rounded-full"
              style={{ background: "rgba(10,10,10,0.55)", filter: "blur(0.4px)" }}
            />
          </>
        ) : (
          <>
            {/* Tape at top edge */}
            <div
              aria-hidden
              className="absolute -right-3 top-4 h-5 w-20 rotate-12"
              style={{
                background: "linear-gradient(180deg, rgba(240,235,215,0.85), rgba(220,215,195,0.7))",
                boxShadow: "0 1px 4px rgba(0,0,0,0.2), inset 0 0 8px rgba(255,255,255,0.4)",
              }}
            />
            {/* Handwritten complaint */}
            <div className="absolute bottom-2 right-4 text-[15px] italic text-black/85" style={{ transform: "rotate(-3deg)" }}>
              "perdi um... hehe"
            </div>
            {/* Coffee droplet */}
            <div
              aria-hidden
              className="absolute right-16 top-10 h-3 w-3 rounded-full"
              style={{ background: "rgba(107,58,30,0.45)", filter: "blur(0.5px)" }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Examples() {
  const items: Array<{ icon: typeof Cake; title: string; desc: string; kpi: string; kpiLabel: string; channel: string; channelIcon: typeof MessageCircle; featured?: boolean }> = [
    { icon: Cake, title: "Aniversariante do mês", desc: "Mimo automático 3 dias antes.", kpi: "+38%", kpiLabel: "retorno", channel: "WhatsApp", channelIcon: MessageCircle, featured: true },
    { icon: UserPlus, title: "Indique e ganhe", desc: "QR próprio do cliente. Todo mundo ganha.", kpi: "4.1x", kpiLabel: "CAC menor", channel: "QR + Wpp", channelIcon: QrCode, featured: true },
    { icon: Clock, title: "Reengajar inativos", desc: "15 dias sem visita? Dispara empurrão.", kpi: "2.4x", kpiLabel: "LTV", channel: "WhatsApp", channelIcon: MessageCircle },
    { icon: Sparkles, title: "1º carimbo grátis", desc: "Ativação imediata do cliente novo.", kpi: "73%", kpiLabel: "ativação", channel: "E-mail", channelIcon: Mail },
    { icon: Crown, title: "Níveis VIP", desc: "Bronze, Prata, Ouro com benefícios.", kpi: "+62%", kpiLabel: "frequência", channel: "Push", channelIcon: Bell },
  ];


  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-[oklch(0.14_0.02_230)] py-20">
      <div className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 40% at 20% 10%, rgba(0,255,255,0.08), transparent 60%), radial-gradient(50% 40% at 85% 90%, rgba(255,43,214,0.08), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#00ffff" }}>
            <Sparkles className="h-3 w-3" /> Templates prontos
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold text-white md:text-4xl">
            Campanhas <span style={{ color: "#00ffff" }}>que funcionam</span>
          </h2>
          <p className="mt-3 text-sm text-white/60">5 templates prontos. Ative em 1 clique.</p>
        </div>

        {/* Uniform 5-up strip — desktop 5 cols, tablet 2/3, mobile 1 */}
        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((it) => {
            const Icon = it.icon;
            const ChannelIcon = it.channelIcon;
            return (
              <article
                key={it.title}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-1 ${
                  it.featured
                    ? "border-cyan-400/30 bg-gradient-to-br from-cyan-500/[0.08] to-white/[0.02] hover:border-cyan-400/60"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
                style={
                  it.featured
                    ? { boxShadow: "0 20px 60px -25px rgba(0,255,255,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" }
                    : { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }
                }
              >
                {it.featured && (
                  <span className="absolute right-3 top-3 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: "#00ffff" }}>
                    Destaque
                  </span>
                )}
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
                  <Icon className="h-5 w-5" style={{ color: "#00ffff" }} />
                </div>
                <h3 className="mt-4 font-display text-base font-bold leading-tight text-white">{it.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-white/55">{it.desc}</p>

                <div className="mt-4 border-t border-white/5 pt-3">
                  <div className="metric-number text-2xl leading-none">{it.kpi}</div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/45">{it.kpiLabel}</span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-white/55">
                    <ChannelIcon className="h-3 w-3" style={{ color: "#00ffff" }} /> {it.channel}
                  </span>
                  <Link to="/auth" aria-label={`Usar template ${it.title}`} className="inline-flex items-center gap-1 text-[11px] font-bold transition-transform group-hover:translate-x-0.5" style={{ color: "#00ffff" }}>
                    Usar <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mx-auto mt-10 flex flex-col items-center gap-2 text-center">
          <Button asChild size="lg" className="rounded-full px-8 font-bold" style={{ background: "#00ffff", color: "#001010" }}>
            <Link to="/auth">
              Ativar campanhas grátis <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <p className="text-[11px] uppercase tracking-widest text-white/40">
            <Gift className="mr-1 inline h-3 w-3" style={{ color: "#00ffff" }} /> 14 dias grátis · sem cartão
          </p>
        </div>
      </div>
    </section>
  );
}




type Plan = {
  name: string;
  short: string;
  price: string;
  numeric: number;
  desc: string;
  tagline: string;
  features: string[];
  cta: string;
  badge?: string;
  icon: LucideIcon;
};

function Pricing() {
  const plans: Plan[] = [
    { name: "Gratuito", short: "Grátis", price: "R$ 0", numeric: 0, desc: "Para começar a testar", tagline: "Ideal pra validar a ideia sem risco.", features: ["Até 100 clientes", "1 campanha ativa", "1 funcionário", "Relatórios básicos"], cta: "Começar grátis", icon: Sprout },
    { name: "Inicial", short: "Inicial", price: "R$ 49", numeric: 49, desc: "Para o dia a dia", tagline: "Perfeito pra pequenos negócios que já vendem todo dia.", features: ["Até 1.000 clientes", "2 campanhas ativas", "3 funcionários", "Exportação de dados", "Suporte por e-mail"], cta: "Começar agora", icon: Zap },
    { name: "Profissional", short: "Pro", price: "R$ 129", numeric: 129, desc: "Para negócios em crescimento", tagline: "O favorito de quem quer escalar retenção com automações.", features: ["Até 10.000 clientes", "5 campanhas ativas", "10 funcionários", "Segmentação e relatórios avançados", "Sem marca Fidelize"], cta: "Começar agora", badge: "Mais popular", icon: Sparkles },
    { name: "Empresarial", short: "Corp", price: "R$ 349", numeric: 349, desc: "Para redes e franquias", tagline: "Multi-unidade, SLA e time de suporte dedicado.", features: ["Clientes ilimitados", "Multi-unidade", "Suporte prioritário 24/7", "Limites personalizados", "Gerente de contas"], cta: "Falar com vendas", icon: Building2 },
  ];

  const [activeIdx, setActiveIdx] = useState(2);
  const [prevIdx, setPrevIdx] = useState(2);
  const [shockKey, setShockKey] = useState(0);
  const active = plans[activeIdx];
  const ActiveIcon = active.icon;
  const direction = activeIdx >= prevIdx ? "right" : "left";
  const selectPlan = (i: number) => {
    if (i === activeIdx) return;
    setPrevIdx(activeIdx);
    setActiveIdx(i);
    setShockKey((k) => k + 1);
  };

  return (
    <section id="precos" className="relative py-24 overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="mx-auto max-w-6xl px-4">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold">
            Planos <span style={{ color: "#00ffff" }}>simples</span> e transparentes
          </h2>
          <p className="mt-3 text-muted-foreground">Escolha na dock abaixo. O plano em destaque troca ao vivo.</p>
        </div>

        {/* Featured card */}
        <div className="mt-14 flex justify-center">
          <div key={active.name} className={`relative w-full max-w-md ${direction === "right" ? "plan-swap-right" : "plan-swap-left"}`}>
            {/* expanding halo on swap */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-primary/20 blur-3xl plan-halo" />
            {/* LED breathing gradient border */}
            <div className="relative rounded-[2rem] p-[2px] bg-gradient-to-b from-[#00ffff] via-[#00ffff]/20 to-transparent shadow-[0_0_40px_rgba(0,255,255,0.15)]">
              <div className="rounded-[calc(2rem-2px)] bg-card p-8 md:p-10 relative overflow-hidden plan-sweep">
                <div className="relative flex items-start justify-between">
                  <div>
                    {active.badge && (
                      <span className="mb-2 inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        {active.badge}
                      </span>
                    )}
                    <h3 className="font-display text-4xl font-bold">{active.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground max-w-xs">{active.tagline}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shrink-0">
                    <ActiveIcon className="h-6 w-6" />
                  </div>
                </div>

                {/* price */}
                <div className="mt-8 flex items-baseline gap-2">
                  <span className="font-display text-6xl font-extrabold tracking-tight" style={{ textShadow: "0 0 20px rgba(0,255,255,0.35)" }}>
                    {active.price}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>

                {/* features */}
                <ul className="mt-8 space-y-4">
                  {active.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button asChild size="lg" className="mt-10 w-full">
                  <Link to="/auth" search={{ mode: "signup" }}>{active.cta}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Object Dock */}
        <div className="mt-12 flex justify-center">
          <div className="flex items-end gap-3 rounded-[28px] border border-white/10 bg-white/5 p-3 backdrop-blur-2xl shadow-2xl">
            {plans.map((p, i) => {
              const Icon = p.icon;
              const isActive = i === activeIdx;
              return (
                <div key={p.name} className="group relative">
                  {/* tooltip */}
                  <div
                    className={`absolute -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 px-3 py-1 text-[10px] font-semibold transition-opacity ${
                      isActive ? "opacity-100 border-primary/30 bg-primary/10 text-primary" : "opacity-0 group-hover:opacity-100 bg-black/80 text-white"
                    }`}
                  >
                    {p.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-pressed={isActive}
                    aria-label={p.name}
                    className={`flex flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      isActive
                        ? "h-16 w-16 -translate-y-2 border-primary/40 bg-primary/10 text-primary shadow-[0_0_24px_rgba(0,255,255,0.25)]"
                        : "h-14 w-14 border-white/10 bg-white/5 text-muted-foreground hover:-translate-y-3 hover:scale-110 hover:border-white/25 hover:bg-white/10 hover:text-foreground"
                    }`}
                  >
                    <Icon className={isActive ? "h-7 w-7" : "h-6 w-6"} />
                    {isActive && (
                      <span className="absolute -bottom-1.5 h-1 w-1 rounded-full bg-primary shadow-[0_0_8px_#00ffff]" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* trust line */}
        <p className="mt-8 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
          14 dias grátis · sem cartão · cancele quando quiser
        </p>
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
