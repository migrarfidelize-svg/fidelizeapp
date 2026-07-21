import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Target, Crosshair, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertGoals } from "@/lib/goals.functions";

type Goals = { stamps_goal: number; customers_goal: number; rewards_goal: number; revenue_goal: number };

export function GoalsCard({
  establishmentId,
  month,
  goals,
  current,
}: {
  establishmentId: string;
  month: string;
  goals: Goals;
  current: { stamps: number; customers: number; rewards: number };
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Goals>(goals);
  const save = useServerFn(upsertGoals);
  const m = useMutation({
    mutationFn: () => save({ data: { establishment_id: establishmentId, month, ...form } }),
    onSuccess: () => {
      toast.success("Metas atualizadas!");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar metas"),
  });

  // Animation phases: idle -> mira -> reveal
  const cardRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "mira" | "reveal">("idle");
  const hasPlayed = useRef(false);

  useEffect(() => {
    if (!cardRef.current || hasPlayed.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !hasPlayed.current) {
            hasPlayed.current = true;
            setPhase("mira");
            setTimeout(() => setPhase("reveal"), 1350);
            io.disconnect();
          }
        }
      },
      { threshold: 0.35 }
    );
    io.observe(cardRef.current);
    return () => io.disconnect();
  }, []);

  const rows = [
    { label: "Novos clientes", now: current.customers, goal: goals.customers_goal, icon: Sparkles },
    { label: "Carimbos", now: current.stamps, goal: goals.stamps_goal, icon: Target },
    { label: "Recompensas resgatadas", now: current.rewards, goal: goals.rewards_goal, icon: TrendingUp },
  ];

  const monthLabel = new Date(month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div ref={cardRef} className="goals-premium dash-card relative overflow-hidden p-6 sm:p-8">
      {/* Ambient background grid */}
      <span className="goals-grid" aria-hidden />
      <span className="goals-scan" aria-hidden />

      {/* MIRA / Crosshair overlay */}
      {phase !== "idle" && (
        <div className={`goals-mira ${phase === "reveal" ? "is-out" : "is-in"}`} aria-hidden>
          <svg viewBox="0 0 400 400" className="h-[min(85%,420px)] w-[min(85%,420px)]">
            <defs>
              <radialGradient id="miraGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="200" r="180" fill="url(#miraGlow)" />
            {/* rotating outer ring with ticks */}
            <g className="mira-rot">
              <circle cx="200" cy="200" r="170" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 8" />
              <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
              {Array.from({ length: 24 }).map((_, i) => (
                <line
                  key={i}
                  x1="200"
                  y1="30"
                  x2="200"
                  y2={i % 6 === 0 ? 55 : 45}
                  stroke="currentColor"
                  strokeOpacity={i % 6 === 0 ? 0.9 : 0.5}
                  strokeWidth={i % 6 === 0 ? 2 : 1}
                  transform={`rotate(${i * 15} 200 200)`}
                />
              ))}
            </g>
            {/* expanding rings */}
            <circle className="mira-pulse" cx="200" cy="200" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle className="mira-pulse mira-pulse-2" cx="200" cy="200" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
            {/* crosshair */}
            <g stroke="currentColor" strokeWidth="1.5">
              <line x1="200" y1="10" x2="200" y2="90" strokeOpacity="0.9" />
              <line x1="200" y1="310" x2="200" y2="390" strokeOpacity="0.9" />
              <line x1="10" y1="200" x2="90" y2="200" strokeOpacity="0.9" />
              <line x1="310" y1="200" x2="390" y2="200" strokeOpacity="0.9" />
            </g>
            {/* center dot */}
            <circle cx="200" cy="200" r="4" fill="currentColor" />
            <circle cx="200" cy="200" r="12" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.7" />
            {/* corner brackets */}
            <g stroke="currentColor" strokeWidth="2" fill="none" strokeOpacity="0.9">
              <polyline points="40,80 40,40 80,40" />
              <polyline points="320,40 360,40 360,80" />
              <polyline points="360,320 360,360 320,360" />
              <polyline points="80,360 40,360 40,320" />
            </g>
            {/* HUD label */}
            <text x="200" y="230" textAnchor="middle" fill="currentColor" fillOpacity="0.85" fontSize="11" letterSpacing="4" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              LOCK · {monthLabel.toUpperCase()}
            </text>
          </svg>
        </div>
      )}

      {/* Header */}
      <div className={`goals-content relative flex items-center justify-between gap-3 ${phase === "reveal" ? "is-shown" : ""}`}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_20px_-6px_var(--primary)]">
            <Crosshair className="h-5 w-5" />
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Alvo · {monthLabel}</div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight">Metas do mês</h3>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(goals); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="border-primary/30 hover:border-primary/60">
              Editar metas
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Metas de {monthLabel}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              {(["customers_goal","stamps_goal","rewards_goal","revenue_goal"] as const).map((k) => (
                <div key={k} className="grid gap-1.5">
                  <Label htmlFor={k}>{{
                    customers_goal: "Novos clientes",
                    stamps_goal: "Carimbos",
                    rewards_goal: "Recompensas resgatadas",
                    revenue_goal: "Receita estimada (R$)",
                  }[k]}</Label>
                  <Input id={k} type="number" min={0} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => m.mutate()} disabled={m.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {m.isPending ? "Salvando…" : "Salvar metas"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goal rows */}
      <div className={`goals-content relative mt-6 grid gap-3 sm:grid-cols-3 ${phase === "reveal" ? "is-shown" : ""}`}>
        {rows.map((r, i) => {
          const pct = r.goal > 0 ? Math.min(100, (r.now / r.goal) * 100) : 0;
          const complete = pct >= 100;
          return (
            <div
              key={r.label}
              className="goals-row relative overflow-hidden rounded-xl border border-primary/15 bg-[color:color-mix(in_oklab,var(--card)_60%,transparent)] p-4 backdrop-blur-sm"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                    <r.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">{r.label}</span>
                </div>
                {complete && (
                  <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                    ATINGIDA
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="metric-solid text-2xl sm:text-3xl">{r.now.toLocaleString("pt-BR")}</span>
                {r.goal > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    / {r.goal.toLocaleString("pt-BR")}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">sem meta</span>
                )}
              </div>
              {r.goal > 0 && (
                <>
                  <div className="mt-3 goals-track">
                    <span className="goals-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className={`font-mono font-semibold ${complete ? "text-success" : "text-primary"}`}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
