import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, Bell, LinkIcon, Megaphone, QrCode, ShieldCheck, Smartphone, Star, Users } from "lucide-react";
import { useInView } from "./use-in-view";

const TOTAL = 9;

export function EcosystemBento() {
  const { ref, inView } = useInView<HTMLElement>(0.15);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[i] as HTMLElement | undefined;
    if (card) track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }, []);

  // Sincroniza o indicador com o scroll manual
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / (track.clientWidth * 0.85));
        setActive(Math.max(0, Math.min(TOTAL - 1, i)));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Auto-avanço apenas no mobile, pausado ao interagir e respeitando reduced-motion
  useEffect(() => {
    if (!inView || paused) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % TOTAL;
        goTo(next);
        return next;
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [inView, paused, goTo]);

  const base = "group relative shrink-0 basis-[85%] snap-start overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-xl transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_40px_-14px_color-mix(in_oklch,var(--primary)_70%,transparent)] md:basis-auto";

  return (
    <section ref={ref} id="ecossistema" className="border-y bg-background py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Smartphone className="h-3.5 w-3.5" /> Tudo em uma conta
          </div>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight md:text-4xl">
            <span className="block text-balance">Começa no cartão fidelidade.</span>
            <span className="block text-balance">
              Vira a <span className="text-primary">operação inteira</span>
            </span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Nove ferramentas que conversam entre si — sem integrar nada, sem pagar nove assinaturas.
          </p>
        </div>

        <div
          ref={trackRef}
          onPointerDown={() => setPaused(true)}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className={`mt-10 -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 ${inView ? "animate-fade-in" : "opacity-0"}`}
        >
          {/* Campanhas — larga */}
          <article className={`${base} md:col-span-2`}>
            <Header icon={Megaphone} title="Campanhas" sub="Promoções com meta, prazo e público segmentado." />
            <div className="mt-4 space-y-2">
              {[
                ["Terça do combo", 78],
                ["Volta pra casa", 46],
                ["Clube Ouro", 92],
              ].map(([label, pct]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{label}</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 group-hover:brightness-125"
                      style={{ width: inView ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Avaliações */}
          <article className={base}>
            <Header icon={Star} title="Avaliações" sub="QR na mesa vira nota pública e feedback privado." />
            <div className="mt-4 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5 fill-primary text-primary transition-all duration-500"
                  style={{ transitionDelay: `${i * 100}ms`, opacity: inView ? 1 : 0.15, transform: inView ? "scale(1)" : "scale(0.8)" }}
                />
              ))}
            </div>
            <p className="mt-3 rounded-lg border border-border/60 bg-background/50 p-2 text-xs text-muted-foreground">
              “Atendimento rápido e o combo grátis chegou certinho.”
            </p>
          </article>

          {/* Cardápio */}
          <article className={base}>
            <Header icon={QrCode} title="Cardápio digital" sub="Stories em tela cheia, com foto, preço e variações." />
            <div className="mt-4 flex gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full bg-primary transition-all duration-[1200ms]"
                    style={{ width: inView && i === 0 ? "100%" : inView && i === 1 ? "40%" : "0%" }}
                  />
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["Burger", "Açaí", "Café"].map((n, i) => (
                <div
                  key={n}
                  className="rounded-lg border border-border/60 bg-background/50 p-2 text-center text-[10px] transition-transform duration-300 group-hover:-translate-y-0.5"
                  style={{ transitionDelay: `${i * 60}ms` }}
                >
                  {n}
                </div>
              ))}
            </div>
          </article>

          {/* Link tree */}
          <article className={base}>
            <Header icon={LinkIcon} title="Árvore de links" sub="Uma bio só: cardápio, cartão, WhatsApp e mapa." />
            <div className="mt-4 space-y-1.5">
              {["Cardápio", "Meu cartão", "WhatsApp"].map((l, i) => (
                <div
                  key={l}
                  className="rounded-lg border border-border/60 bg-background/50 px-3 py-1.5 text-xs transition-all duration-500"
                  style={{ transitionDelay: `${i * 120}ms`, opacity: inView ? 1 : 0, transform: inView ? "translateY(0)" : "translateY(-6px)" }}
                >
                  {l}
                </div>
              ))}
            </div>
          </article>

          {/* Push */}
          <article className={base}>
            <Header icon={Bell} title="Notificações push" sub="Chega na tela do cliente, sem custo por mensagem." />
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              3 novas entregas agora
            </div>
          </article>

          {/* Analytics — larga */}
          <article className={`${base} md:col-span-2`}>
            <Header icon={BarChart3} title="Analytics de canais" sub="Saiba se o cliente veio do QR, do link ou do cardápio." />
            <div className="mt-4 flex h-24 items-end gap-1.5 overflow-hidden rounded-lg">
              {[32, 48, 40, 66, 58, 82, 74, 96].map((h, i) => (
                <span
                  key={i}
                  className="w-full flex-1 rounded-t-md bg-gradient-to-t from-primary/25 to-primary transition-all duration-700"
                  style={{ height: inView ? `${h}%` : "4%", transitionDelay: `${i * 70}ms` }}
                />
              ))}
            </div>
          </article>

          {/* Equipe */}
          <article className={base}>
            <Header icon={Users} title="Equipe e permissões" sub="Cada funcionário com acesso na medida certa." />
            <div className="mt-4 space-y-2">
              {["Carimbar", "Ver clientes", "Financeiro"].map((p, i) => (
                <div key={p} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p}</span>
                  <span className={`h-5 w-9 rounded-full p-0.5 transition-colors duration-500 ${inView && i < 2 ? "bg-primary/70" : "bg-muted"}`}>
                    <span
                      className="block h-4 w-4 rounded-full bg-background transition-transform duration-500"
                      style={{ transform: inView && i < 2 ? "translateX(16px)" : "translateX(0)" }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </article>

          {/* App instalável */}
          <article className={base}>
            <Header icon={Smartphone} title="App instalável" sub="Lojista e cliente instalam na tela inicial. Sem loja." />
            <div className="mt-4 flex items-center gap-3">
              <span className="card-icon flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-500 group-hover:-translate-y-1">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="text-xs text-muted-foreground">funciona offline e envia push nativo</div>
            </div>
          </article>

          {/* Segurança */}
          <article className={base}>
            <Header icon={ShieldCheck} title="Antifraude e auditoria" sub="Todo carimbo tem autor, data e histórico rastreável." />
            <p className="mt-4 rounded-lg border border-border/60 bg-background/50 p-2 font-mono text-[10px] text-muted-foreground">
              14:22 · Ana carimbou #3140 · IP registrado
            </p>
          </article>
        </div>

        {/* Indicadores — só mobile */}
        <div className="mt-5 flex items-center justify-center gap-3 md:hidden">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {String(active + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Ir para a ferramenta ${i + 1}`}
                onClick={() => {
                  setPaused(true);
                  setActive(i);
                  goTo(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>
        </div>
      </div>

    </section>
  );
}

function Header({ icon: Icon, title, sub }: { icon: typeof Star; title: string; sub: string }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="card-icon flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h3 className="font-display text-base font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
    </>
  );
}
