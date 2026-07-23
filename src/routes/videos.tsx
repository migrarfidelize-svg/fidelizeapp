import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Star,
  QrCode,
  Nfc,
  Link as LinkIcon,
  Store,
  CheckCircle2,
  Play,
  Volume2,
  MoreHorizontal,
} from "lucide-react";

export const Route = createFileRoute("/videos")({
  head: () => ({
    meta: [
      { title: "Fidelize — Vídeos promocionais" },
      { name: "description", content: "Prévias animadas dos vídeos promocionais do Fidelize: cartão fidelidade digital, avaliações, árvore de links, displays personalizados e cartão NFC." },
      { property: "og:title", content: "Fidelize — Vídeos promocionais" },
      { property: "og:description", content: "Prévias animadas do Fidelize em estilo Remotion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideosPage,
});

// ---------- Constants ----------
const DURATION = 8; // seconds per loop
const ACCENT = "#00ffff";
const MAGENTA = "#ff2fd6";

// ---------- Shared UI ----------

function useLoop(seconds: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = ((now - start) / 1000) % seconds;
      setT(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seconds]);
  return t;
}

function PlayerChrome({
  children,
  title,
  subtitle,
  accent = ACCENT,
  duration = DURATION,
  aspect = "aspect-[9/16] sm:aspect-[4/5]",
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: string;
  duration?: number;
  aspect?: string;
}) {
  const t = useLoop(duration);
  const progress = (t / duration) * 100;
  const secs = Math.floor(t);

  return (
    <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0f] shadow-[0_30px_80px_-40px_rgba(0,255,255,0.35)]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent }} />
          REC · Remotion
        </div>
        <MoreHorizontal className="h-4 w-4 text-white/30" />
      </div>

      {/* Stage */}
      <div className={`relative ${aspect} w-full overflow-hidden`}>
        {/* Gradient backdrop */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(700px 400px at 50% 0%, ${accent}22, transparent 60%), radial-gradient(500px 300px at 100% 100%, ${MAGENTA}20, transparent 60%), linear-gradient(#08080d,#050508)`,
          }}
        />
        {/* Grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at 50% 50%, black 40%, transparent 85%)",
          }}
        />

        <div className="relative z-10 flex h-full w-full items-center justify-center p-6">
          {children}
        </div>

        {/* Bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 space-y-2 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-3 pt-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
              {subtitle}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-white sm:text-base">{title}</div>
          </div>
          {/* Controls + progress */}
          <div className="flex items-center gap-3">
            <Play className="h-4 w-4 fill-white text-white" />
            <div className="flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-1 rounded-full transition-none"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${accent}, ${MAGENTA})`,
                  boxShadow: `0 0 8px ${accent}`,
                }}
              />
            </div>
            <span className="font-mono text-[10px] tabular-nums text-white/60">
              0:0{secs} / 0:0{duration}
            </span>
            <Volume2 className="h-3.5 w-3.5 text-white/40" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Preview 1 — Cartão Fidelidade + NFC ----------
function ScenePreview1() {
  const t = useLoop(DURATION);
  const stampsFilled = Math.min(10, Math.floor((t / DURATION) * 10) + 1);

  return (
    <div className="relative flex w-full max-w-xs flex-col items-center gap-6">
      {/* NFC ping */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [-8, 0, 0, -4] }}
        transition={{ duration: DURATION, repeat: Infinity, times: [0, 0.1, 0.85, 1] }}
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1"
      >
        <Nfc className="h-3.5 w-3.5 text-cyan-300" />
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200">
          Aproxime o cartão
        </span>
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ rotateY: -18, y: 20, opacity: 0 }}
        animate={{
          rotateY: [-18, 8, -6, 8, -18],
          y: [20, 0, 0, 0, 20],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{ duration: DURATION, repeat: Infinity, times: [0, 0.15, 0.5, 0.85, 1] }}
        style={{ transformStyle: "preserve-3d", perspective: 800 }}
        className="relative w-full rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1a24] to-[#0a0a12] p-4 shadow-[0_20px_60px_-20px_rgba(0,255,255,0.55)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-cyan-300/80">
              Fidelize
            </div>
            <div className="text-sm font-bold text-white">Café do Centro</div>
          </div>
          <QrCode className="h-8 w-8 text-cyan-300" />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i < stampsFilled ? [0.6, 1.15, 1] : 1,
                opacity: i < stampsFilled ? 1 : 0.25,
              }}
              transition={{ duration: 0.35 }}
              className="grid aspect-square place-items-center rounded-lg border text-[9px]"
              style={{
                borderColor: i < stampsFilled ? `${ACCENT}80` : "rgba(255,255,255,0.1)",
                background: i < stampsFilled ? `${ACCENT}20` : "transparent",
                color: i < stampsFilled ? ACCENT : "rgba(255,255,255,0.3)",
                boxShadow: i < stampsFilled ? `0 0 10px ${ACCENT}55` : "none",
              }}
            >
              <Star className={`h-3 w-3 ${i < stampsFilled ? "fill-current" : ""}`} />
            </motion.div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px]">
          <span className="text-white/50">Progresso</span>
          <span className="font-mono font-bold text-cyan-300">
            {stampsFilled}/10 carimbos
          </span>
        </div>
      </motion.div>

      {/* Success */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: stampsFilled >= 10 ? [0, 1, 1, 0] : 0,
          scale: stampsFilled >= 10 ? [0.8, 1, 1, 0.9] : 0.8,
        }}
        transition={{ duration: 1.2 }}
        className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-3 py-1"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-200">
          Brinde liberado
        </span>
      </motion.div>
    </div>
  );
}

// ---------- Preview 2 — Avaliação ----------
function ScenePreview2() {
  const t = useLoop(DURATION);
  const activeStar = Math.min(5, Math.floor((t / (DURATION * 0.55)) * 5) + 1);
  const showNps = t > DURATION * 0.6;
  const nps = Math.min(92, Math.floor(((t - DURATION * 0.6) / (DURATION * 0.3)) * 92));

  return (
    <div className="relative flex w-full max-w-xs flex-col items-center gap-5 text-center">
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: [-12, 0, 0, -4], opacity: [0, 1, 1, 0] }}
        transition={{ duration: DURATION, repeat: Infinity, times: [0, 0.1, 0.85, 1] }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-fuchsia-300">
          Como foi seu atendimento?
        </div>
        <div className="mt-1 text-xl font-bold text-white">Barbearia Conceito</div>
      </motion.div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= activeStar;
          return (
            <motion.div
              key={n}
              animate={{
                scale: on ? [1, 1.4, 1] : 1,
                filter: on ? `drop-shadow(0 0 12px ${ACCENT})` : "none",
              }}
              transition={{ duration: 0.4 }}
            >
              <Star
                className={`h-9 w-9 ${on ? "fill-cyan-300 text-cyan-300" : "text-white/20"}`}
              />
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: activeStar >= 5 ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-white/80"
      >
        “Melhor atendimento da cidade! Voltarei sempre.”
      </motion.div>

      <AnimatePresence>
        {showNps && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="grid w-full grid-cols-3 gap-2 rounded-xl border border-white/10 bg-black/40 p-3"
          >
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                Média
              </div>
              <div className="mt-0.5 font-mono text-lg font-bold text-cyan-300 tabular-nums">
                4.9
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                NPS
              </div>
              <div className="mt-0.5 font-mono text-lg font-bold text-fuchsia-300 tabular-nums">
                +{nps}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
                Reviews
              </div>
              <div className="mt-0.5 font-mono text-lg font-bold text-white tabular-nums">
                1.2k
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Preview 3 — LinkTree + Display + NFC venda ----------
function ScenePreview3() {
  const t = useLoop(DURATION);
  const items = useMemo(
    () => [
      { icon: <QrCode className="h-4 w-4" />, label: "Cartão Fidelidade" },
      { icon: <Star className="h-4 w-4" />, label: "Avaliar atendimento" },
      { icon: <LinkIcon className="h-4 w-4" />, label: "WhatsApp da loja" },
      { icon: <Store className="h-4 w-4" />, label: "Cardápio digital" },
    ],
    []
  );

  return (
    <div className="relative flex w-full items-center justify-center gap-4">
      {/* Display / totem */}
      <motion.div
        initial={{ rotate: -6, x: -20, opacity: 0 }}
        animate={{ rotate: [-6, -2, -6], x: [-20, -8, -20], opacity: [0, 1, 0] }}
        transition={{ duration: DURATION, repeat: Infinity, times: [0, 0.15, 1] }}
        className="relative hidden h-56 w-28 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-2 shadow-2xl sm:block"
      >
        <div className="grid h-full place-items-center rounded-xl border border-cyan-300/30 bg-black/60">
          <div className="flex flex-col items-center gap-2">
            <div className="grid h-14 w-14 place-items-center rounded-lg bg-white p-1">
              <QrCode className="h-full w-full text-black" />
            </div>
            <div className="font-mono text-[8px] uppercase tracking-widest text-cyan-300">
              Escaneie
            </div>
          </div>
        </div>
        <div className="mt-1 text-center font-mono text-[8px] uppercase tracking-widest text-white/40">
          Display Acrílico
        </div>
      </motion.div>

      {/* Phone linktree */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: [20, 0, 0, 10], opacity: [0, 1, 1, 0] }}
        transition={{ duration: DURATION, repeat: Infinity, times: [0, 0.15, 0.85, 1] }}
        className="w-52 rounded-[28px] border border-white/10 bg-[#0a0a12] p-3 shadow-[0_20px_60px_-20px_rgba(255,47,214,0.5)]"
      >
        <div className="rounded-2xl bg-gradient-to-b from-[#0e0e1a] to-[#050508] p-3">
          <div className="text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-cyan-300/40 bg-cyan-300/10">
              <Sparkles className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="mt-2 text-xs font-bold text-white">@caferitual</div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">
              Tudo em um só link
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {items.map((item, i) => {
              const delay = 0.2 + i * 0.15;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{
                    opacity: t > delay * DURATION * 0.15 ? 1 : 0,
                    x: t > delay * DURATION * 0.15 ? 0 : 20,
                  }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
                >
                  <span className="text-cyan-300">{item.icon}</span>
                  <span className="text-[11px] font-medium text-white">{item.label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* NFC card */}
      <motion.div
        initial={{ rotate: 8, x: 20, opacity: 0 }}
        animate={{ rotate: [8, 3, 8], x: [20, 4, 20], opacity: [0, 1, 0] }}
        transition={{ duration: DURATION, repeat: Infinity, times: [0, 0.2, 1] }}
        className="hidden w-24 rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 p-3 shadow-2xl sm:block"
      >
        <Nfc className="h-4 w-4 text-white" />
        <div className="mt-6 font-mono text-[8px] uppercase tracking-widest text-white/70">
          NFC Card
        </div>
        <div className="text-[10px] font-bold text-white">Toque & Abra</div>
      </motion.div>
    </div>
  );
}

// ---------- Page ----------
function VideosPage() {
  const previews = [
    {
      title: "Cartão fidelidade digital + NFC",
      subtitle: "Ep. 01 · Retenção",
      pill: "Retenção",
      scene: <ScenePreview1 />,
    },
    {
      title: "Avaliação de atendimento em tempo real",
      subtitle: "Ep. 02 · Reputação",
      pill: "Reputação",
      scene: <ScenePreview2 />,
    },
    {
      title: "Árvore de links + display + cartão NFC",
      subtitle: "Ep. 03 · Presença",
      pill: "Presença",
      scene: <ScenePreview3 />,
    },
  ];

  return (
    <div className="min-h-dvh bg-[#050508] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background: `radial-gradient(900px 500px at 15% 0%, ${ACCENT}18, transparent 60%), radial-gradient(700px 500px at 100% 100%, ${MAGENTA}15, transparent 60%)`,
        }}
      />
      <main className="relative mx-auto max-w-7xl px-6 py-16">
        <header className="mx-auto max-w-2xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: ACCENT }} />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/60">
              Prévias · Motion Studio
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            Vídeos promocionais do{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, ${MAGENTA})` }}
            >
              Fidelize
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60">
            Simulação em estilo Remotion — três episódios curtos mostrando as
            funcionalidades da plataforma em loop, com barra de progresso e
            micro-animações prontas para produção.
          </p>
        </header>

        <section className="mt-14 grid gap-8 lg:grid-cols-3">
          {previews.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">
                  Preview {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest"
                  style={{ borderColor: `${ACCENT}40`, color: ACCENT, background: `${ACCENT}10` }}
                >
                  {p.pill}
                </span>
              </div>
              <PlayerChrome title={p.title} subtitle={p.subtitle}>
                {p.scene}
              </PlayerChrome>
            </motion.div>
          ))}
        </section>

        <footer className="mt-14 text-center font-mono text-[10px] uppercase tracking-[0.3em] text-white/30">
          Renderizado ao vivo com Framer Motion · Loop {DURATION}s
        </footer>
      </main>
    </div>
  );
}
