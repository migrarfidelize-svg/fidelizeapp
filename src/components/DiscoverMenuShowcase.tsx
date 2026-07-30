import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  QrCode, MapPin, UtensilsCrossed, Play, Heart, Star, Stamp,
  ArrowRight, Search, Flame, ChevronRight,
} from "lucide-react";

type Step = {
  id: string;
  label: string;
  title: string;
  desc: string;
  icon: typeof QrCode;
  duration: number;
};

const STEPS: Step[] = [
  {
    id: "scan",
    label: "Escaneia",
    title: "Um QR na mesa, zero app para baixar",
    desc: "O cliente aponta a câmera e cai direto na sua vitrine — sem download, sem cadastro chato.",
    icon: QrCode,
    duration: 4200,
  },
  {
    id: "discover",
    label: "Descobre",
    title: "Modo Descobrir: sua loja aparece para quem está perto",
    desc: "Perfil público com promoções ativas, avaliações reais e o botão de cardápio em destaque.",
    icon: MapPin,
    duration: 5200,
  },
  {
    id: "menu",
    label: "Cardápio",
    title: "Cardápio em stories — o prato se vende sozinho",
    desc: "Fotos e vídeos passam em tela cheia por categoria. Tamanhos, preços e detalhes num toque.",
    icon: UtensilsCrossed,
    duration: 5600,
  },
  {
    id: "loyal",
    label: "Volta",
    title: "Pediu uma vez? Carimbou. Voltou.",
    desc: "O carimbo entra na carteira digital em tempo real e a recompensa puxa a próxima visita.",
    icon: Stamp,
    duration: 4600,
  },
];

const DISHES = [
  { name: "Burger Trufado", price: "R$ 38,90", tag: "Mais pedido", hue: 18 },
  { name: "Pizza Nduja", price: "R$ 64,00", tag: "Novo", hue: 8 },
  { name: "Açaí 500g", price: "R$ 24,50", tag: "Combo", hue: 285 },
];

export function DiscoverMenuShowcase() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting && e.intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.6] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    startedAt.current = performance.now();
    let raf = 0;
    const dur = STEPS[active].duration;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startedAt.current) / dur);
      setProgress(p);
      if (p >= 1) {
        setActive((a) => (a + 1) % STEPS.length);
        setProgress(0);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, inView, paused]);

  const select = (i: number) => {
    setActive(i);
    setProgress(0);
  };

  const step = STEPS[active];

  return (
    <section
      ref={rootRef}
      id="descobrir-cardapio"
      className="relative overflow-hidden border-b bg-background py-16 md:py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 65%)" }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
        {/* ---------- left: narrative ---------- */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Flame className="h-3.5 w-3.5" /> Novo · Descobrir + Cardápio
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
            <span className="block text-balance">Da câmera do cliente até o</span>
            <span className="block text-balance">
              carimbo — <span className="text-primary">em 4 toques</span>
            </span>
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Acompanhe a jornada real: o QR vira vitrine, a vitrine vira cardápio em stories e o pedido vira
            cliente fiel. Toque em cada etapa para ver acontecer.
          </p>

          <ol className="mt-7 space-y-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => select(i)}
                    aria-current={isActive}
                    className={[
                      "group relative flex w-full items-start gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left transition-all",
                      isActive
                        ? "border-primary/40 bg-primary/[0.07] shadow-[0_0_30px_-14px_var(--primary)]"
                        : "border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors",
                        isActive
                          ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                          : "bg-muted text-muted-foreground group-hover:text-foreground",
                      ].join(" ")}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span className="font-mono text-[11px] text-primary/70">0{i + 1}</span>
                        {s.title}
                      </span>
                      <span
                        className={[
                          "mt-1 block text-xs text-muted-foreground transition-all",
                          isActive ? "opacity-100" : "opacity-70",
                        ].join(" ")}
                      >
                        {s.desc}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="absolute bottom-0 left-0 h-[2px] bg-primary transition-[width] duration-100"
                      style={{ width: isActive ? `${progress * 100}%` : "0%" }}
                    />
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="group">
              <Link to="/auth">
                Criar minha conta
                <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#precos">Ver planos</a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem app para o cliente · publica em minutos · funciona em qualquer celular
          </p>
        </div>

        {/* ---------- right: live phone ---------- */}
        <div className="relative mx-auto w-full max-w-[340px]">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 rounded-[46px] opacity-40 blur-2xl"
            style={{ background: "radial-gradient(circle at 50% 30%, var(--primary), transparent 70%)" }}
          />
          <div className="relative aspect-[9/19] overflow-hidden rounded-[38px] border border-white/10 bg-[oklch(0.16_0.02_230)] p-2 shadow-2xl">
            <div className="relative h-full w-full overflow-hidden rounded-[30px] bg-background">
              <div className="absolute left-1/2 top-2 z-30 h-5 w-24 -translate-x-1/2 rounded-full bg-black/70" />
              <PhoneScreen step={step.id} progress={progress} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => select(i)}
                aria-label={s.label}
                className={[
                  "h-1.5 rounded-full transition-all",
                  i === active ? "w-8 bg-primary" : "w-3 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                ].join(" ")}
              />
            ))}
          </div>
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {paused ? "Pausado — clique em uma etapa" : step.label}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PhoneScreen({ step, progress }: { step: string; progress: number }) {
  return (
    <div className="relative h-full w-full">
      <Screen show={step === "scan"}><ScanScreen /></Screen>
      <Screen show={step === "discover"}><DiscoverScreen /></Screen>
      <Screen show={step === "menu"}><MenuStoryScreen progress={progress} /></Screen>
      <Screen show={step === "loyal"}><LoyalScreen /></Screen>
    </div>
  );
}

function Screen({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={[
        "absolute inset-0 transition-all duration-500",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function ScanScreen() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 bg-[oklch(0.12_0.02_230)] px-6">
      <div className="relative grid h-40 w-40 place-items-center rounded-2xl border border-primary/30 bg-black/40">
        <QrCode className="h-20 w-20 text-primary/80" strokeWidth={1.2} />
        <span className="absolute inset-x-3 top-3 h-px animate-[fz-scan_2.2s_ease-in-out_infinite] bg-primary shadow-[0_0_16px_var(--primary)]" />
        {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((p) => (
          <span key={p} className={`absolute ${p} h-4 w-4 rounded-sm border-primary/70 border-2`} />
        ))}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-white">Aponte para o QR da mesa</div>
        <div className="mt-1 text-xs text-white/50">Nenhum app necessário</div>
      </div>
      <style>{`@keyframes fz-scan{0%{transform:translateY(0)}50%{transform:translateY(120px)}100%{transform:translateY(0)}}`}</style>
    </div>
  );
}

function DiscoverScreen() {
  const cards = [
    { name: "Burger do Léo", cat: "Hamburgueria · 400m", rating: "4,9", promo: "2ª bebida grátis" },
    { name: "Café da Praça", cat: "Cafeteria · 1,2km", rating: "4,8", promo: "10º café grátis" },
    { name: "Sushi Nakano", cat: "Japonês · 2,0km", rating: "5,0", promo: "Combo -15%" },
  ];
  return (
    <div className="h-full overflow-hidden bg-background pt-9">
      <div className="px-4">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" /> Descobrir perto de você
        </div>
        <div className="mt-3 flex gap-1.5 overflow-hidden">
          {["Tudo", "Comer", "Café", "Beleza"].map((c, i) => (
            <span
              key={c}
              className={[
                "rounded-full px-2.5 py-1 text-[10px] font-medium",
                i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 space-y-2.5 px-4">
        {cards.map((c, i) => (
          <div
            key={c.name}
            className="animate-[fz-rise_.5s_ease-out_both] rounded-xl border border-border bg-card p-3"
            style={{ animationDelay: `${i * 130}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold">{c.name}</div>
                <div className="text-[10px] text-muted-foreground">{c.cat}</div>
              </div>
              <div className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-400">
                <Star className="h-3 w-3 fill-current" /> {c.rating}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                {c.promo}
              </span>
              <span className="ml-auto flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">
                <UtensilsCrossed className="h-3 w-3" /> Cardápio
              </span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes fz-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function MenuStoryScreen({ progress }: { progress: number }) {
  const idx = useMemo(() => {
    const raw = Math.floor((Number.isFinite(progress) ? progress : 0) * DISHES.length);
    return Math.max(0, Math.min(DISHES.length - 1, raw));
  }, [progress]);
  const dish = DISHES[idx] ?? DISHES[0];
  const local = Math.max(0, Math.min(1, progress * DISHES.length - idx));
  return (
    <div className="relative h-full overflow-hidden">
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{
          background: `radial-gradient(120% 80% at 50% 20%, oklch(0.45 0.16 ${dish.hue}), oklch(0.14 0.03 ${dish.hue}) 70%)`,
        }}
      />
      <div className="absolute inset-x-3 top-8 z-20 flex gap-1">
        {DISHES.map((_, i) => (
          <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className="block h-full bg-white"
              style={{ width: i < idx ? "100%" : i === idx ? `${local * 100}%` : "0%" }}
            />
          </span>
        ))}
      </div>

      <div className="absolute inset-0 z-10 flex flex-col justify-end p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            {dish.tag}
          </span>
        </div>
        <div className="text-lg font-bold text-white drop-shadow">{dish.name}</div>
        <div className="mt-0.5 text-xs text-white/70">300g · 500g disponíveis</div>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-black">{dish.price}</span>
          <span className="flex items-center gap-1 rounded-lg border border-white/25 px-3 py-1.5 text-[11px] font-semibold text-white">
            Ver detalhes <ChevronRight className="h-3 w-3" />
          </span>
          <span className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur">
            <Heart className="h-4 w-4" />
          </span>
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 z-10 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm">
        <Play className="h-6 w-6 fill-current" />
      </div>
    </div>
  );
}

function LoyalScreen() {
  const [filled, setFilled] = useState(6);
  useEffect(() => {
    const t = setTimeout(() => setFilled(7), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-5 pt-8">
      <div className="w-full rounded-2xl border border-primary/25 bg-card p-4 shadow-[0_0_40px_-20px_var(--primary)]">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold">Burger do Léo</div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-semibold text-primary">Ouro</span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <span
              key={i}
              className={[
                "grid aspect-square place-items-center rounded-lg border text-[10px] transition-all duration-500",
                i < filled
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-dashed border-border text-muted-foreground/40",
                i === filled - 1 ? "scale-110 shadow-[0_0_18px_-4px_var(--primary)]" : "",
              ].join(" ")}
            >
              <Stamp className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground">
          Faltam <span className="font-semibold text-primary">{10 - filled} carimbos</span> para o combo grátis
        </div>
      </div>
      <div className="animate-[fz-pop_.5s_ease-out_both] rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-center text-[11px] text-primary">
        + 1 carimbo adicionado agora
      </div>
      <style>{`@keyframes fz-pop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
