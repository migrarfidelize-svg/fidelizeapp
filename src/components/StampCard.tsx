import { Gift } from "lucide-react";
import { getStampIcon } from "@/lib/stampIcons";

function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  brandName: string;
  logoUrl?: string | null;
  customerName?: string;
  stamps: number;
  required: number;
  reward: string;
  primary?: string;
  accent?: string;
  icon?: string;
  code?: string;
}

export function StampCard({ brandName, logoUrl, customerName, stamps, required, reward, primary = "#5B21B6", accent = "#F97066", icon = "coffee", code }: Props) {
  const Icon = ICONS[icon] ?? Coffee;
  const cells = Array.from({ length: required }, (_, i) => i < stamps);
  const missing = Math.max(0, required - stamps);
  return (
    <div
      className="w-full max-w-sm rounded-3xl p-6 text-white shadow-2xl"
      style={{ background: `linear-gradient(135deg, ${primary} 0%, ${accent} 130%)` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 w-10 object-contain" />
          ) : (
            <div className="grid h-10 w-10 place-items-center rounded-full bg-white/20 backdrop-blur ring-2 ring-white/30 font-display font-bold text-sm">
              {initialsOf(brandName)}
            </div>
          )}
          <div>
            <div className="text-[10px] font-medium uppercase tracking-widest opacity-70">Cartão fidelidade</div>
            <div className="font-display font-bold leading-tight">{brandName}</div>
          </div>
        </div>
        {code && <div className="text-[10px] font-mono opacity-70">#{code}</div>}
      </div>

      {customerName && <div className="mt-4 text-sm opacity-90">Olá, <span className="font-semibold">{customerName}</span></div>}

      <div className="mt-5 grid grid-cols-5 gap-2">
        {cells.map((filled, i) => (
          <div key={i} className={`aspect-square rounded-xl grid place-items-center transition ${filled ? "bg-white text-black" : "bg-white/10 text-white/40 border border-white/20"}`}>
            <Icon className="h-5 w-5" />
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-white/15 backdrop-blur p-4">
        <div className="flex items-center gap-2 text-xs opacity-80"><Gift className="h-3.5 w-3.5" /> Recompensa</div>
        <div className="mt-1 font-display font-semibold">{reward}</div>
        <div className="mt-2 text-xs opacity-80">
          {missing > 0 ? `Faltam ${missing} carimbo${missing > 1 ? "s" : ""} para o prêmio` : "Recompensa conquistada!"}
        </div>
      </div>
    </div>
  );
}
