import { useEffect, useState } from "react";
import { Bike, Bell, Download, MapPin, Share, Smartphone, Wallet, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/lib/pwa-installation";

const DISMISS_KEY = "fidelize:courier-install-dismissed";

function useInstallState() {
  const { state, canInstall, installApp, refreshState } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
    setDismissed(true);
  }

  return { state, canInstall, installApp, refreshState, dismissed, dismiss };
}

function Steps({ ios, android }: { ios: boolean; android: boolean }) {
  if (ios) {
    return (
      <ol className="space-y-2 text-left text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <Share className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Toque em <b className="text-foreground">Compartilhar</b> na barra do Safari.</span>
        </li>
        <li className="flex items-start gap-2">
          <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Escolha <b className="text-foreground">Adicionar à Tela de Início</b>.</span>
        </li>
        <li className="flex items-start gap-2">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>Abra o ícone <b className="text-foreground">Fidelize Entregador</b> na sua tela.</span>
        </li>
      </ol>
    );
  }
  return (
    <ol className="space-y-2 text-left text-xs text-muted-foreground">
      <li className="flex items-start gap-2">
        <Download className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Toque em <b className="text-foreground">Instalar aplicativo</b>
          {android ? "" : " ou no ícone de instalar na barra de endereço"}.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>Confirme <b className="text-foreground">Instalar</b> na janela do navegador.</span>
      </li>
      <li className="flex items-start gap-2">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>Permita notificações para receber corridas na hora.</span>
      </li>
    </ol>
  );
}

/**
 * Tela cheia de boas-vindas convidando o entregador a instalar o app nativo.
 * Aparece uma vez (até ser dispensada) e nunca quando já está instalado.
 */
export function CourierInstallGate({ open, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const { state, canInstall, installApp, dismissed, dismiss } = useInstallState();
  const [busy, setBusy] = useState(false);

  if (state.isInstalled) return null;
  if (dismissed && !open) return null;

  function close() {
    dismiss();
    onClose?.();
  }

  async function install() {
    setBusy(true);
    const r = await installApp();
    setBusy(false);
    if (r.outcome === "accepted") close();
  }


  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background">
      <div className="flex flex-1 flex-col justify-center overflow-y-auto px-6 py-10">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="card-icon mx-auto grid h-20 w-20 place-items-center rounded-3xl">
            <Bike className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-2xl font-black leading-tight">Instale o Fidelize Entregador</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O app abre em tela cheia, com mapa da corrida e alertas de novas entregas.
          </p>

          <ul className="mt-6 space-y-2 text-left">
            {[
              { icon: MapPin, t: "Mapa em tela cheia", d: "Acompanhe a rota real por ruas." },
              { icon: Bell, t: "Alerta de corrida", d: "Notificação mesmo com a tela apagada." },
              { icon: Wallet, t: "Carteira e saques", d: "Saldo e PIX em dois toques." },
            ].map((f) => (
              <li key={f.t} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{f.t}</p>
                  <p className="text-[11px] text-muted-foreground">{f.d}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-2xl border border-dashed border-border p-4">
            <Steps ios={state.isIOS} android={state.isAndroid} />
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-border bg-background px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        {canInstall ? (
          <Button className="min-h-[56px] w-full text-base" disabled={busy} onClick={install}>
            <Download className="mr-2 h-5 w-5" /> Instalar aplicativo
          </Button>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground">
            Siga os passos acima para adicionar o app à sua tela de início.
          </p>
        )}
        <Button variant="ghost" className="min-h-[44px] w-full text-xs text-muted-foreground" onClick={close}>
          Continuar no navegador
        </Button>
      </div>
    </div>
  );
}

/** Barra fina acima do menu inferior para reabrir a instalação depois de dispensada. */
export function CourierInstallBar({ onOpen }: { onOpen: () => void }) {
  const { state, canInstall, installApp } = usePWAInstall();
  const [hidden, setHidden] = useState(false);
  if (state.isInstalled || hidden) return null;

  return (
    <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 border-t border-primary/25 bg-primary/10 px-4 py-2 backdrop-blur-xl">
      <Smartphone className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold">Instale o app e receba corridas na hora</p>
      <button
        className="shrink-0 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground"
        onClick={() => (canInstall ? void installApp() : onOpen())}
      >
        Instalar
      </button>
      <button aria-label="Fechar" className="shrink-0 text-muted-foreground" onClick={() => setHidden(true)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Card de instalação usado no Perfil (sempre acessível). */
export function CourierInstallCard() {
  const { state, canInstall, installApp } = usePWAInstall();
  const [busy, setBusy] = useState(false);

  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-black">Aplicativo do entregador</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {state.isInstalled
          ? "App instalado neste aparelho. Abra pelo ícone na tela de início."
          : "Instale para usar em tela cheia, com mapa e alertas de corrida."}
      </p>
      {!state.isInstalled && (
        <>
          <div className="mt-3 rounded-2xl bg-muted/50 p-3">
            <Steps ios={state.isIOS} android={state.isAndroid} />
          </div>
          {canInstall && (
            <Button
              className="mt-3 min-h-[52px] w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await installApp();
                setBusy(false);
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Instalar aplicativo
            </Button>
          )}
        </>
      )}
    </section>
  );
}
