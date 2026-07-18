import { forwardRef } from "react";
import { Flame, Coffee, Scissors, PawPrint, Droplets, Sparkles, Utensils, Wrench, ShoppingBag, Heart, Store, Dog } from "lucide-react";

export type PromoFormat = "poster" | "counter" | "sticker" | "story" | "feed" | "table";
export type Segment = "espetinhos" | "cafeteria" | "barbearia" | "petshop" | "lavajato" | "salao" | "restaurante" | "oficina" | "loja" | "outro";

export const FORMATS: Record<PromoFormat, { label: string; w: number; h: number; description: string }> = {
  poster: { label: "Cartaz A4", w: 1240, h: 1754, description: "Para imprimir e colar" },
  counter: { label: "Balcão", w: 1050, h: 1500, description: "Display de acrílico no caixa" },
  sticker: { label: "Adesivo", w: 1200, h: 1200, description: "Mesa, embalagem ou vitrine" },
  story: { label: "Story", w: 1080, h: 1920, description: "Instagram / WhatsApp Status" },
  feed: { label: "Feed", w: 1080, h: 1080, description: "Instagram / Facebook" },
  table: { label: "Mesa", w: 1500, h: 1050, description: "Display horizontal / cardápio" },
};

const SEGMENT_ICON: Record<Segment, any> = {
  espetinhos: Flame,
  cafeteria: Coffee,
  barbearia: Scissors,
  petshop: PawPrint,
  lavajato: Droplets,
  salao: Sparkles,
  restaurante: Utensils,
  oficina: Wrench,
  loja: ShoppingBag,
  outro: Heart,
};

export const SEGMENT_LABEL: Record<Segment, string> = {
  espetinhos: "Espetinhos / Churrasco",
  cafeteria: "Cafeteria",
  barbearia: "Barbearia",
  petshop: "Pet shop",
  lavajato: "Lava-jato",
  salao: "Salão / Beleza",
  restaurante: "Restaurante / Lanchonete",
  oficina: "Oficina",
  loja: "Loja / Varejo",
  outro: "Outro",
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
}

/** Simple hex → rgba helper for translucent overlays */
function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export const PromoPoster = forwardRef<HTMLDivElement, { config: PromoConfig }>(function PromoPoster({ config }, ref) {
  const { format, segment, primaryColor, accentColor, backgroundColor, textColor } = config;
  const dims = FORMATS[format];
  const Icon = SEGMENT_ICON[segment] ?? Heart;
  const isHorizontal = dims.w > dims.h;
  const isSquare = dims.w === dims.h;

  // Scale text with canvas size
  const base = Math.min(dims.w, dims.h);
  const s = (n: number) => Math.round((n / 1080) * base);

  const layout = isHorizontal ? "horizontal" : "vertical";

  return (
    <div
      ref={ref}
      style={{
        width: dims.w,
        height: dims.h,
        background: `linear-gradient(160deg, ${backgroundColor} 0%, ${withAlpha(primaryColor, 0.12)} 60%, ${withAlpha(accentColor, 0.18)} 100%)`,
        color: textColor,
        position: "relative",
        overflow: "hidden",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: layout === "horizontal" ? "row" : "column",
      }}
    >
      {/* Decorative background icons */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <Icon size={s(320)} strokeWidth={1.2} style={{ position: "absolute", top: -s(60), right: -s(60), color: primaryColor, opacity: 0.08 }} />
        <Icon size={s(240)} strokeWidth={1.2} style={{ position: "absolute", bottom: -s(40), left: -s(40), color: accentColor, opacity: 0.09 }} />
        <Icon size={s(120)} strokeWidth={1.2} style={{ position: "absolute", top: "42%", left: s(40), color: primaryColor, opacity: 0.06 }} />
        <Icon size={s(90)} strokeWidth={1.2} style={{ position: "absolute", top: "18%", left: "42%", color: accentColor, opacity: 0.05 }} />
      </div>

      {/* Header band */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          height: s(14),
          background: `linear-gradient(90deg, ${primaryColor}, ${accentColor})`,
        }}
      />

      {/* CONTENT */}
      {layout === "vertical" ? (
        <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", padding: s(70), gap: s(28), zIndex: 2 }}>
          {/* Brand row */}
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

          {/* Title */}
          <div>
            <h1 style={{ fontSize: s(isSquare ? 82 : 96), fontWeight: 900, lineHeight: 1.02, letterSpacing: -1, margin: 0, color: primaryColor }}>{config.title}</h1>
            <p style={{ fontSize: s(30), lineHeight: 1.35, marginTop: s(20), opacity: 0.85, maxWidth: "92%" }}>{config.subtitle}</p>
          </div>

          {/* QR + reward block */}
          <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "auto 1fr", gap: s(40), alignItems: "center" }}>
            <div style={{ background: "#fff", padding: s(28), borderRadius: s(32), boxShadow: `0 ${s(20)}px ${s(60)}px ${withAlpha(primaryColor, 0.25)}`, border: `${s(4)}px solid ${primaryColor}` }}>
              <img src={config.qrDataUrl} alt="QR" style={{ width: s(360), height: s(360), display: "block" }} />
              <div style={{ marginTop: s(14), textAlign: "center", fontSize: s(20), fontWeight: 700, color: primaryColor }}>{config.ctaNearQR}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: s(18) }}>
              <div style={{ padding: s(24), borderRadius: s(24), background: withAlpha(primaryColor, 0.08), border: `${s(2)}px dashed ${withAlpha(primaryColor, 0.35)}` }}>
                <div style={{ fontSize: s(18), textTransform: "uppercase", letterSpacing: s(2), opacity: 0.65, fontWeight: 700 }}>Sua recompensa</div>
                <div style={{ fontSize: s(34), fontWeight: 800, marginTop: s(8), color: primaryColor, lineHeight: 1.15 }}>{config.rewardText}</div>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: s(10) }}>
                {config.benefits.slice(0, 4).map((b, i) => (
                  <li key={i} style={{ fontSize: s(22), display: "flex", alignItems: "center", gap: s(12) }}>
                    <span style={{ width: s(12), height: s(12), borderRadius: 999, background: accentColor, flexShrink: 0 }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `${s(2)}px solid ${withAlpha(primaryColor, 0.15)}`, paddingTop: s(20), marginTop: s(10) }}>
            <div>
              <div style={{ fontSize: s(26), fontWeight: 800, color: primaryColor }}>{config.ctaFooter}</div>
              {config.contactLine && <div style={{ fontSize: s(18), opacity: 0.7, marginTop: s(4) }}>{config.contactLine}</div>}
            </div>
            {config.showBrand && (
              <div style={{ fontSize: s(16), opacity: 0.55, textAlign: "right" }}>
                Powered by
                <div style={{ fontWeight: 800, fontSize: s(20), letterSpacing: -0.3 }}>Fidelize</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // HORIZONTAL layout (table)
        <div style={{ position: "relative", flex: 1, display: "grid", gridTemplateColumns: "1.2fr auto", padding: s(70), gap: s(60), zIndex: 2, alignItems: "center" }}>
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
            <p style={{ fontSize: s(26), lineHeight: 1.35, opacity: 0.85, margin: 0 }}>{config.subtitle}</p>
            <div style={{ padding: s(22), borderRadius: s(22), background: withAlpha(primaryColor, 0.08), border: `${s(2)}px dashed ${withAlpha(primaryColor, 0.35)}`, alignSelf: "flex-start", maxWidth: "90%" }}>
              <div style={{ fontSize: s(16), textTransform: "uppercase", letterSpacing: s(2), opacity: 0.65, fontWeight: 700 }}>Sua recompensa</div>
              <div style={{ fontSize: s(30), fontWeight: 800, marginTop: s(6), color: primaryColor }}>{config.rewardText}</div>
            </div>
            <div style={{ fontSize: s(24), fontWeight: 800, color: primaryColor }}>{config.ctaFooter}</div>
            {config.showBrand && <div style={{ fontSize: s(14), opacity: 0.5 }}>Powered by Fidelize</div>}
          </div>
          <div style={{ background: "#fff", padding: s(28), borderRadius: s(32), boxShadow: `0 ${s(20)}px ${s(60)}px ${withAlpha(primaryColor, 0.25)}`, border: `${s(4)}px solid ${primaryColor}`, textAlign: "center" }}>
            <img src={config.qrDataUrl} alt="QR" style={{ width: s(420), height: s(420), display: "block" }} />
            <div style={{ marginTop: s(14), fontSize: s(20), fontWeight: 700, color: primaryColor }}>{config.ctaNearQR}</div>
          </div>
        </div>
      )}
    </div>
  );
});
