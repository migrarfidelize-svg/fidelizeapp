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

const DISMISS_KEY = "fidelize:merchant-install-dismissed:v1";

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}
function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPad|iPhone|iPod|Mobile/.test(navigator.userAgent);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Convite de instalação do painel do lojista no celular.
 * Mesma mecânica do card da Carteira, com copy voltada à operação de balcão.
 */
export function MerchantInstallCard() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch { /* noop */ }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Em celular sempre oferecemos o caminho de instalação: o Chrome só dispara
    // beforeinstallprompt em algumas condições e o iOS nunca dispara.
    if (isMobile()) setVisible(true);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setVisible(false);
  }

  async function install() {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      trackEngagement(
        "merchant",
        choice.outcome === "accepted" ? "install_accepted" : "install_dismissed",
        { source: "beforeinstallprompt" },
      );
      if (choice.outcome === "accepted") dismiss();
      setDeferred(null);
    } else {
      trackEngagement("merchant", "install_manual_guide", { source: "manual" });
      setShowIosHelp(true);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-4 shadow-lg">
        <button
          type="button"
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
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Instale o painel no celular</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Carimbe pelo ícone na tela inicial, em tela cheia, sem abrir o navegador.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={install}>
                <Download className="mr-2 h-4 w-4" />
                {deferred ? "Instalar agora" : "Como instalar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isIos() ? "Instalar no iPhone / iPad" : "Instalar no Android"}</DialogTitle>
            <DialogDescription>
              {isIos()
                ? "O Safari do iOS não abre um prompt automático. Siga os passos e confira o checklist no final:"
                : "Se o aviso automático não apareceu, instale pelo menu do navegador:"}
            </DialogDescription>
          </DialogHeader>
          {isIos() ? (
            <IosSetupGuide withNotifications />
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
                <span>Abra o menu <strong>⋮</strong> no canto do navegador.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
                <span>Toque em <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
                <span>Confirme e abra o Fidelize pelo ícone criado.</span>
              </li>
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            {isIos()
              ? "No iPhone use o Safari: Chrome, Firefox e navegadores dentro de apps não instalam à tela de início."
              : "Funciona no Chrome, Edge e Samsung Internet."}
          </p>
        </DialogContent>
      </Dialog>

    </>
  );
}
