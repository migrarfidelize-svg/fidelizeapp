import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Smartphone, X } from "lucide-react";
import { trackEngagement } from "@/lib/engagement";
import { IosSetupGuide } from "@/components/pwa/IosSetupGuide";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "carteira_install_dismissed_v1";

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function InstallAppCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // iOS: no beforeinstallprompt — show manual card
    if (isIos()) setVisible(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    // Libera a vez para o próximo convite da fila (notificações).
    window.dispatchEvent(new Event("wallet:onboarding-changed"));
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      trackEngagement(
        "customer",
        choice.outcome === "accepted" ? "install_accepted" : "install_dismissed",
        { source: "beforeinstallprompt" },
      );
      if (choice.outcome === "accepted") dismiss();
      setDeferred(null);
    } else if (isIos()) {
      trackEngagement("customer", "install_manual_guide", { source: "manual" });
      setShowIosHelp(true);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-lg">
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Instale a Carteira no seu celular</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Acesso rápido pelo ícone, tela cheia e notificações de novos carimbos.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={install}>
                <Download className="mr-2 h-4 w-4" />
                {isIos() && !deferred ? "Como instalar" : "Instalar agora"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Instalar no iPhone / iPad</DialogTitle>
            <DialogDescription>
              O Safari do iOS não abre um prompt automático. Siga os passos e confira o checklist antes de concluir:
            </DialogDescription>
          </DialogHeader>
          <IosSetupGuide withNotifications />
          <p className="text-xs text-muted-foreground">
            Dica: no iPhone use o Safari — Chrome, Firefox e navegadores dentro de apps não instalam à tela de início.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
