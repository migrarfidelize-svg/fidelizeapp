import * as Icons from "lucide-react";
import { Lock } from "lucide-react";

export type BadgeProps = {
  code: string;
  title: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlocked: boolean;
  unlockedAt?: string | null;
  compact?: boolean;
};

const RARITY_STYLES: Record<BadgeProps["rarity"], { ring: string; bg: string; text: string; label: string }> = {
  common: {
    ring: "ring-border/60",
    bg: "bg-muted",
    text: "text-muted-foreground",
    label: "Comum",
  },
  rare: {
    ring: "ring-sky-400/60",
    bg: "bg-gradient-to-br from-sky-500/25 to-blue-500/15",
    text: "text-sky-500 dark:text-sky-300",
    label: "Rara",
  },
  epic: {
    ring: "ring-fuchsia-400/70",
    bg: "bg-gradient-to-br from-fuchsia-500/25 to-purple-500/15",
    text: "text-fuchsia-500 dark:text-fuchsia-300",
    label: "Épica",
  },
  legendary: {
    ring: "ring-amber-400/80",
    bg: "bg-gradient-to-br from-amber-500/30 via-orange-500/20 to-red-500/15",
    text: "text-amber-500 dark:text-amber-300",
    label: "Lendária",
  },
};

export function AchievementBadge({
  title,
  description,
  icon,
  rarity,
  unlocked,
  unlockedAt,
  compact,
}: BadgeProps) {
  // Dynamic Lucide icon lookup with safe fallback.
  const IconComp =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[icon] ??
    Icons.Award;
  const style = RARITY_STYLES[rarity];

  if (compact) {
    return (
      <div
        className={
          "flex items-center gap-2 rounded-2xl border border-border/60 p-2 " +
          (unlocked ? "" : "opacity-40 grayscale")
        }
      >
        <div
          className={
            "grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 " +
            style.ring +
            " " +
            style.bg +
            " " +
            style.text
          }
        >
          {unlocked ? <IconComp className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">{title}</div>
          <div className="truncate text-[10px] text-muted-foreground">{style.label}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        "group relative flex flex-col items-center gap-2 rounded-3xl border border-border/60 bg-card/40 p-4 text-center transition-all " +
        (unlocked ? "hover:border-primary/40 hover:shadow-md" : "opacity-50 grayscale")
      }
    >
      {rarity === "legendary" && unlocked && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -inset-1 animate-pulse bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/10" />
        </div>
      )}
      <div
        className={
          "relative grid h-16 w-16 place-items-center rounded-2xl ring-2 " +
          style.ring +
          " " +
          style.bg +
          " " +
          style.text +
          " shadow-inner"
        }
      >
        {unlocked ? <IconComp className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 font-display text-sm font-bold">{title}</div>
        <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{description}</div>
      </div>
      <span
        className={
          "rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest " +
          (unlocked ? style.text + " border-current/40" : "border-border text-muted-foreground")
        }
      >
        {unlocked ? style.label : "Bloqueada"}
      </span>
      {unlocked && unlockedAt && (
        <div className="text-[10px] text-muted-foreground">
          {new Date(unlockedAt).toLocaleDateString("pt-BR")}
        </div>
      )}
    </div>
  );
}
