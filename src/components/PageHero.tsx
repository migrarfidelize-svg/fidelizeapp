import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface HeroTicker {
  label: string;
  value: string | number;
  icon: LucideIcon;
}

interface PageHeroProps {
  eyebrow?: ReactNode;
  liveLabel?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  ticker?: HeroTicker[];
  icon?: LucideIcon;
  visual?: ReactNode;
}

/**
 * Cabeçalho cinematográfico compartilhado entre todas as guias do painel.
 * - Grid drift + beam superior + scan lateral + brackets HUD.
 * - Cor cyan sólida, sem degradê no conteúdo.
 * - Slot `visual` opcional para pré-visualização real da funcionalidade.
 */
export function PageHero({
  eyebrow, liveLabel, title, subtitle, actions, ticker, icon: Icon, visual,
}: PageHeroProps) {
  return (
    <section className="dash-hero p-4 sm:p-8">
      <span className="hero-corner hero-corner-tl" aria-hidden />
      <span className="hero-corner hero-corner-tr" aria-hidden />
      <span className="hero-corner hero-corner-bl" aria-hidden />
      <span className="hero-corner hero-corner-br" aria-hidden />
      <span className="hero-scan" aria-hidden />

      <div className={`hero-reveal relative grid gap-6 ${visual ? "lg:grid-cols-[1fr_minmax(280px,420px)] items-center" : ""}`}>
        <div className="min-w-0 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {liveLabel && <span className="live-pulse">{liveLabel}</span>}
              {eyebrow && (
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {eyebrow}
                </span>
              )}
            </div>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              {Icon && (
                <span className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_-6px_var(--primary)] shrink-0">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <h1 className="min-w-0 font-display text-2xl sm:text-4xl font-bold tracking-tight break-words">
                {title}
              </h1>

            </div>
            {subtitle && (
              <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {visual && (
          <div className="hidden lg:block relative">{visual}</div>
        )}
      </div>


      {ticker && ticker.length > 0 && (
        <div
          className="hero-reveal relative mt-5 grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-sm"
          style={{ animationDelay: "120ms" }}
        >
          {ticker.map((t) => (
            <div
              key={t.label}
              className="flex min-w-0 items-center gap-2.5 rounded-lg border border-primary/15 bg-[color:color-mix(in_oklab,var(--card)_60%,transparent)] px-3 py-2.5 backdrop-blur-sm"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <t.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                  {t.label}
                </div>
                <div className="text-sm font-semibold leading-tight break-words">{t.value}</div>
              </div>

            </div>
          ))}
        </div>
      )}
    </section>
  );
}
