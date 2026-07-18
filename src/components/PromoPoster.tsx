import { forwardRef } from "react";
import { Flame, Coffee, Scissors, PawPrint, Droplets, Sparkles, Utensils, Wrench, ShoppingBag, Heart } from "lucide-react";

export type PromoFormat = "poster" | "counter" | "sticker" | "story" | "feed" | "table";
export type Segment = "espetinhos" | "cafeteria" | "barbearia" | "petshop" | "lavajato" | "salao" | "restaurante" | "oficina" | "loja" | "outro";

/** Format metadata:
 * - w/h: full canvas in pixels (includes bleed for print)
 * - bleed: px of bleed on each side (0 for digital)
 * - safe: extra px inside trim line — content must stay inside safe area
 * - mm: physical size in mm (only for print formats — enables true-scale PDF export)
 * - print: renders crop marks
 */
export const FORMATS: Record<PromoFormat, { label: string; w: number; h: number; bleed: number; safe: number; mm?: { w: number; h: number }; print: boolean; description: string }> = {
  poster:  { label: "Cartaz A4",  w: 1287, h: 1808, bleed: 36, safe: 48, mm: { w: 216, h: 303 }, print: true,  description: "A4 para imprimir e colar" },
  counter: { label: "Balcão",     w: 1097, h: 1547, bleed: 36, safe: 48, mm: { w: 155, h: 218 }, print: true,  description: "Display de acrílico no caixa" },
  sticker: { label: "Adesivo",    w: 1247, h: 1247, bleed: 36, safe: 48, mm: { w: 105, h: 105 }, print: true,  description: "Mesa, embalagem ou vitrine" },
  table:   { label: "Mesa",       w: 1547, h: 1097, bleed: 36, safe: 48, mm: { w: 218, h: 155 }, print: true,  description: "Display horizontal / cardápio" },
  story:   { label: "Story",      w: 1080, h: 1920, bleed: 0,  safe: 90, print: false, description: "Instagram / WhatsApp Status" },
  feed:    { label: "Feed",       w: 1080, h: 1080, bleed: 0,  safe: 80, print: false, description: "Instagram / Facebook" },
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
  // Custom background image
  bgImageUrl?: string | null;
  bgZoom?: number;      // 1 = cover; >1 zooms in
  bgOffsetX?: number;   // -50 to 50 (percent)
  bgOffsetY?: number;
  bgOverlay?: number;   // 0 to 1 — white overlay opacity to protect readability
  // Print helpers
  showCropMarks?: boolean;
  showSafeArea?: boolean; // preview-only guide
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
  const isHorizontal = dims.w > dims.h;
  const isSquare = dims.w === dims.h;

  const trimW = dims.w - dims.bleed * 2;
  const trimH = dims.h - dims.bleed * 2;
  const base = Math.min(trimW, trimH);
  const s = (n: number) => Math.round((n / 1080) * base);

  const layout = isHorizontal ? "horizontal" : "vertical";
  const bgZoom = config.bgZoom ?? 1;
  const bgOx = config.bgOffsetX ?? 0;
  const bgOy = config.bgOffsetY ?? 0;
  const bgOverlay = config.bgOverlay ?? 0.35;

  return (
    <div
      ref={ref}
      style={{
        width: dims.w, height: dims.h,
        position: "relative", overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        background: backgroundColor,
      }}
    >
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
      {/* Overlay to protect contrast when a bg image is present */}
      {config.bgImageUrl && (
        <div style={{ position: "absolute", inset: 0, background: withAlpha(backgroundColor, bgOverlay) }} />
      )}
      {/* Brand gradient wash (subtler when image is present) */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: config.bgImageUrl
            ? `linear-gradient(160deg, ${withAlpha(primaryColor, 0.06)} 0%, transparent 55%, ${withAlpha(accentColor, 0.08)} 100%)`
            : `linear-gradient(160deg, ${withAlpha(primaryColor, 0.12)} 0%, transparent 55%, ${withAlpha(accentColor, 0.18)} 100%)`,
        }}
      />

      {/* Trim area (inside bleed) */}
      <div style={{ position: "absolute", top: dims.bleed, left: dims.bleed, width: trimW, height: trimH }}>
        {/* Decorative segment icons — inside trim, outside safe */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          <Icon size={s(320)} strokeWidth={1.2} style={{ position: "absolute", top: -s(60), right: -s(60), color: primaryColor, opacity: config.bgImageUrl ? 0.05 : 0.08 }} />
          <Icon size={s(240)} strokeWidth={1.2} style={{ position: "absolute", bottom: -s(40), left: -s(40), color: accentColor, opacity: config.bgImageUrl ? 0.05 : 0.09 }} />
          <Icon size={s(120)} strokeWidth={1.2} style={{ position: "absolute", top: "42%", left: s(20), color: primaryColor, opacity: 0.05 }} />
        </div>

        {/* Header band */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: s(14), background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})` }} />

        {/* SAFE AREA — all content lives inside */}
        <div style={{ position: "absolute", inset: dims.safe, display: "flex", flexDirection: layout === "horizontal" ? "row" : "column", gap: s(28), zIndex: 2 }}>
          {layout === "vertical" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: s(28), width: "100%", height: "100%", color: textColor }}>
              <div style={{ display: "flex", alignItems: "center", gap: s(20) }}>
                {config.logoUrl ? (
                  <img src={config.logoUrl} alt="" crossOrigin="anonymous" style={{ width: s(110), height: s(110), borderRadius: s(24), objectFit: "cover", background: "#fff", border: `${s(3)}px solid ${withAlpha(primaryColor, 0.2)}` }} />
                ) : (
                  <div style={{ width: s(110), height: s(110), borderRadius: s(24), background: primaryColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: s(48) }}>
                    {config.establishmentName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: s(20), letterSpacing: s(3), textTransform: "uppercase", opacity: 0.6, fontWeight: 600 }}>Cartão fidelidade digital</div>
                  <div style={{ fontSize: s(44), fontWeight: 800, lineHeight: 1.1, marginTop: s(4) }}>{config.establishmentName}</div>
                </div>
              </div>

              <div>
                <h1 style={{ fontSize: s(isSquare ? 82 : 96), fontWeight: 900, lineHeight: 1.02, letterSpacing: -1, margin: 0, color: primaryColor }}>{config.title}</h1>
                <p style={{ fontSize: s(30), lineHeight: 1.35, marginTop: s(20), opacity: 0.9, maxWidth: "92%" }}>{config.subtitle}</p>
              </div>

              <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "auto 1fr", gap: s(40), alignItems: "center" }}>
                <QRCard s={s} config={config} />
                <div style={{ display: "flex", flexDirection: "column", gap: s(18) }}>
                  <div style={{ padding: s(24), borderRadius: s(24), background: withAlpha("#ffffff", 0.85), border: `${s(2)}px dashed ${withAlpha(primaryColor, 0.35)}` }}>
                    <div style={{ fontSize: s(18), textTransform: "uppercase", letterSpacing: s(2), opacity: 0.65, fontWeight: 700 }}>Sua recompensa</div>
                    <div style={{ fontSize: s(34), fontWeight: 800, marginTop: s(8), color: primaryColor, lineHeight: 1.15 }}>{config.rewardText}</div>
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: s(10) }}>
                    {config.benefits.slice(0, 4).map((b, i) => (
                      <li key={i} style={{ fontSize: s(22), display: "flex", alignItems: "center", gap: s(12) }}>
                        <span style={{ width: s(12), height: s(12), borderRadius: 999, background: accentColor, flexShrink: 0 }} />{b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `${s(2)}px solid ${withAlpha(primaryColor, 0.15)}`, paddingTop: s(20) }}>
                <div>
                  <div style={{ fontSize: s(26), fontWeight: 800, color: primaryColor }}>{config.ctaFooter}</div>
                  {config.contactLine && <div style={{ fontSize: s(18), opacity: 0.7, marginTop: s(4) }}>{config.contactLine}</div>}
                </div>
                {config.showBrand && (
                  <div style={{ fontSize: s(16), opacity: 0.55, textAlign: "right" }}>Powered by<div style={{ fontWeight: 800, fontSize: s(20) }}>Fidelize</div></div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr auto", gap: s(60), width: "100%", height: "100%", alignItems: "center", color: textColor }}>
              <div style={{ display: "flex", flexDirection: "column", gap: s(24) }}>
                <div style={{ display: "flex", alignItems: "center", gap: s(20) }}>
                  {config.logoUrl ? (
                    <img src={config.logoUrl} alt="" crossOrigin="anonymous" style={{ width: s(90), height: s(90), borderRadius: s(20), objectFit: "cover", background: "#fff" }} />
                  ) : (
                    <div style={{ width: s(90), height: s(90), borderRadius: s(20), background: primaryColor, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: s(40) }}>
                      {config.establishmentName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: s(18), letterSpacing: s(3), textTransform: "uppercase", opacity: 0.6, fontWeight: 600 }}>Cartão fidelidade digital</div>
                    <div style={{ fontSize: s(38), fontWeight: 800 }}>{config.establishmentName}</div>
                  </div>
                </div>
                <h1 style={{ fontSize: s(84), fontWeight: 900, lineHeight: 1.02, letterSpacing: -1, margin: 0, color: primaryColor }}>{config.title}</h1>
                <p style={{ fontSize: s(26), lineHeight: 1.35, opacity: 0.9, margin: 0 }}>{config.subtitle}</p>
                <div style={{ padding: s(22), borderRadius: s(22), background: withAlpha("#ffffff", 0.85), border: `${s(2)}px dashed ${withAlpha(primaryColor, 0.35)}`, alignSelf: "flex-start", maxWidth: "90%" }}>
                  <div style={{ fontSize: s(16), textTransform: "uppercase", letterSpacing: s(2), opacity: 0.65, fontWeight: 700 }}>Sua recompensa</div>
                  <div style={{ fontSize: s(30), fontWeight: 800, marginTop: s(6), color: primaryColor }}>{config.rewardText}</div>
                </div>
                <div style={{ fontSize: s(24), fontWeight: 800, color: primaryColor }}>{config.ctaFooter}</div>
                {config.showBrand && <div style={{ fontSize: s(14), opacity: 0.5 }}>Powered by Fidelize</div>}
              </div>
              <QRCard s={s} config={config} big />
            </div>
          )}
        </div>

        {/* Safe area guide (preview only) */}
        {config.showSafeArea && (
          <div style={{ position: "absolute", inset: dims.safe, border: `2px dashed ${withAlpha("#0ea5e9", 0.7)}`, pointerEvents: "none", zIndex: 3 }} />
        )}
      </div>

      {/* Crop marks (print only) */}
      {config.showCropMarks && dims.bleed > 0 && <CropMarks w={dims.w} h={dims.h} bleed={dims.bleed} />}
    </div>
  );
});

function QRCard({ s, config, big }: { s: (n: number) => number; config: PromoConfig; big?: boolean }) {
  const size = big ? s(420) : s(360);
  return (
    <div style={{
      background: "#fff",
      padding: s(28),
      borderRadius: s(32),
      boxShadow: `0 ${s(20)}px ${s(60)}px ${withAlpha(config.primaryColor, 0.3)}`,
      border: `${s(4)}px solid ${config.primaryColor}`,
      textAlign: "center",
    }}>
      {config.qrDataUrl && <img src={config.qrDataUrl} alt="QR" style={{ width: size, height: size, display: "block" }} />}
      <div style={{ marginTop: s(14), fontSize: s(20), fontWeight: 700, color: config.primaryColor }}>{config.ctaNearQR}</div>
    </div>
  );
}

function CropMarks({ w, h, bleed }: { w: number; h: number; bleed: number }) {
  const len = Math.round(bleed * 0.7);
  const stroke = Math.max(1, Math.round(bleed / 18));
  const line = { position: "absolute" as const, background: "#111" };
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 4 }}>
      {/* TL */}
      <div style={{ ...line, top: bleed, left: 0, width: len, height: stroke }} />
      <div style={{ ...line, top: 0, left: bleed, width: stroke, height: len }} />
      {/* TR */}
      <div style={{ ...line, top: bleed, right: 0, width: len, height: stroke }} />
      <div style={{ ...line, top: 0, right: bleed, width: stroke, height: len }} />
      {/* BL */}
      <div style={{ ...line, bottom: bleed, left: 0, width: len, height: stroke }} />
      <div style={{ ...line, bottom: 0, left: bleed, width: stroke, height: len }} />
      {/* BR */}
      <div style={{ ...line, bottom: bleed, right: 0, width: len, height: stroke }} />
      <div style={{ ...line, bottom: 0, right: bleed, width: stroke, height: len }} />
    </div>
  );
}
