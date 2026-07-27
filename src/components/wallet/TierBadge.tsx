import { Award, Crown, Gem, Medal } from "lucide-react";

export type CustomerTier = "bronze" | "prata" | "ouro" | "diamante" | string | null | undefined;

const META: Record<string, { label: string; color: string; ring: string; Icon: React.ComponentType<{ className?: string }> }> = {
  bronze: { label: "Bronze", color: "#c48b57", ring: "border-[#c48b57]/50 bg-[#c48b57]/10 text-[#e5b48a]", Icon: Medal },
  prata: { label: "Prata", color: "#c5c9d1", ring: "border-[#c5c9d1]/50 bg-[#c5c9d1]/10 text-[#e2e5eb]", Icon: Award },
  ouro: { label: "Ouro", color: "#facc15", ring: "border-yellow-400/50 bg-yellow-400/10 text-yellow-300", Icon: Crown },
  diamante: { label: "Diamante", color: "#67e8f9", ring: "border-violet-300/60 bg-violet-300/10 text-violet-200", Icon: Gem },
};

/** Selo compacto do nível do cliente (bronze/prata/ouro/diamante). */
export function TierBadge({
  tier,
  size = "sm",
  className = "",
}: {
  tier: CustomerTier;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const key = (tier ?? "bronze").toString().toLowerCase();
  const m = META[key] ?? META.bronze;
  const Icon = m.Icon;
  const sz =
    size === "xs"
      ? "px-1.5 py-0.5 text-[9px] gap-1"
      : size === "md"
      ? "px-2.5 py-1 text-[11px] gap-1.5"
      : "px-2 py-0.5 text-[10px] gap-1";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-black uppercase tracking-widest ${m.ring} ${sz} ${className}`}
      title={`Nível ${m.label}`}
      aria-label={`Nível ${m.label}`}
    >
      <Icon className={icon} />
      {m.label}
    </span>
  );
}
