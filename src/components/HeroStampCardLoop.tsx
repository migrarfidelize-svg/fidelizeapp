import { Gift, Coffee, Sparkles } from "lucide-react";

/**
 * Animated hero variant of <StampCard/>. Same visual model — header (logo+brand),
 * 5-column stamp grid, reward block — but styled in fixed cyan #00ffff over
 * obsidian and running a perpetual loop: 10 stamps fill one-by-one, then a
 * reward overlay flashes in with confetti, then everything resets.
 *
 * Timings are handled with pure CSS so the component works during SSR and
 * doesn't need JS state.
 *
 * Loop = 12s.
 *   0.0s – 5.0s   → stamps 1..10 pop in (0.5s apart)
 *   5.2s – 10.5s  → reward overlay visible + confetti
 *   10.5s – 12s   → fade back to empty card
 */
export function HeroStampCardLoop() {
  const CYAN = "#00ffff";
  const OBSIDIAN = "#020617";
  const stamps = Array.from({ length: 10 });

  return (
    <div className="relative w-full max-w-sm">
      {/* Ambient cyan halo */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[3rem] blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${CYAN}33, transparent 70%)` }}
      />

      <style>{`
        @keyframes hero-stamp-pop {
          0%, 4%   { opacity: 0; transform: scale(2.4) rotate(-14deg); }
          6%, 38%  { opacity: 1; transform: scale(1) rotate(0deg); }
          42%, 87% { opacity: 1; transform: scale(1) rotate(0deg); }
          92%,100% { opacity: 0; transform: scale(1) rotate(0deg); }
        }
        @keyframes hero-reward-in {
          0%, 42%   { opacity: 0; transform: scale(0.85); }
          46%, 84%  { opacity: 1; transform: scale(1); }
          88%,100%  { opacity: 0; transform: scale(1.02); }
        }
        @keyframes hero-confetti {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; }
        }
        @keyframes hero-card-glow {
          0%, 42%  { box-shadow: 0 20px 60px -20px rgba(0,0,0,.6); }
          46%, 84% { box-shadow: 0 0 0 1px ${CYAN}, 0 0 60px ${CYAN}66, 0 20px 60px -20px rgba(0,0,0,.6); }
          88%,100% { box-shadow: 0 20px 60px -20px rgba(0,0,0,.6); }
        }
        @keyframes hero-live-dot {
          0%, 100% { opacity: .35; }
          50%      { opacity: 1; }
        }
        .hero-stamp     { animation: hero-stamp-pop 12s infinite cubic-bezier(.34,1.56,.64,1); opacity: 0; }
        .hero-reward    { animation: hero-reward-in 12s infinite ease-out; opacity: 0; }
        .hero-confetti  { animation: hero-confetti 12s infinite ease-out; opacity: 0; }
        .hero-card-loop { animation: hero-card-glow 12s infinite ease-in-out; }
        .hero-live-dot  { animation: hero-live-dot 1.4s infinite ease-in-out; }
      `}</style>

      <div
        className="hero-card-loop relative w-full rounded-3xl p-6 overflow-hidden"
        style={{
          background: `linear-gradient(160deg, #0b1220 0%, ${OBSIDIAN} 100%)`,
          border: "1px solid rgba(0,255,255,0.18)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-full"
              style={{ background: CYAN, color: OBSIDIAN }}
            >
              <Coffee className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-widest opacity-60">
                Cartão fidelidade
              </div>
              <div className="font-display font-bold leading-tight">Café do Centro</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-70">
            <span
              className="hero-live-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: CYAN, boxShadow: `0 0 8px ${CYAN}` }}
            />
            AO VIVO
          </div>
        </div>

        <div className="mt-4 text-sm text-white/80">
          Olá, <span className="font-semibold text-white">Ana Silva</span>
        </div>

        {/* Stamp grid — same 5-col layout as StampCard */}
        <div className="mt-5 grid grid-cols-5 gap-2 relative">
          {stamps.map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-xl grid place-items-center relative"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div
                className="hero-stamp aspect-square w-full rounded-xl grid place-items-center absolute inset-0"
                style={{
                  background: CYAN,
                  color: OBSIDIAN,
                  boxShadow: `0 0 20px ${CYAN}80`,
                  animationDelay: `${i * 0.5}s`,
                }}
              >
                <Coffee className="h-5 w-5" strokeWidth={3} />
              </div>
            </div>
          ))}
        </div>

        {/* Reward block */}
        <div
          className="mt-5 rounded-2xl p-4"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2 text-xs text-white/70">
            <Gift className="h-3.5 w-3.5" /> Recompensa
          </div>
          <div className="mt-1 font-display font-semibold text-white">Um café especial grátis</div>
          <div className="mt-2 text-xs text-white/60">Complete o cartão e resgate no balcão</div>
        </div>

        {/* Reward reveal overlay */}
        <div
          className="hero-reward absolute inset-0 flex flex-col items-center justify-center text-center p-8 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, ${OBSIDIAN}f2 55%, ${OBSIDIAN}00 100%)` }}
        >
          {/* Confetti */}
          {[
            { dx: "60px", dy: "-80px", d: "0.1s" },
            { dx: "-70px", dy: "-60px", d: "0.25s" },
            { dx: "80px", dy: "40px", d: "0.4s" },
            { dx: "-60px", dy: "50px", d: "0.15s" },
            { dx: "0px", dy: "-100px", d: "0.3s" },
            { dx: "100px", dy: "-20px", d: "0.05s" },
            { dx: "-100px", dy: "10px", d: "0.35s" },
            { dx: "40px", dy: "90px", d: "0.2s" },
          ].map((p, i) => (
            <span
              key={i}
              className="hero-confetti absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full"
              style={
                {
                  background: CYAN,
                  boxShadow: `0 0 10px ${CYAN}`,
                  "--dx": p.dx,
                  "--dy": p.dy,
                  animationDelay: p.d,
                } as React.CSSProperties
              }
            />
          ))}

          <div
            className="grid h-20 w-20 place-items-center rounded-full mb-4"
            style={{
              background: CYAN,
              color: OBSIDIAN,
              boxShadow: `0 0 40px ${CYAN}`,
            }}
          >
            <Sparkles className="h-9 w-9" strokeWidth={2.5} />
          </div>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.3em]"
            style={{ color: CYAN }}
          >
            Cartão completo
          </div>
          <div className="mt-2 font-display text-3xl font-black text-white leading-tight">
            Café grátis
          </div>
          <div className="mt-1 text-xs text-white/70">liberado no seu próximo pedido</div>
          <div
            className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: CYAN, color: OBSIDIAN }}
          >
            Resgatar agora
          </div>
        </div>
      </div>
    </div>
  );
}
