import { useEffect, useRef, useState } from "react";
import { Coffee, Gift, RotateCw, Sparkles, Star, QrCode } from "lucide-react";

const CYAN = "#00ffff";

/**
 * Cartão fidelidade 3D interativo.
 * - Arraste horizontalmente para girar em Y
 * - Botão "Girar" faz flip suave
 * - Frente: branding + grid de carimbos com animação de carimbo entrando
 * - Verso: QR code estilizado + prova social + CTA de resgate
 * - Tilt sutil em X pelo mouse (parallax)
 */
export function HeroStampCard3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [dragRotY, setDragRotY] = useState(0); // acumulada durante drag
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [stamps, setStamps] = useState(2);
  const [pulseKey, setPulseKey] = useState(0);
  const dragging = useRef<{ startX: number; startRot: number } | null>(null);

  // Loop de carimbos apenas quando frente
  useEffect(() => {
    if (flipped) return;
    const id = setInterval(() => {
      setStamps((s) => {
        const next = s >= 8 ? 0 : s + 1;
        setPulseKey((k) => k + 1);
        return next;
      });
    }, 2200);
    return () => clearInterval(id);
  }, [flipped]);

  // Rotação total = flip + drag + tilt
  const baseY = flipped ? 180 : 0;
  const rotY = baseY + dragRotY + tiltY;
  const rotX = -tiltX;

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current) {
      const dx = e.clientX - dragging.current.startX;
      setDragRotY(dragging.current.startRot + dx * 0.6);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTiltY(px * 10);
    setTiltX(py * 8);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragging.current = { startX: e.clientX, startRot: dragRotY };
  };

  const handlePointerUp = () => {
    if (!dragging.current) return;
    dragging.current = null;
    // Snap: decide flip baseado no ângulo acumulado
    const total = baseY + dragRotY;
    const mod = ((total % 360) + 360) % 360;
    const shouldFlip = mod > 90 && mod < 270;
    setFlipped(shouldFlip);
    setDragRotY(0);
  };

  const handleLeave = () => {
    setTiltX(0);
    setTiltY(0);
    handlePointerUp();
  };

  return (
    <div className="relative w-full max-w-md select-none">
      {/* Sombra projetada / pedestal */}
      <div
        aria-hidden
        className="absolute left-1/2 -bottom-6 h-10 w-3/4 -translate-x-1/2 rounded-[50%] blur-2xl"
        style={{ background: `${CYAN}33` }}
      />
      {/* Halo ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl"
        style={{ background: `radial-gradient(circle at 50% 50%, ${CYAN}22, transparent 65%)` }}
      />

      {/* Stage 3D */}
      <div
        ref={wrapRef}
        className="relative cursor-grab active:cursor-grabbing"
        style={{ perspective: "1400px" }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handleLeave}
      >
        <div
          className="relative mx-auto h-[430px] w-full transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotX}deg) rotateY(${rotY}deg)`,
          }}
        >
          {/* FRENTE */}
          <CardFace>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl border"
                  style={{ borderColor: `${CYAN}55`, background: `${CYAN}14` }}
                >
                  <Coffee className="h-5 w-5" style={{ color: CYAN }} />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
                    Cartão fidelidade
                  </div>
                  <div className="font-display text-lg font-bold text-white">Café do Centro</div>
                </div>
              </div>
              <span
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: `${CYAN}14`, color: CYAN, border: `1px solid ${CYAN}44` }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: CYAN }} />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: CYAN }} />
                </span>
                Ao vivo
              </span>
            </div>

            <div className="mt-6 text-sm text-white/70">
              Olá, <span className="font-semibold text-white">Ana Silva</span>
            </div>

            {/* Grid 5x2 */}
            <div className="mt-3 grid grid-cols-5 gap-2.5">
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = i < stamps;
                const isLatest = i === stamps - 1;
                return (
                  <div
                    key={i}
                    className="relative flex aspect-square items-center justify-center rounded-xl border transition-all duration-500"
                    style={{
                      background: filled ? `${CYAN}1a` : "rgba(255,255,255,0.03)",
                      borderColor: filled ? `${CYAN}66` : "rgba(255,255,255,0.08)",
                      boxShadow: filled ? `inset 0 0 12px ${CYAN}33` : "none",
                    }}
                  >
                    {filled && (
                      <Coffee
                        key={isLatest ? pulseKey : undefined}
                        className={`h-5 w-5 ${isLatest ? "hero-stamp-in" : ""}`}
                        style={{ color: CYAN, filter: `drop-shadow(0 0 6px ${CYAN}88)` }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recompensa */}
            <div
              className="mt-6 flex items-center gap-3 rounded-xl border p-3.5"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `${CYAN}18`, color: CYAN }}
              >
                <Gift className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Recompensa
                </div>
                <div className="text-sm font-semibold text-white">Um café especial grátis</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-widest text-white/40">Progresso</div>
                <div className="font-display text-sm font-bold" style={{ color: CYAN }}>{stamps}/10</div>
              </div>
            </div>

            {/* Hint arraste */}
            <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.25em] text-white/40">
              <RotateCw className="h-3 w-3" /> Arraste para girar
            </div>
          </CardFace>

          {/* VERSO */}
          <CardFace back>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/50">
                  Resgate
                </div>
                <div className="font-display text-xl font-bold text-white">Escaneie para trocar</div>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: `${CYAN}14`, color: CYAN, border: `1px solid ${CYAN}44` }}
              >
                Verso
              </span>
            </div>

            {/* QR + halo */}
            <div className="mt-5 flex items-center justify-center">
              <div
                className="relative rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${CYAN}33`,
                  boxShadow: `0 0 40px ${CYAN}22, inset 0 0 20px ${CYAN}18`,
                }}
              >
                <StylizedQR />
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    background: `linear-gradient(120deg, transparent 40%, ${CYAN}22 50%, transparent 60%)`,
                    mixBlendMode: "screen",
                  }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <MiniStat icon={<Sparkles className="h-3.5 w-3.5" />} label="Clientes fiéis" value="+8.240" />
              <MiniStat icon={<Star className="h-3.5 w-3.5" />} label="Avaliação" value="4.9 ★" />
            </div>

            <button
              type="button"
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all hover:brightness-110"
              style={{ background: CYAN, color: "#020617", boxShadow: `0 0 24px ${CYAN}55` }}
            >
              <QrCode className="h-4 w-4" /> Resgatar recompensa
            </button>
          </CardFace>
        </div>
      </div>

      {/* Botão de flip fora do stage */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="group flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all hover:-translate-y-0.5"
          style={{ borderColor: `${CYAN}44`, background: `${CYAN}10`, color: CYAN }}
        >
          <RotateCw className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
          {flipped ? "Ver frente" : "Girar cartão"}
        </button>
        <div className="flex gap-1.5">
          <span
            className="h-1.5 w-6 rounded-full transition-all"
            style={{ background: !flipped ? CYAN : "rgba(255,255,255,0.15)" }}
          />
          <span
            className="h-1.5 w-6 rounded-full transition-all"
            style={{ background: flipped ? CYAN : "rgba(255,255,255,0.15)" }}
          />
        </div>
      </div>
    </div>
  );
}

function CardFace({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  return (
    <div
      className="absolute inset-0 rounded-[2rem] p-[1.5px]"
      style={{
        transform: back ? "rotateY(180deg)" : undefined,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        background: `linear-gradient(135deg, ${CYAN}, ${CYAN}22 40%, transparent 70%, ${CYAN}55)`,
        boxShadow: `0 20px 60px -20px ${CYAN}55, 0 0 0 1px rgba(255,255,255,0.02)`,
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[calc(2rem-1.5px)] p-6"
        style={{
          background:
            "linear-gradient(160deg, rgba(2,6,23,0.95) 0%, rgba(6,14,32,0.98) 100%)",
        }}
      >
        {/* Reflexo diagonal */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(115deg, transparent 45%, ${CYAN}10 50%, transparent 55%)`,
          }}
        />
        {/* Grid holográfico sutil */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `linear-gradient(${CYAN} 1px, transparent 1px), linear-gradient(90deg, ${CYAN} 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
        <span style={{ color: CYAN }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold" style={{ color: CYAN }}>
        {value}
      </div>
    </div>
  );
}

/** QR code decorativo (não escaneável) — visual premium */
function StylizedQR() {
  const size = 9; // grid
  // padrão fixo para consistência
  const pattern = [
    "111111101101111111",
    "100000101011000001",
    "101110100110101110",
    "101110100010101110",
    "101110101001101110",
    "100000101010000001",
    "111111101010111111",
    "000000001101000000",
    "110110111010110101",
    "011010100101011010",
    "101001011010101001",
    "010110101011010110",
    "000000001110110101",
    "111111101010011010",
    "100000101011101101",
    "101110101010010110",
    "101110100110101010",
    "111111101101110110",
  ];
  return (
    <svg width="150" height="150" viewBox={`0 0 ${pattern.length} ${pattern.length}`} className="block">
      <rect width={pattern.length} height={pattern.length} fill="transparent" />
      {pattern.map((row, y) =>
        row.split("").map((c, x) =>
          c === "1" ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={CYAN}
              opacity={0.95}
            />
          ) : null
        )
      )}
      {/* três "olhos" */}
      {[[0, 0], [pattern.length - 7, 0], [0, pattern.length - 7]].map(([ox, oy], i) => (
        <g key={i}>
          <rect x={ox} y={oy} width={7} height={7} fill="none" stroke={CYAN} strokeWidth={1} />
          <rect x={ox + 2} y={oy + 2} width={3} height={3} fill={CYAN} />
        </g>
      ))}
      {/* logo central */}
      <g transform={`translate(${pattern.length / 2 - 2}, ${pattern.length / 2 - 2})`}>
        <rect width={4} height={4} fill="#020617" />
        <rect x={0.5} y={0.5} width={3} height={3} fill={CYAN} />
      </g>
      {size /* silence */}
    </svg>
  );
}
