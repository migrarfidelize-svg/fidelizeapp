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

/** Compact toggle to disable/re-enable from the profile screen. */
export function WalletPushToggleInline() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const unsubscribeAll = useServerFn(unsubscribePushForAllMyCards);
  const getStatus = useServerFn(getMyWalletPushStatus);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return setSubscribed(false);
        const st = await getStatus({ data: { endpoint: sub.endpoint } });
        setSubscribed(!!st.subscribed);
      } catch {
        setSubscribed(false);
      }
    })();
  }, [getStatus]);

  if (!supported || subscribed !== true) return null;

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await unsubscribeAll({ data: { endpoint: sub.endpoint } });
      setSubscribed(false);
      toast.success("Notificações desativadas neste aparelho.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={disable} disabled={busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
      Desativar neste aparelho
    </Button>
  );
}
