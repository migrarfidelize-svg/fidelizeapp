import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Stamp, Users, Trophy } from "lucide-react";

interface Props {
  series: { day: string; carimbos: number }[];
  todayStamps: number;
  customers: number;
  redeemed: number;
}

/**
 * Pré-visualização real da funcionalidade do painel: mini sparkline ao vivo
 * dos últimos 14 dias + badges de KPI com pulsação cyan.
 */
export function DashboardHeroVisual({ series, todayStamps, customers, redeemed }: Props) {
  const data = series.slice(-14);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-[color:color-mix(in_oklab,var(--card)_70%,transparent)] backdrop-blur-xl p-4 shadow-[0_0_40px_-20px_var(--primary)]">
      {/* HUD label */}
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]" />
          Fluxo ao vivo · 14 dias
        </span>
        <span className="font-mono text-primary/80">FIDELIZE · OPS</span>
      </div>

      {/* Sparkline */}
      <div className="mt-2 h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="heroSpark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="carimbos"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#heroSpark)"
              isAnimationActive
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* KPI badges */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        {[
          { icon: Stamp, label: "Hoje", value: todayStamps },
          { icon: Users, label: "Clientes", value: customers },
          { icon: Trophy, label: "Resgates", value: redeemed },
        ].map((k) => (
          <div
            key={k.label}
            className="flex items-center gap-2 rounded-lg border border-primary/20 bg-background/40 px-2 py-1.5"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <k.icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
              <div className="text-sm font-semibold tabular-nums">{k.value.toLocaleString("pt-BR")}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Scanline sweep */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
      <span className="pointer-events-none absolute -inset-x-4 top-1/3 h-24 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)] blur-2xl" />
    </div>
  );
}
