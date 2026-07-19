import { Award, Gem, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustomerTier = "bronze" | "prata" | "ouro" | "diamante";

const TIER_META: Record<CustomerTier, { label: string; className: string; Icon: typeof Award }> = {
  bronze: {
    label: "Bronze",
    className: "bg-amber-700/10 text-amber-800 ring-amber-700/30 dark:text-amber-300",
    Icon: Medal,
  },
  prata: {
    label: "Prata",
    className: "bg-slate-400/15 text-slate-700 ring-slate-400/40 dark:text-slate-200",
    Icon: Award,
  },
  ouro: {
    label: "Ouro",
    className: "bg-yellow-400/15 text-yellow-800 ring-yellow-500/40 dark:text-yellow-200",
    Icon: Trophy,
  },
  diamante: {
    label: "Diamante",
    className: "bg-cyan-400/15 text-cyan-800 ring-cyan-500/40 dark:text-cyan-200",
    Icon: Gem,
  },
};

export function TierBadge({
  tier,
  className,
  compact = false,
}: {
  tier: CustomerTier;
  className?: string;
  compact?: boolean;
}) {
  const meta = TIER_META[tier];
  const { Icon } = meta;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full ring-1 font-semibold",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        meta.className,
        className,
      )}
      aria-label={`Nível ${meta.label}`}
    >
      <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} aria-hidden />
      {meta.label}
    </span>
  );
}

export function nextTierInfo(tier: CustomerTier, visits: number, thresholds?: Record<string, number>) {
  const t = thresholds ?? { bronze: 0, prata: 10, ouro: 25, diamante: 50 };
  const order: CustomerTier[] = ["bronze", "prata", "ouro", "diamante"];
  const idx = order.indexOf(tier);
  const next = order[idx + 1];
  if (!next) return null;
  const need = t[next] - visits;
  return { next, need: Math.max(0, need) };
}
