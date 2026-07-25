import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentType, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useOnboardingSlot } from "@/lib/onboarding-queue";

import {
  X, ArrowRight, ArrowLeft, Sparkles,
  LayoutDashboard, Stamp, Users, Megaphone, QrCode, Crown, Compass,
} from "lucide-react";

export type TourStep = {
  target?: string; // kept for backwards compat, ignored by modal
  title: string;
  description: string;
  placement?: "right" | "bottom" | "top" | "left" | "center"; // ignored
  /** Preview key mapped to a bundled illustration. */
  preview?: "dashboard" | "stamp" | "customers" | "campaigns" | "qrcodes" | "plans" | "welcome";
  /** Optional custom node overriding `preview`. */
  previewNode?: ReactNode;
};

/* ---------------- Illustrations ---------------- */

function Frame({ icon: Icon, children, label }: { icon: ComponentType<{ className?: string }>; children: ReactNode; label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-[color:color-mix(in_oklab,var(--card)_75%,transparent)] p-4 shadow-[0_0_40px_-18px_var(--primary)]">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]" />
          {label}
        </span>
        <span className="flex items-center gap-1 font-mono text-primary/80">
          <Icon className="h-3 w-3" /> FIDELIZE
        </span>
      </div>
      <div className="mt-3">{children}</div>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />
      <span className="pointer-events-none absolute -inset-x-4 top-1/2 h-20 bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)] blur-2xl" />
    </div>
  );
}

function Bars({ heights }: { heights: number[] }) {
  return (
    <div className="flex items-end gap-1.5 h-20">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-primary/70 shadow-[0_0_10px_-2px_var(--primary)]"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function KpiRow({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {items.map((k) => (
        <div key={k.label} className="rounded-md border border-primary/20 bg-background/40 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
          <div className="text-sm font-semibold tabular-nums text-primary">{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <Frame icon={LayoutDashboard} label="Painel · ao vivo">
      <Bars heights={[35, 55, 42, 68, 48, 82, 74]} />
      <KpiRow items={[{ label: "Hoje", value: "48" }, { label: "Clientes", value: "312" }, { label: "Resgates", value: "27" }]} />
    </Frame>
  );
}

function StampPreview() {
  return (
    <Frame icon={Stamp} label="Carimbar · scanner">
      <div className="grid h-24 place-items-center rounded-md border border-primary/30 bg-background/40 relative overflow-hidden">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`h-6 w-6 rounded-full border ${i < 5 ? "bg-primary border-primary shadow-[0_0_8px_var(--primary)]" : "border-primary/30"}`}
            />
          ))}
        </div>
        <span className="absolute inset-x-0 top-1/2 h-px bg-primary/70 animate-pulse" />
      </div>
      <KpiRow items={[{ label: "Selo", value: "5/8" }, { label: "Bônus", value: "1" }, { label: "Ritmo", value: "▲" }]} />
    </Frame>
  );
}

function CustomersPreview() {
  const rows = [
    { name: "Ana Silva", tag: "VIP", visits: 24 },
    { name: "Bruno Reis", tag: "Ativo", visits: 12 },
    { name: "Carla Melo", tag: "Novo", visits: 3 },
  ];
  return (
    <Frame icon={Users} label="Base · clientes">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-md border border-primary/15 bg-background/40 px-2 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary/20 grid place-items-center text-primary text-[10px] font-bold">
                {r.name[0]}
              </span>
              <span className="font-medium">{r.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-primary/30 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-primary">{r.tag}</span>
              <span className="text-muted-foreground tabular-nums">{r.visits}</span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function CampaignsPreview() {
  return (
    <Frame icon={Megaphone} label="Campanhas · cartão">
      <div className="rounded-lg border border-primary/30 bg-background/50 p-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-primary">
          <span>10 café · 1 grátis</span>
          <Sparkles className="h-3 w-3" />
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-full border ${i < 6 ? "bg-primary/80 border-primary shadow-[0_0_6px_var(--primary)]" : "border-primary/25"}`}
            />
          ))}
        </div>
      </div>
    </Frame>
  );
}

function QrPreview() {
  return (
    <Frame icon={QrCode} label="Divulgação · materiais">
      <div className="grid grid-cols-3 gap-2">
        {[["Story", "9:16"], ["Feed", "1:1"], ["A5", "Print"]].map(([t, s]) => (
          <div key={t} className="rounded-md border border-primary/25 bg-background/40 p-2">
            <div className="aspect-[3/4] rounded-sm border border-primary/30 bg-[repeating-linear-gradient(45deg,color-mix(in_oklab,var(--primary)_18%,transparent)_0_4px,transparent_4px_8px)] grid place-items-center">
              <QrCode className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground">
              <span>{t}</span><span>{s}</span>
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function PlansPreview() {
  return (
    <Frame icon={Crown} label="Planos · uso">
      <div className="space-y-2">
        {[["Carimbos", 78], ["Clientes", 45], ["Campanhas", 30]].map(([l, v]) => (
          <div key={l as string}>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{l}</span><span className="text-primary tabular-nums">{v}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-primary/15 overflow-hidden">
              <div className="h-full bg-primary shadow-[0_0_8px_var(--primary)]" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function WelcomePreview() {
  return (
    <Frame icon={Compass} label="Bem-vindo">
      <div className="grid place-items-center h-28">
        <div className="relative grid place-items-center h-20 w-20 rounded-full border-2 border-primary/60 shadow-[0_0_30px_-6px_var(--primary)]">
          <Sparkles className="h-8 w-8 text-primary" />
          <span className="absolute inset-0 rounded-full border border-primary/30 animate-ping" />
        </div>
      </div>
    </Frame>
  );
}

const PREVIEWS: Record<NonNullable<TourStep["preview"]>, ReactNode> = {
  welcome: <WelcomePreview />,
  dashboard: <DashboardPreview />,
  stamp: <StampPreview />,
  customers: <CustomersPreview />,
  campaigns: <CampaignsPreview />,
  qrcodes: <QrPreview />,
  plans: <PlansPreview />,
};

/* ---------------- Tour ---------------- */

export function GuidedTour({
  steps,
  mobileSteps,
  storageKey,
  onDone,
}: {
  steps: TourStep[];
  /** Versão enxuta usada em telas pequenas (< 768px). */
  mobileSteps?: TourStep[];
  storageKey: string;
  onDone?: () => void;
}) {
  const [manual, setManual] = useState(false);
  const [autoWanted, setAutoWanted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [i, setI] = useState(0);
  const myTurn = useOnboardingSlot("tour", autoWanted);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsMobile(window.innerWidth < 768);
    if (!window.localStorage.getItem(storageKey)) setAutoWanted(true);
    const onStart = () => { setI(0); setManual(true); };
    window.addEventListener("fidelize:start-tour", onStart);
    return () => window.removeEventListener("fidelize:start-tour", onStart);
  }, [storageKey]);

  const activeSteps = isMobile && mobileSteps?.length ? mobileSteps : steps;
  const open = manual || (autoWanted && myTurn);
  const step = activeSteps[i];
  if (!open || !step) return null;
  if (typeof document === "undefined") return null;

  function close(done: boolean) {
    setManual(false);
    setAutoWanted(false);
    try { window.localStorage.setItem(storageKey, done ? "done" : "skipped"); } catch { /* noop */ }
    onDone?.();
  }


  const preview = step.previewNode ?? (step.preview ? PREVIEWS[step.preview] : PREVIEWS.welcome);

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center p-4 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-[color:color-mix(in_oklab,var(--background)_78%,transparent)] backdrop-blur-sm"
        onClick={() => close(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-labelledby="tour-title"
        className="relative w-full max-w-lg rounded-2xl border border-primary/30 bg-card shadow-[0_20px_80px_-20px_var(--primary)] animate-in zoom-in-95 duration-200"
      >
        <button
          onClick={() => close(false)}
          aria-label="Fechar tour"
          className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-5 pb-3">{preview}</div>

        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Passo {i + 1} de {steps.length}
          </div>
          <h3 id="tour-title" className="mt-2 text-xl font-semibold">{step.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Ir para passo ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-6 bg-primary shadow-[0_0_8px_var(--primary)]" : "w-1.5 bg-primary/25 hover:bg-primary/50"
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => close(false)}>Pular</Button>
            <div className="flex items-center gap-2">
              {i > 0 && (
                <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar
                </Button>
              )}
              {i < steps.length - 1 ? (
                <Button size="sm" onClick={() => setI(i + 1)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Próximo <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={() => close(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Concluir
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
