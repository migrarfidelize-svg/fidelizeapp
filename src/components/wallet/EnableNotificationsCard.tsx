import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import {
  subscribePushForAllMyCards,
  unsubscribePushForAllMyCards,
  getMyWalletPushStatus,
} from "@/lib/push.functions";

const DISMISS_KEY = "fidelize:notifications:dismissed";
const PWA_AUTOPROMPT_KEY = "fidelize:notifications:pwa-autoprompt";

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
    if (!ok) return;
    setPermission(Notification.permission);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
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

  // Auto-prompt on first launch from installed PWA shortcut.
  useEffect(() => {
    if (!supported || subscribed !== false) return;
    if (permission !== "default") return;
    if (!isRunningAsPwa()) return;
    if (localStorage.getItem(PWA_AUTOPROMPT_KEY) === "1") return;
    localStorage.setItem(PWA_AUTOPROMPT_KEY, "1");
    // Small delay so the wallet UI paints before the native dialog appears.
    const t = setTimeout(() => {
      enable().catch(() => {});
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, subscribed, permission]);

  async function enable() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permissão negada. Habilite nas configurações do navegador.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
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
      setSubscribed(true);
      toast.success(
        res.count
          ? `Notificações ativadas em ${res.count} ${res.count === 1 ? "cartão" : "cartões"}.`
          : "Notificações ativadas!",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
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

  // Hide when: unsupported, already subscribed, permission denied+dismissed,
  // or user dismissed. Show as a compact "gerenciar" card when subscribed and
  // running as installed PWA — otherwise stay silent to avoid noise.
  if (!supported || subscribed === null) return null;
  if (subscribed) return null;
  if (dismissed) return null;

  const denied = permission === "denied";

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold leading-tight">Ative as notificações</p>
            <p className="text-xs text-muted-foreground">
              Avise-me quando eu ganhar um carimbo, faltar pouco para o prêmio ou surgir uma
              oferta.
            </p>
          </div>
          {denied ? (
            <p className="text-xs text-destructive">
              Notificações bloqueadas neste navegador. Habilite manualmente nas configurações do
              site.
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
  );
}

// Nota: o toggle "desativar neste aparelho" vive em `PushStatusCard`, usado
// na tela de perfil. Removemos o `WalletPushToggleInline` duplicado para
// evitar dois pontos de verdade sobre o estado de push.

