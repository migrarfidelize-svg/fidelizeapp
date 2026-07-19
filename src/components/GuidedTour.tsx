import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";

export type TourStep = {
  target: string; // CSS selector or `[data-tour="key"]`
  title: string;
  description: string;
  placement?: "right" | "bottom" | "top" | "left" | "center";
};

type Rect = { top: number; left: number; width: number; height: number };

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function useTargetRect(selector: string): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    let raf = 0;
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? getRect(el) : null);
    };
    measure();
    const onScrollResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    // Poll briefly in case target renders async
    const t = window.setInterval(measure, 250);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
      window.clearInterval(t);
    };
  }, [selector]);
  return rect;
}

export function GuidedTour({
  steps,
  storageKey,
  onDone,
}: {
  steps: TourStep[];
  storageKey: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = window.localStorage.getItem(storageKey);
    if (!done) {
      // Wait a moment for the layout to settle
      const t = window.setTimeout(() => setOpen(true), 500);
      return () => window.clearTimeout(t);
    }
  }, [storageKey]);

  const step = steps[i];
  const rect = useTargetRect(step?.target ?? "");

  if (!open || !step) return null;
  if (typeof document === "undefined") return null;

  function close(done: boolean) {
    setOpen(false);
    try { window.localStorage.setItem(storageKey, done ? "done" : "skipped"); } catch { /* noop */ }
    onDone?.();
  }

  const placement = step.placement ?? "right";
  const CARD_W = 340;
  const CARD_H = 190;
  const GAP = 14;
  const isCenter = placement === "center" || !rect;

  let cardTop = 0;
  let cardLeft = 0;
  if (rect && !isCenter) {
    switch (placement) {
      case "right":
        cardTop = rect.top + rect.height / 2 - CARD_H / 2;
        cardLeft = rect.left + rect.width + GAP;
        break;
      case "left":
        cardTop = rect.top + rect.height / 2 - CARD_H / 2;
        cardLeft = rect.left - CARD_W - GAP;
        break;
      case "bottom":
        cardTop = rect.top + rect.height + GAP;
        cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
        break;
      case "top":
        cardTop = rect.top - CARD_H - GAP;
        cardLeft = rect.left + rect.width / 2 - CARD_W / 2;
        break;
    }
    // Clamp to viewport
    cardTop = Math.max(12, Math.min(window.innerHeight - CARD_H - 12, cardTop));
    cardLeft = Math.max(12, Math.min(window.innerWidth - CARD_W - 12, cardLeft));
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Dim overlay with a "punched" hole around the target */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && !isCenter && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(15,23,42,0.65)" mask="url(#tour-mask)" />
      </svg>

      {/* Halo ring around target */}
      {rect && !isCenter && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-primary/80 shadow-[0_0_0_6px_hsl(var(--primary)/0.25)] transition-all"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      {/* Card */}
      <div
        role="dialog"
        aria-labelledby="tour-title"
        className="absolute rounded-2xl border bg-card p-5 shadow-2xl"
        style={
          isCenter
            ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: CARD_W }
            : { top: cardTop, left: cardLeft, width: CARD_W }
        }
      >
        <button
          onClick={() => close(false)}
          aria-label="Pular tour"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Passo {i + 1} de {steps.length}
        </div>
        <h3 id="tour-title" className="mt-2 text-lg font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => close(false)}>Pular</Button>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="outline" size="sm" onClick={() => setI(i - 1)}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar
              </Button>
            )}
            {i < steps.length - 1 ? (
              <Button size="sm" onClick={() => setI(i + 1)}>
                Próximo <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => close(true)}>Concluir</Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
