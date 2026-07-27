import { useState } from "react";
import { QrCode, RotateCcw, Wifi } from "lucide-react";

/** Estilos proprietários do cartão Fidelize (texturas 100% CSS, sem imagens). */
export type CardSkin = "obsidiana" | "aurora" | "metal" | "carbono";

export const CARD_SKINS: { id: CardSkin; name: string; hint: string }[] = [
  { id: "obsidiana", name: "Obsidiana", hint: "Guilloché fino sobre fundo profundo" },
  { id: "aurora", name: "Aurora", hint: "Mesh de luz difusa e granulado" },
  { id: "metal", name: "Metal escovado", hint: "Escovado radial com brilho frio" },
  { id: "carbono", name: "Carbono", hint: "Trama diagonal técnica" },
];

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/** Camadas de textura por skin — sempre acima do fundo sólido/gradiente da marca. */
function skinLayers(skin: CardSkin, bg: string): React.CSSProperties {
  const base: Record<CardSkin, React.CSSProperties> = {
    obsidiana: {
      backgroundImage: [
        "repeating-radial-gradient(circle at 82% 18%, rgba(255,255,255,0.07) 0 1px, transparent 1px 9px)",
        "repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 7px)",
        "radial-gradient(120% 90% at 12% 0%, rgba(255,255,255,0.22), transparent 55%)",
        `linear-gradient(150deg, ${bg}, color-mix(in oklab, ${bg} 55%, #05010f))`,
      ].join(","),
    },
    aurora: {
      backgroundImage: [
        "radial-gradient(60% 70% at 78% 12%, rgba(255,255,255,0.34), transparent 60%)",
        "radial-gradient(55% 60% at 8% 92%, color-mix(in oklab, #7c5cff 60%, transparent), transparent 62%)",
        "radial-gradient(70% 80% at 100% 100%, color-mix(in oklab, #4f46e5 55%, transparent), transparent 60%)",
        `linear-gradient(135deg, ${bg}, color-mix(in oklab, ${bg} 62%, #17052e))`,
      ].join(","),
    },
    metal: {
      backgroundImage: [
        "repeating-linear-gradient(100deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 4px)",
        "linear-gradient(75deg, rgba(255,255,255,0.30) 0%, transparent 28%, rgba(255,255,255,0.18) 48%, transparent 72%, rgba(255,255,255,0.24) 100%)",
        `linear-gradient(160deg, color-mix(in oklab, ${bg} 78%, #ffffff), color-mix(in oklab, ${bg} 60%, #0b0716))`,
      ].join(","),
    },
    carbono: {
      backgroundImage: [
        "repeating-linear-gradient(45deg, rgba(255,255,255,0.075) 0 2px, transparent 2px 5px)",
        "repeating-linear-gradient(-45deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 5px)",
        "radial-gradient(110% 80% at 50% -10%, rgba(255,255,255,0.18), transparent 60%)",
        `linear-gradient(180deg, color-mix(in oklab, ${bg} 72%, #000000), color-mix(in oklab, ${bg} 45%, #000000))`,
      ].join(","),
    },
  };
  return base[skin];
}

export interface WalletCardPreviewProps {
  skin: CardSkin;
  bg: string;
  fg: string;
  label: string;
  establishmentName: string;
  logoUrl?: string;
  frontText?: string;
  customMessage?: string;
  backText?: string;
  showQr: boolean;
  fields: Record<string, boolean>;
}

/**
 * Prévia fiel ao formato físico: proporção ISO/IEC 7810 ID-1 (85,60 × 53,98 mm ≈ 1.586).
 * Tipografia escalada em `cqw` para que o alinhamento nunca quebre em nenhuma largura.
 */
export function WalletCardPreview(props: WalletCardPreviewProps) {
  const { skin, bg, fg, label, establishmentName, logoUrl, frontText, customMessage, backText, showQr, fields } = props;
  const [flipped, setFlipped] = useState(false);

  const stats = [
    fields.stamps && { k: "Carimbos", v: "7 / 10" },
    fields.tier && { k: "Nível", v: "Ouro" },
    fields.points && { k: "Visitas", v: "23" },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="space-y-3">
      <div className="[perspective:1600px]">
        <div
          className="relative w-full transition-transform duration-700 [transform-style:preserve-3d]"
          style={{ aspectRatio: "1.586 / 1", transform: flipped ? "rotateY(180deg)" : undefined }}
        >
          {/* FRENTE */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[6.5%/10.3%] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)] [backface-visibility:hidden] [container-type:inline-size]"
            style={{ ...skinLayers(skin, bg), color: fg }}
          >
            {/* granulado + brilho de borda */}
            <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.28]" style={{ backgroundImage: NOISE }} />
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20" />
            <div
              aria-hidden
              className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 opacity-25"
              style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)", animation: "wallet-sheen 6s ease-in-out infinite" }}
            />

            <div className="relative flex h-full flex-col justify-between p-[6cqw]">
              {/* topo: marca do lojista + selo Fidelize */}
              <div className="flex items-start justify-between gap-[3cqw]">
                <div className="flex min-w-0 items-center gap-[3cqw]">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={`Logo de ${establishmentName}`}
                      className="h-[13cqw] w-[13cqw] shrink-0 rounded-[3cqw] object-cover ring-1 ring-white/30"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-[13cqw] w-[13cqw] shrink-0 rounded-[3cqw] bg-white/15 ring-1 ring-white/25" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-[4.6cqw] font-semibold leading-tight">{establishmentName}</div>
                    <div className="truncate text-[3.1cqw] leading-tight" style={{ color: label }}>
                      {frontText || "Cartão fidelidade"}
                    </div>
                  </div>
                </div>
                <span
                  className="shrink-0 rounded-full px-[2.6cqw] py-[1cqw] text-[2.5cqw] font-bold uppercase tracking-[0.22em] ring-1 ring-white/25"
                  style={{ background: "rgba(255,255,255,0.12)" }}
                >
                  Fidelize
                </span>
              </div>

              {/* meio: chip + contactless + trilha de carimbos */}
              <div className="flex items-center gap-[4cqw]">
                <div
                  aria-hidden
                  className="h-[9cqw] w-[12cqw] shrink-0 rounded-[2cqw] ring-1 ring-black/20"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg,#f6e6b8,#c9a84c 45%,#8a6b22 70%,#e7d08a),repeating-linear-gradient(90deg,rgba(0,0,0,0.35) 0 1px,transparent 1px 3px)",
                  }}
                />
                <Wifi aria-hidden className="h-[6cqw] w-[6cqw] shrink-0 rotate-90 opacity-70" />
                {fields.stamps && (
                  <div className="flex min-w-0 flex-1 items-center gap-[1.4cqw]">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span
                        key={i}
                        className="h-[2.6cqw] flex-1 rounded-full"
                        style={{ background: i < 7 ? fg : "rgba(255,255,255,0.22)", opacity: i < 7 ? 0.95 : 1 }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* base: dados alinhados em baseline + QR */}
              <div className="flex items-end justify-between gap-[4cqw]">
                <div className="grid min-w-0 flex-1 grid-cols-3 gap-[3cqw]">
                  {stats.map((s) => (
                    <div key={s.k} className="min-w-0">
                      <div className="truncate text-[2.4cqw] font-medium uppercase tracking-[0.16em]" style={{ color: label }}>
                        {s.k}
                      </div>
                      <div className="truncate text-[4.2cqw] font-bold leading-tight tabular-nums">{s.v}</div>
                    </div>
                  ))}
                </div>
                {showQr ? (
                  <div className="h-[17cqw] w-[17cqw] shrink-0 rounded-[2.5cqw] bg-white p-[1.2cqw]">
                    <div
                      aria-hidden
                      className="h-full w-full rounded-[1.5cqw]"
                      style={{ backgroundImage: "repeating-conic-gradient(#000 0% 25%, #fff 0% 50%)", backgroundSize: "22% 22%" }}
                    />
                  </div>
                ) : (
                  fields.code && <div className="shrink-0 text-[3.4cqw] font-semibold tracking-[0.18em]">FD-8241</div>
                )}
              </div>
            </div>
          </div>

          {/* VERSO */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[6.5%/10.3%] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)] [backface-visibility:hidden] [container-type:inline-size]"
            style={{ ...skinLayers(skin, bg), color: fg, transform: "rotateY(180deg)" }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.28]" style={{ backgroundImage: NOISE }} />
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20" />
            <div aria-hidden className="absolute inset-x-0 top-[11cqw] h-[13cqw] bg-black/75" />
            <div className="relative flex h-full flex-col justify-end gap-[2cqw] p-[6cqw] pt-[28cqw]">
              <div className="flex items-center justify-between gap-[3cqw]">
                {fields.code && (
                  <div className="rounded-[2cqw] bg-white/90 px-[3cqw] py-[1.4cqw] text-[3.2cqw] font-bold tracking-[0.2em] text-black">
                    FD-8241
                  </div>
                )}
                <span className="text-[2.5cqw] font-bold uppercase tracking-[0.22em]" style={{ color: label }}>
                  Fidelize
                </span>
              </div>
              <p className="line-clamp-3 text-[2.9cqw] leading-relaxed" style={{ color: label }}>
                {backText || customMessage || "Apresente este cartão no caixa para acumular carimbos e resgatar recompensas."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">
          {customMessage || "Proporção real de cartão (85,6 × 54 mm)."}
        </p>
        <button
          type="button"
          onClick={() => setFlipped((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary"
        >
          {flipped ? <RotateCcw className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
          {flipped ? "Ver frente" : "Ver verso"}
        </button>
      </div>
    </div>
  );
}
