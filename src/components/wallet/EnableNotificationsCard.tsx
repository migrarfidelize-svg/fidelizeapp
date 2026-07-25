import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ensurePwaRegistration } from "@/lib/pwa-register";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import {
  subscribePushForAllMyCards,
  unsubscribePushForAllMyCards,
  getMyWalletPushStatus,
} from "@/lib/push.functions";

const DISMISS_KEY = "fidelize:notifications:dismissed";
const PWA_AUTOPROMPT_KEY = "fidelize:notifications:pwa-autoprompt";
const PWA_MODAL_SESSION_KEY = "fidelize:notifications:pwa-modal-shown";

function isRunningAsPwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  } catch {}
  // iOS Safari
  if ((navigator as unknown as { standalone?: boolean }).standalone) return true;
  // Fallback: launched via PWA start_url
  try {
    if (new URLSearchParams(window.location.search).get("source") === "pwa") return true;
  } catch {}
  return false;
}

/**
 * Wallet-level "Ativar notificações" card, shown on the customer wallet home.
 * Subscribes the current device to push for every card the user owns, so a
 * single tap covers stamps, prizes, campaigns and birthdays across all
 * establishments.
 */
export function EnableNotificationsCard() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [runningAsPwa, setRunningAsPwa] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const subscribeAll = useServerFn(subscribePushForAllMyCards);
  const unsubscribeAll = useServerFn(unsubscribePushForAllMyCards);
  const getStatus = useServerFn(getMyWalletPushStatus);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    setRunningAsPwa(isRunningAsPwa());
    if (!ok) return;
    setPermission(Notification.permission);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    (async () => {
      try {
        const reg = await ensurePwaRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const st = await getStatus({ data: { endpoint: sub.endpoint } });
          setSubscribed(!!st.subscribed);
        } else {
          setSubscribed(false);
        }
      } catch {
        setSubscribed(false);
      }
    })();
  }, [getStatus]);

  // Installed apps cannot rely on the native permission prompt appearing
  // automatically: most browsers require a clear user tap. So we open a
  // first-launch in-app prompt and let the CTA trigger the real permission.
  useEffect(() => {
    if (!supported || subscribed !== false) return;
    if (permission !== "default") return;
    if (!runningAsPwa) return;
    if (localStorage.getItem(PWA_AUTOPROMPT_KEY) === "1") return;
    const t = setTimeout(() => {
      if (sessionStorage.getItem(PWA_MODAL_SESSION_KEY) === "1") return;
      sessionStorage.setItem(PWA_MODAL_SESSION_KEY, "1");
      setPromptOpen(true);
    }, 700);
    return () => clearTimeout(t);
  }, [supported, subscribed, permission, runningAsPwa]);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        if (perm === "denied") {
          toast.error("Permissão negada. Habilite nas configurações do navegador.");
        }
        return;
      }
      const reg = await ensurePwaRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }
      const json = sub.toJSON();
      const res = await subscribeAll({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent.slice(0, 300),
        },
      });
      const st = await getStatus({ data: { endpoint: sub.endpoint } });
      if (!res.ok || !st.subscribed) {
        throw new Error("A permissão foi concedida, mas o aparelho não foi salvo. Tente novamente.");
      }
      setSubscribed(true);
      setPromptOpen(false);
      localStorage.setItem(PWA_AUTOPROMPT_KEY, "1");
      toast.success(
        st.cardCount
          ? `Notificações ativadas em ${st.cardCount} ${st.cardCount === 1 ? "cartão" : "cartões"}.`
          : "Notificações ativadas!",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações.");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await ensurePwaRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeAll({ data: { endpoint: sub.endpoint } });
      }
      setSubscribed(false);
      toast.success("Notificações desativadas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desativar.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!supported || subscribed === null) return null;
  if (subscribed) return null;
  // No PWA instalado, ignoramos o "dismiss" anterior (feito no navegador)
  // para garantir que o cliente veja o CTA ao menos uma vez dentro do app.
  if (dismissed && !runningAsPwa) return null;

  const denied = permission === "denied";

  return (
    <>
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-sm overflow-hidden p-0 sm:rounded-2xl">
          <div className="relative border-b border-primary/20 bg-gradient-to-br from-primary/20 via-background to-background px-6 pb-5 pt-6">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Bell className="h-7 w-7" />
            </div>
            <DialogHeader className="text-left">
              <DialogTitle className="font-display text-xl">Ativar notificações do app?</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Receba avisos quando ganhar carimbos, liberar recompensas e aparecer uma oferta
                nova nos seus estabelecimentos favoritos.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-3 px-6 py-5">
            <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Você pode desativar quando quiser em Perfil → Notificações.
            </div>
            {denied ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                Notificações bloqueadas neste aparelho. Abra os ajustes do navegador/app e libere
                as notificações para o Fidelize.
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 px-6 pb-6 sm:flex-col sm:space-x-0">
            {!denied ? (
              <Button onClick={enable} disabled={busy} className="w-full gap-2" size="lg">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Ativar notificações
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setPromptOpen(false)}
              disabled={busy}
              className="w-full"
            >
              Agora não
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="relative overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-background to-background shadow-lg">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dispensar"
          className="absolute right-2 top-2 h-7 w-7 rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            {denied ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="font-semibold leading-tight">
                {runningAsPwa ? "Ative as notificações do app" : "Ative as notificações"}
              </p>
              <p className="text-xs text-muted-foreground">
                Avise-me quando eu ganhar um carimbo, faltar pouco para o prêmio ou surgir uma
                oferta.
              </p>
            </div>
            {denied ? (
              <p className="text-xs text-destructive">
                Notificações bloqueadas neste aparelho. Abra Ajustes → Notificações e libere para o
                Fidelize.
              </p>
            ) : (
              <Button size="sm" onClick={enable} disabled={busy} className="gap-2">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Bell className="h-4 w-4" />
                )}
                Ativar agora
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}


// Nota: o toggle "desativar neste aparelho" vive em `PushStatusCard`, usado
// na tela de perfil. Removemos o `WalletPushToggleInline` duplicado para
// evitar dois pontos de verdade sobre o estado de push.

