import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Share as ShareIcon, Plus, Copy, Check, X, Smartphone, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Platform = "ios" | "android" | "desktop";

const STORAGE_DISMISS_UNTIL = "fidelize_pwa_dismiss_until";
const STORAGE_LATER = "fidelize_pwa_later_until";
const STORAGE_SEEN = "fidelize_pwa_seen_v1";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    window.matchMedia?.("(display-mode: minimal-ui)").matches === true ||
    nav.standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  if (/iPhone|iPod/.test(ua) || isIPad) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function getSuppressUntil(): number {
  try {
    const a = Number(localStorage.getItem(STORAGE_DISMISS_UNTIL) || 0);
    const b = Number(localStorage.getItem(STORAGE_LATER) || 0);
    return Math.max(a, b);
  } catch {
    return 0;
  }
}

interface Props {
  /** Rótulo do botão visível. */
  label?: string;
  /** Se true, abre automaticamente o modal de instrução em iOS quando aplicável. */
  autoPrompt?: boolean;
  /** Ms antes do auto-prompt em iOS. */
  autoPromptDelayMs?: number;
}

export function InstallAppButton({
  label = "Instalar aplicativo",
  autoPrompt = false,
  autoPromptDelayMs = 1400,
}: Props) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [safari, setSafari] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const autoTriedRef = useRef(false);

  // Detect environment + register events
  useEffect(() => {
    setStandalone(isStandalone());
    setPlatform(detectPlatform());
    setSafari(isSafari());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setStandalone(true);
      setDeferred(null);
      setOpen(false);
      try { localStorage.setItem(STORAGE_SEEN, "1"); } catch {}
      toast.success("Aplicativo instalado com sucesso!");
    };
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onModeChange = () => setStandalone(isStandalone());

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    mq?.addEventListener?.("change", onModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onModeChange);
    };
  }, []);

  // iOS: auto-open guided modal after a short delay, respecting suppression window
  useEffect(() => {
    if (!autoPrompt || autoTriedRef.current) return;
    if (standalone) return;
    if (platform !== "ios" || !safari) return;
    if (Date.now() < getSuppressUntil()) return;
    autoTriedRef.current = true;
    const t = setTimeout(() => setOpen(true), autoPromptDelayMs);
    return () => clearTimeout(t);
  }, [autoPrompt, standalone, platform, safari, autoPromptDelayMs]);

  const steps = useMemo(() => {
    if (platform === "ios") {
      return [
        {
          title: "Toque em Compartilhar",
          body: (
            <p>
              Na barra do Safari, toque no ícone{" "}
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-2 ring-primary/40 animate-pulse">
                <ShareIcon className="h-4 w-4" />
              </span>{" "}
              <strong>Compartilhar</strong>.
            </p>
          ),
        },
        {
          title: "Adicionar à Tela de Início",
          body: (
            <p>
              Role a lista e toque em{" "}
              <strong className="inline-flex items-center gap-1">
                <Plus className="h-4 w-4" /> Adicionar à Tela de Início
              </strong>
              .
            </p>
          ),
        },
        {
          title: "Confirme em Adicionar",
          body: <p>Toque em <strong>Adicionar</strong> no canto superior direito. O ícone aparecerá na sua tela inicial.</p>,
        },
      ];
    }
    if (platform === "android") {
      return [
        { title: "Abra o menu do navegador", body: <p>Toque no ícone <strong>⋮</strong> no canto superior direito do Chrome.</p> },
        { title: "Instalar app", body: <p>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</p> },
        { title: "Confirme", body: <p>Toque em <strong>Instalar</strong>. Pronto, o ícone aparecerá na tela inicial.</p> },
      ];
    }
    return [
      { title: "Ícone de instalação", body: <p>Clique no ícone <Download className="inline h-4 w-4" /> à direita da barra de endereço.</p> },
      { title: "Instalar", body: <p>Confirme em <strong>Instalar</strong>. Também aparece no menu do navegador.</p> },
    ];
  }, [platform]);

  const plainInstructions = useMemo(() => {
    const header =
      platform === "ios"
        ? "Como instalar no iPhone/iPad (Safari):"
        : platform === "android"
        ? "Como instalar no Android (Chrome):"
        : "Como instalar no computador:";
    const lines = steps.map((s, i) => `${i + 1}. ${s.title}`);
    return [header, ...lines].join("\n");
  }, [platform, steps]);

  if (standalone) return null;

  async function handlePrimary() {
    // Android/Chrome/Edge: native prompt in 1 click
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") {
          setDeferred(null);
        } else {
          try { localStorage.setItem(STORAGE_LATER, String(Date.now() + ONE_DAY_MS)); } catch {}
        }
      } catch {
        setOpen(true);
      }
      return;
    }
    setStep(0);
    setDontShow(false);
    setCopied(false);
    setOpen(true);
  }

  function handleDontShowChange(v: boolean) {
    setDontShow(v);
  }

  function handleClose() {
    try {
      if (dontShow) {
        localStorage.setItem(STORAGE_DISMISS_UNTIL, String(Date.now() + THIRTY_DAYS_MS));
      }
      localStorage.setItem(STORAGE_SEEN, "1");
    } catch {}
    setOpen(false);
  }

  function handleLater() {
    try { localStorage.setItem(STORAGE_LATER, String(Date.now() + ONE_DAY_MS)); } catch {}
    setOpen(false);
  }

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(plainInstructions);
      setCopied(true);
      toast.success("Instruções copiadas");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const progress = Math.round(((step + 1) / steps.length) * 100);
  const canPrev = step > 0;
  const canNext = step < steps.length - 1;

  return (
    <>
      <Button
        type="button"
        onClick={handlePrimary}
        className="w-full gap-2 gradient-brand text-primary-foreground hover:opacity-95"
        aria-label={label}
      >
        <Download className="h-4 w-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {/* Hero */}
          <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl animate-pulse" aria-hidden />
                  <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
                    <Smartphone className="h-7 w-7" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> App instantâneo
                  </div>
                  <DialogTitle className="text-lg font-bold">Instale na tela inicial</DialogTitle>
                </div>
              </div>
              <button
                onClick={handleClose}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DialogDescription className="mt-3 text-sm text-muted-foreground">
              Acesse seu cartão em 1 toque, sem abrir o navegador. Rápido, offline-ready e sem baixar da loja.
            </DialogDescription>

            {/* Progress */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
                <span>Passo {step + 1} de {steps.length}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <DialogHeader className="sr-only">
            <DialogTitle>Instale na tela inicial</DialogTitle>
          </DialogHeader>

          {/* Step content */}
          <div className="px-6 py-5 min-h-[140px]">
            <div key={step} className="animate-fade-in space-y-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {step + 1}
                </span>
                <h3 className="font-semibold">{steps[step].title}</h3>
              </div>
              <div className="text-sm text-muted-foreground leading-relaxed pl-9">
                {steps[step].body}
              </div>
            </div>
          </div>

          {/* Steps dots */}
          <div className="px-6 flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Passo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="px-6 pt-4 pb-5 space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={!canPrev}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Voltar
              </Button>
              {canNext ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                  className="ml-auto gap-1 gradient-brand text-primary-foreground"
                >
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleClose}
                  className="ml-auto gap-1 gradient-brand text-primary-foreground"
                >
                  <Check className="h-4 w-4" /> Entendi
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={copyInstructions} className="gap-1">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar instruções"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleLater} className="ml-auto">
                Lembrar depois
              </Button>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input
                type="checkbox"
                checked={dontShow}
                onChange={(e) => handleDontShowChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
              />
              Não mostrar novamente por 30 dias
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
