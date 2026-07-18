import { forwardRef } from "react";
import { Flame, Coffee, Scissors, PawPrint, Droplets, Sparkles, Utensils, Wrench, ShoppingBag, Heart } from "lucide-react";

export type PromoFormat = "story" | "feed" | "counter";
export type Segment = "espetinhos" | "cafeteria" | "barbearia" | "petshop" | "lavajato" | "salao" | "restaurante" | "oficina" | "loja" | "outro";

/** Format metadata:
 * - w/h: full canvas in pixels (includes bleed for print)
 * - bleed: px of bleed on each side (0 for digital)
 * - safe: extra px inside trim line — content must stay inside safe area
 * - mm: physical size in mm (only for print formats — enables true-scale PDF export)
 * - print: renders crop marks
 *
 * Dimensions verified:
 *  Story Instagram: 1080×1920 (9:16)  — sem sangria
 *  Feed Instagram:  1080×1080 (1:1)   — sem sangria
 *  Balcão A5:       trim 148×210mm + 3mm sangria = 154×216mm  @≈288dpi → 1748×2480px
 */
export const FORMATS: Record<PromoFormat, { label: string; w: number; h: number; bleed: number; safe: number; mm?: { w: number; h: number }; print: boolean; description: string }> = {
  story:   { label: "Story Instagram", w: 1080, h: 1920, bleed: 0,  safe: 96, print: false, description: "1080×1920 · 9:16 · Story / Reels / Status" },
  feed:    { label: "Feed Instagram",  w: 1080, h: 1080, bleed: 0,  safe: 84, print: false, description: "1080×1080 · 1:1 · Feed / Post quadrado" },
  counter: { label: "Balcão A5",       w: 1748, h: 2480, bleed: 36, safe: 96, mm: { w: 154, h: 216 }, print: true, description: "A5 148×210mm + 3mm sangria · display de balcão" },
};

const SEGMENT_ICON: Record<Segment, any> = {
  espetinhos: Flame, cafeteria: Coffee, barbearia: Scissors, petshop: PawPrint, lavajato: Droplets,
  salao: Sparkles, restaurante: Utensils, oficina: Wrench, loja: ShoppingBag, outro: Heart,
};

export const SEGMENT_LABEL: Record<Segment, string> = {
  espetinhos: "Espetinhos / Churrasco", cafeteria: "Cafeteria", barbearia: "Barbearia", petshop: "Pet shop",
  lavajato: "Lava-jato", salao: "Salão / Beleza", restaurante: "Restaurante / Lanchonete",
  oficina: "Oficina", loja: "Loja / Varejo", outro: "Outro",
};

export interface PromoConfig {
  format: PromoFormat;
  segment: Segment;
  title: string;
  subtitle: string;
  ctaNearQR: string;
  ctaFooter: string;
  rewardText: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  showBrand: boolean;
  establishmentName: string;
  logoUrl?: string | null;
  qrDataUrl: string;
  publicUrl: string;
  benefits: string[];
  contactLine?: string;
  bgImageUrl?: string | null;
  bgZoom?: number;
  bgOffsetX?: number;
  bgOffsetY?: number;
  bgOverlay?: number;
  showCropMarks?: boolean;
  showSafeArea?: boolean;
  qrScale?: number;
  qrColor?: string;
  cornerStyle?: "sharp" | "rounded";
}

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const PromoPoster = forwardRef<HTMLDivElement, { config: PromoConfig }>(function PromoPoster({ config }, ref) {
  const { format, segment, primaryColor, accentColor, backgroundColor, textColor } = config;
  const dims = FORMATS[format];
  const Icon = SEGMENT_ICON[segment] ?? Heart;
  const isSquare = dims.w === dims.h;

  const trimW = dims.w - dims.bleed * 2;
  const trimH = dims.h - dims.bleed * 2;
  const base = Math.min(trimW, trimH);
  const s = (n: number) => Math.round((n / 1080) * base);

  const bgZoom = config.bgZoom ?? 1;
  const bgOx = config.bgOffsetX ?? 0;
  const bgOy = config.bgOffsetY ?? 0;
  const bgOverlay = config.bgOverlay ?? 0.35;
  const cornerStyle = config.cornerStyle ?? "sharp";
  // Apply radius on trim area (so print bleed still fills to edges); for digital (bleed=0) it's the same as outer.
  const radius = cornerStyle === "rounded" ? Math.round(Math.min(trimW, trimH) * 0.06) : 0;

  return (
    <div
      ref={ref}
      style={{
        width: dims.w, height: dims.h,
        position: "relative", overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        background: dims.bleed > 0 ? backgroundColor : "transparent",
        borderRadius: dims.bleed > 0 ? 0 : radius,
      }}
    >
      {/* Corner-rounded canvas (for digital exports the whole poster gets rounded) */}
      <div style={{ position: "absolute", inset: 0, background: backgroundColor, borderRadius: dims.bleed > 0 ? 0 : radius }} />

      {/* Custom background image */}
      {config.bgImageUrl && (
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${config.bgImageUrl})`,
            backgroundSize: `${bgZoom * 100}% auto`,
            backgroundPosition: `${50 + bgOx}% ${50 + bgOy}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      )}
      {config.bgImageUrl && (
        <div style={{ position: "absolute", inset: 0, background: withAlpha(backgroundColor, bgOverlay) }} />
      )}
      <div
        style={{
          position: "absolute", inset: 0,
          background: config.bgImageUrl
            ? `linear-gradient(160deg, ${withAlpha(primaryColor, 0.06)} 0%, transparent 55%, ${withAlpha(accentColor, 0.08)} 100%)`
            : `linear-gradient(160deg, ${withAlpha(primaryColor, 0.12)} 0%, transparent 55%, ${withAlpha(accentColor, 0.18)} 100%)`,
        }}
      />

      {/* Trim area */}
      <div style={{ position: "absolute", top: dims.bleed, left: dims.bleed, width: trimW, height: trimH }}>
        {/* Decorative segment icons */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <Icon size={s(320)} strokeWidth={1.2} style={{ position: "absolute", top: -s(60), right: -s(60), color: primaryColor, opacity: config.bgImageUrl ? 0.05 : 0.08 }} />
          <Icon size={s(240)} strokeWidth={1.2} style={{ position: "absolute", bottom: -s(40), left: -s(40), color: accentColor, opacity: config.bgImageUrl ? 0.05 : 0.09 }} />
        </div>

        {/* Top brand band */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: s(14), background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }} />

        {/* SAFE AREA — centered composition, QR in the middle */}
        <div style={{ position: "absolute", inset: dims.safe, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", color: textColor, zIndex: 2 }}>
          {/* Header — brand */}
          <div style={{ display: "flex", alignItems: "center", gap: s(18), justifyContent: "center" }}>
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="" crossOrigin="anonymous" style={{ width: s(92), height: s(92), borderRadius: s(20), objectFit: "cover", background: "#fff", border: `${s(3)}px solid ${withAlpha(primaryColor, 0.25)}` }} />
            ) : (
              <div style={{ width: s(92), height: s(92), borderRadius: s(20), background: primaryColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: s(40) }}>
                {config.establishmentName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <div style={{ fontSize: s(16), letterSpacing: s(3), textTransform: "uppercase", opacity: 0.6, fontWeight: 600 }}>Cartão fidelidade</div>
              <div style={{ fontSize: s(34), fontWeight: 800, lineHeight: 1.1, marginTop: s(2) }}>{config.establishmentName}</div>
            </div>
          </div>

          {/* Title/subtitle just above the QR */}
          <div style={{ marginTop: s(28) }}>
            <h1 style={{ fontSize: s(isSquare ? 60 : 72), fontWeight: 900, lineHeight: 1.05, letterSpacing: -1, margin: 0, color: primaryColor }}>{config.title}</h1>
            <p style={{ fontSize: s(isSquare ? 22 : 24), lineHeight: 1.35, marginTop: s(14), opacity: 0.9, maxWidth: s(900), marginLeft: "auto", marginRight: "auto" }}>{config.subtitle}</p>
          </div>

          {/* CENTER — QR always in the middle */}
          <div style={{ margin: "auto 0", display: "flex", flexDirection: "column", alignItems: "center", gap: s(18) }}>
            <QRCard s={s} config={config} scale={config.qrScale ?? 1} />
          </div>

          {/* Reward + footer stacked at the bottom */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: s(16), width: "100%" }}>
            <div style={{ padding: `${s(18)}px ${s(28)}px`, borderRadius: s(999), background: withAlpha("#ffffff", 0.92), border: `${s(2)}px dashed ${withAlpha(primaryColor, 0.4)}`, maxWidth: "92%" }}>
              <span style={{ fontSize: s(14), textTransform: "uppercase", letterSpacing: s(2), opacity: 0.65, fontWeight: 700, marginRight: s(10) }}>Recompensa</span>
              <span style={{ fontSize: s(24), fontWeight: 800, color: primaryColor }}>{config.rewardText}</span>
            </div>
            <div style={{ fontSize: s(26), fontWeight: 800, color: primaryColor }}>{config.ctaFooter}</div>
            {config.contactLine && <div style={{ fontSize: s(18), opacity: 0.75 }}>{config.contactLine}</div>}
            {config.showBrand && <div style={{ fontSize: s(14), opacity: 0.55 }}>Powered by <strong>Fidelize</strong></div>}
          </div>
        </div>

        {config.showSafeArea && (
          <div style={{ position: "absolute", inset: dims.safe, border: `2px dashed ${withAlpha("#0ea5e9", 0.7)}`, pointerEvents: "none", zIndex: 3 }} />
        )}
      </div>

      {config.showCropMarks && dims.bleed > 0 && <CropMarks w={dims.w} h={dims.h} bleed={dims.bleed} />}
    </div>
  );
});

function QRCard({ s, config, scale = 1 }: { s: (n: number) => number; config: PromoConfig; scale?: number }) {
  const base = 460;
  const size = Math.round(s(base) * Math.max(0.5, Math.min(1.6, scale)));
  const qrColor = config.qrColor ?? config.primaryColor;
  return (
    <div style={{
      background: "#fff",
      padding: s(28),
      borderRadius: s(32),
      boxShadow: `0 ${s(20)}px ${s(60)}px ${withAlpha(qrColor, 0.3)}`,
      border: `${s(4)}px solid ${qrColor}`,
      textAlign: "center",
    }}>
      {config.qrDataUrl && <img src={config.qrDataUrl} alt="QR" style={{ width: size, height: size, display: "block" }} />}
      <div style={{ marginTop: s(14), fontSize: s(20), fontWeight: 700, color: qrColor }}>{config.ctaNearQR}</div>
    </div>
  );
}

function CropMarks({ w, h, bleed }: { w: number; h: number; bleed: number }) {
  const len = Math.round(bleed * 0.7);
  const stroke = Math.max(1, Math.round(bleed / 18));
  const line = { position: "absolute" as const, background: "#111" };
  void w; void h;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      <div style={{ ...line, top: bleed, left: 0, width: len, height: stroke }} />
      <div style={{ ...line, top: 0, left: bleed, width: stroke, height: len }} />
      <div style={{ ...line, top: bleed, right: 0, width: len, height: stroke }} />
      <div style={{ ...line, top: 0, right: bleed, width: stroke, height: len }} />
      <div style={{ ...line, bottom: bleed, left: 0, width: len, height: stroke }} />
      <div style={{ ...line, bottom: 0, left: bleed, width: stroke, height: len }} />
      <div style={{ ...line, bottom: bleed, right: 0, width: len, height: stroke }} />
      <div style={{ ...line, bottom: 0, right: bleed, width: stroke, height: len }} />
    </div>
  );
}
