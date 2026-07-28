import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Compass, ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  findPageGuide, isGuideSeen, markGuideSeen, AUTO_GUIDE_MODULES,
  OPEN_PAGE_GUIDE_EVENT, type PageGuide as Guide,
} from "@/lib/page-guides";

/**
 * Passo a passo por tela. Abre sozinho apenas nas telas de maior fricção
 * (AUTO_GUIDE_MODULES) e somente na primeira visita. Em qualquer outra tela,
 * o guia é aberto sob demanda pelo botão de ajuda do cabeçalho.
 */
export function PageGuidePrompt({ scope }: { scope: string }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const match = findPageGuide(pathname);
  const [phase, setPhase] = useState<"idle" | "ask" | "steps">("idle");
  const [guide, setGuide] = useState<Guide | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [i, setI] = useState(0);

  useEffect(() => {
    setPhase("idle");
    setI(0);
    if (!match) return;
    if (typeof window === "undefined") return;
    // Marca por módulo (ex.: todo o /app/cardapio/*), não por subaba.
    if (!AUTO_GUIDE_MODULES.has(match.module)) return;
    if (isGuideSeen(scope, match.module)) return;
    // Pequeno atraso: deixa a página montar antes de convidar.
    const t = setTimeout(() => {
      setGuide(match.guide);
      setPath(match.module);
      setPhase("ask");
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.module, scope]);

  // Abertura sob demanda (botão de ajuda no cabeçalho).
  useEffect(() => {
    function onOpen() {
      if (!match) return;
      markGuideSeen(scope, match.module);
      setGuide(match.guide);
      setPath(match.module);
      setI(0);
      setPhase("steps");
    }
    window.addEventListener(OPEN_PAGE_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PAGE_GUIDE_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.module, scope]);

  function remember() {
    if (!path) return;
    markGuideSeen(scope, path);
  }

  function decline() {
    remember();
    setPhase("idle");
  }

  function accept() {
    remember();
    setI(0);
    setPhase("steps");
  }


  if (!guide || phase === "idle") return null;

  if (phase === "ask") {
    return (
      <Dialog open onOpenChange={(o) => { if (!o) decline(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="card-icon mb-2"><Compass className="h-5 w-5" /></div>
            <DialogTitle>Primeira vez em {guide.title}</DialogTitle>
            <DialogDescription>
              Quer um passo a passo rápido desta tela? São {guide.steps.length} passos, leva menos de 1 minuto.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" className="w-full sm:w-auto" onClick={decline}>Agora não</Button>
            <Button className="w-full sm:w-auto" onClick={accept}>
              <Sparkles className="h-4 w-4" /> Ver passo a passo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const step = guide.steps[i];
  const last = i === guide.steps.length - 1;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) setPhase("idle"); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            {guide.title} · {guide.subtitle}
          </span>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {i + 1}
            </span>
            <span className="min-w-0">{step.title}</span>
          </DialogTitle>
          <DialogDescription>{step.description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1.5">
          {guide.steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${idx <= i ? "bg-primary" : "bg-primary/15"}`}
            />
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={i === 0}
            onClick={() => setI((v) => Math.max(0, v - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button size="sm" onClick={() => (last ? setPhase("idle") : setI((v) => v + 1))}>
            {last ? (<><Check className="h-4 w-4" /> Entendi</>) : (<>Próximo <ArrowRight className="h-4 w-4" /></>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
