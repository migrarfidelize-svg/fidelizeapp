import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import {
  subscribeCustomerPush,
  unsubscribeCustomerPush,
  getCustomerPushStatus,
} from "@/lib/push.functions";

/**
 * Opt-in card shown on the customer voucher.
 * - Registers the service worker (already handled by pwa-register)
 * - Asks Notification permission on click
 * - Persists subscription to the DB via server function
 */
export function PushOptIn({ token }: { token: string }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);

  const subscribe = useServerFn(subscribeCustomerPush);
  const unsubscribe = useServerFn(unsubscribeCustomerPush);
  const getStatus = useServerFn(getCustomerPushStatus);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setEndpoint(sub.endpoint);
          const st = await getStatus({ data: { token, endpoint: sub.endpoint } });
          setSubscribed(!!st.subscribed);
        } else {
          setSubscribed(false);
        }
      } catch {
        setSubscribed(false);
      }
    })();
  }, [token, getStatus]);

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
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      await subscribe({
        data: {
          token,
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent.slice(0, 300),
        },
      });
      setEndpoint(sub.endpoint);
      setSubscribed(true);
      toast.success("Notificações ativadas!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ativar notificações.";
      toast.error(msg);
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
        await unsubscribe({ data: { token, endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notificações desativadas.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao desativar.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!supported || subscribed === null) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" /> Notificações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Receba avisos quando ganhar um carimbo, chegar perto do prêmio ou tiver ofertas
          especiais.
        </p>
        {permission === "denied" ? (
          <p className="text-xs text-destructive">
            Você bloqueou notificações neste navegador. Habilite manualmente nas configurações do
            site.
          </p>
        ) : subscribed ? (
          <Button variant="outline" onClick={disable} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            <span className="ml-2">Desativar notificações</span>
          </Button>
        ) : (
          <Button onClick={enable} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            <span className="ml-2">Ativar notificações</span>
          </Button>
        )}
        {endpoint && subscribed && (
          <p className="text-[10px] text-muted-foreground">
            Endpoint registrado com sucesso ({endpoint.slice(0, 40)}…)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
