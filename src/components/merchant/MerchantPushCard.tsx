import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, CheckCircle2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ensurePwaRegistration } from "@/lib/pwa-register";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import { subscribeAdminPush, getAdminPushStatus } from "@/lib/push.functions";

const DISMISS_KEY = "fidelize:merchant-push-dismissed:v1";

/**
 * Ativação de notificações no dispositivo do lojista (mesma UX do card
 * da Carteira). Registra o endpoint vinculado à empresa ativa, para que o
 * time receba avisos de carimbo, avaliação e suporte no celular.
 */
export function MerchantPushCard() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const subscribe = useServerFn(subscribeAdminPush);
  const getStatus = useServerFn(getAdminPushStatus);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch { /* noop */ }

    (async () => {
      try {
        const reg = await ensurePwaRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return setSubscribed(false);
        const st = await getStatus({ data: { endpoint: sub.endpoint } });
        setSubscribed(!!st.subscribed);
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
        if (perm === "denied") toast.error("Permissão negada. Habilite nas configurações do navegador.");
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
      await subscribe({
        data: {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent.slice(0, 300),
          permission_status: "granted",
        },
      });
      const st = await getStatus({ data: { endpoint: sub.endpoint } });
      setSubscribed(!!st.subscribed);
      if (st.subscribed) toast.success("Notificações ativadas neste aparelho 🎉");
      else toast.error("Não conseguimos concluir a ativação. Tente novamente.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
  }

  if (!supported || dismissed) return null;
  if (subscribed === null) return null;

  if (subscribed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/5 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span className="min-w-0">Notificações ativas neste aparelho.</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 via-background to-background p-4 shadow-lg">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Ative as notificações</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Receba avisos de novas avaliações, respostas do suporte e alertas do seu programa.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={enable} disabled={busy || permission === "denied"}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              {permission === "denied" ? "Bloqueado no navegador" : "Ativar notificações"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>Agora não</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
