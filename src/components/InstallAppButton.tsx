import { useEffect, useState } from "react";
import { Download, Share as ShareIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    nav.standalone === true
  );
}

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Install App button — uses native beforeinstallprompt when available (Chrome/Edge/Android),
 * and falls back to a modal with iOS Safari instructions ("Add to Home Screen").
 * Hides itself when the app is already running as a standalone PWA.
 */
export function InstallAppButton({ label = "Adicionar à tela inicial" }: { label?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    setStandalone(isStandalone());
    setPlatform(detectPlatform());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone) return null;

  async function handleClick() {
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") setDeferred(null);
      } catch {
        setShowHelp(true);
      }
      return;
    }
    setShowHelp(true);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        className="w-full gap-2"
        aria-label={label}
      >
        <Download className="h-4 w-4" aria-hidden />
        {label}
      </Button>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar à tela inicial</DialogTitle>
            <DialogDescription>
              Instale o seu cartão fidelidade como um app no seu celular para acessar em 1 toque.
            </DialogDescription>
          </DialogHeader>
          {platform === "ios" && (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">1</span>
                <span>
                  Toque no botão de compartilhar <ShareIcon className="inline h-4 w-4" aria-label="compartilhar" /> na barra inferior do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">2</span>
                <span>
                  Role e toque em <strong>Adicionar à Tela de Início</strong> <Plus className="inline h-4 w-4" aria-hidden />.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">3</span>
                <span>Confirme em <strong>Adicionar</strong>. Pronto! O ícone aparecerá na sua tela.</span>
              </li>
            </ol>
          )}
          {platform === "android" && (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">1</span>
                <span>Toque no menu <strong>⋮</strong> no canto superior direito do navegador.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">2</span>
                <span>Selecione <strong>Adicionar à tela inicial</strong> ou <strong>Instalar app</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">3</span>
                <span>Confirme para adicionar o ícone à sua tela inicial.</span>
              </li>
            </ol>
          )}
          {platform === "desktop" && (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">1</span>
                <span>Clique no ícone de instalação <Download className="inline h-4 w-4" aria-hidden /> na barra de endereço.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">2</span>
                <span>Confirme em <strong>Instalar</strong>. Também disponível no menu do navegador.</span>
              </li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
