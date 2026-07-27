import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/preview-hero")({
  component: PreviewHero,
  head: () => ({
    meta: [
      { title: "Preview · Textos do topo | Fidelize" },
      { name: "description", content: "Três opções de copy para a hero da Fidelize: badge, título e subtítulo lado a lado." },
      { property: "og:title", content: "Preview · Textos do topo | Fidelize" },
      { property: "og:description", content: "Compare três direções de texto para o topo da landing da Fidelize." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const CYAN = "#00ffff";
const OBSIDIAN = "#050810";

type Variant = {
  id: string;
  name: string;
  note: string;
  badge: string;
  title: React.ReactNode;
  sub: string;
  cta: string;
  checks: [string, string];
};

const VARIANTS: Variant[] = [
  {
    id: "A",
    name: "Plataforma completa",
    note: "Posiciona a Fidelize como suíte, não só cartão. Bom para justificar preço.",
    badge: "1 plataforma · 10 ferramentas de retenção",
    title: (
      <>
        Tudo que seu negócio
        <br />
        precisa para o
        <br />
        <span style={{ color: CYAN, textShadow: `0 0 40px ${CYAN}55` }}>cliente voltar</span>.
      </>
    ),
    sub: "Fidelidade digital, cardápio, avaliações, QR Code, push e CRM — num só painel. Sem app, sem cartão de papel.",
    cta: "Começar grátis",
    checks: ["Sem cartão de crédito", "Configure em 5 minutos"],
  },
  {
    id: "B",
    name: "Foco em resultado",
    note: "Fala a língua do dono: faturamento. Mais comercial e direto.",
    badge: "9 funcionalidades · 1 assinatura",
    title: (
      <>
        Cliente que volta
        <br />
        custa <span style={{ color: CYAN, textShadow: `0 0 40px ${CYAN}55` }}>5x menos</span>
        <br />
        que cliente novo.
      </>
    ),
    sub: "A Fidelize cuida da retenção inteira do seu negócio — do carimbo à recompensa, do cardápio à avaliação.",
    cta: "Quero aumentar meu retorno",
    checks: ["Sem fidelidade forçada", "Cancele quando quiser"],
  },
  {
    id: "C",
    name: "Provocativo / simples",
    note: "Mais memorável e humano. Menos técnico, alto impacto no scroll.",
    badge: "9 funcionalidades incluídas",
    title: (
      <>
        Conquistar cliente é caro.
        <br />
        Fazer voltar é{" "}
        <span style={{ color: CYAN, textShadow: `0 0 40px ${CYAN}55` }}>barato</span>.
      </>
    ),
    sub: "Cartão digital, cardápio, avaliações e notificações no celular do seu cliente. Pronto em 5 minutos.",
    cta: "Criar meu cartão grátis",
    checks: ["Sem app para baixar", "Funciona offline"],
  },
];

function HeroPreview({ v }: { v: Variant }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{ background: OBSIDIAN, borderColor: "rgba(255,255,255,0.08)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 50% at 50% 0%, ${CYAN}18, transparent 70%)`,
        }}
      />
      <div className="relative z-10 flex flex-col items-center px-6 py-14 text-center text-white">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: `${CYAN}14`, border: `1px solid ${CYAN}55`, color: CYAN }}
        >
          <Sparkles className="h-3 w-3" /> {v.badge}
        </span>
        <h2 className="mt-5 font-display text-3xl font-extrabold leading-[1.15] tracking-tight">
          {v.title}
        </h2>
        <p className="mt-4 max-w-sm text-sm text-white/70">{v.sub}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            className="font-bold hover:brightness-110"
            style={{ background: CYAN, color: OBSIDIAN, boxShadow: `0 0 30px ${CYAN}55` }}
          >
            {v.cta} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            Ver como funciona
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-5 text-xs text-white/60">
          {v.checks.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <Check className="h-4 w-4" style={{ color: CYAN }} /> {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewHero() {
  return (
    <main className="min-h-screen" style={{ background: "#03060c" }}>
      <div className="mx-auto max-w-[1400px] px-6 py-10 text-white">
        <header className="mb-8">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: `${CYAN}b3` }}>
            Preview · Copy do topo
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
            Três direções de texto para a hero
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/50">
            Mesmo layout da landing, só o texto muda. Me diga A, B ou C (ou uma mistura) que eu aplico na home.
          </p>
          <Link to="/" className="mt-3 inline-block text-xs underline text-white/50 hover:text-white">
            ← voltar para a home atual
          </Link>
        </header>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {VARIANTS.map((v) => (
            <div key={v.id} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <span
                  className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ background: `${CYAN}14`, color: CYAN, border: `1px solid ${CYAN}40` }}
                >
                  Opção {v.id}
                </span>
                <span className="text-sm font-semibold">{v.name}</span>
              </div>
              <HeroPreview v={v} />
              <p className="text-xs text-white/50">{v.note}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
