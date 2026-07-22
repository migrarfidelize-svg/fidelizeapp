import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, Loader2, Smartphone, Share, Plus, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import {
  subscribeCustomerPush,
  unsubscribeCustomerPush,
  getCustomerPushStatus,
} from "@/lib/push.functions";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touchPoints = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  const isIPad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && touchPoints > 1);
  return /iPhone|iPod/.test(ua) || isIPad;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Per-card opt-in shown on the customer voucher.
 * - Registers the service worker (already handled by pwa-register)
 * - Asks Notification permission on click
 * - Persists subscription to the DB via server function
 * - Falls back to iOS 16.4+ install guide when Web Push isn't available yet
 */
function detectBrowser(): "chrome" | "edge" | "firefox" | "safari" | "opera" | "samsung" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/EdgA?\//.test(ua)) return "edge";
  if (/OPR\//.test(ua)) return "opera";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function PushOptIn({ token }: { token: string }) {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showUnblockGuide, setShowUnblockGuide] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);


  const subscribe = useServerFn(subscribeCustomerPush);
  const unsubscribe = useServerFn(unsubscribeCustomerPush);
  const getStatus = useServerFn(getCustomerPushStatus);

  const ios = isIOS();
  const standalone = isStandalone();

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    setReady(true);
    if (!ok) {
      setSubscribed(false);
      return;
    }
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
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
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
      toast.success("Notificações ativadas neste cartão!");
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

  if (!ready) return null;

  // iOS without Web Push (either not installed, or older iOS): show install guide.
  const needsIosInstall = ios && (!supported || !standalone);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" /> Notificações deste cartão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Receba avisos quando ganhar um carimbo, chegar perto do prêmio ou tiver ofertas especiais.
        </p>

        {needsIosInstall ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  No iPhone/iPad é preciso instalar na tela de início primeiro
                </p>
                <p className="text-muted-foreground">
                  A Apple só libera notificações push para apps web instalados (iOS 16.4 ou superior,
                  usando o <strong>Safari</strong>).
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIosGuide((v) => !v)}
              className="w-full"
            >
              <Info className="mr-2 h-4 w-4" />
              {showIosGuide ? "Ocultar passo a passo" : "Ver como instalar no iPhone/iPad"}
            </Button>
            {showIosGuide && (
              <ol className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-foreground">
                <li className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  <span>
                    Abra esta página no <strong>Safari</strong> (não funciona no Chrome do iPhone).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  <span className="inline-flex items-center gap-1">
                    Toque no ícone <Share className="inline h-3.5 w-3.5" />{" "}
                    <strong>Compartilhar</strong> na barra inferior.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">3.</span>
                  <span className="inline-flex items-center gap-1">
                    Escolha <strong>Adicionar à Tela de Início</strong>{" "}
                    <Plus className="inline h-3.5 w-3.5" /> e confirme em <strong>Adicionar</strong>.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-primary">4.</span>
                  <span>
                    Abra o app pelo ícone recém-criado na tela de início e volte aqui para tocar em{" "}
                    <strong>Receber notificações</strong>.
                  </span>
                </li>
                <li className="flex gap-2 border-t border-border/60 pt-2 text-muted-foreground">
                  <span>ℹ️</span>
                  <span>
                    Requer <strong>iOS 16.4</strong> ou superior. Em versões anteriores, avisos por
                    e-mail e WhatsApp continuam funcionando normalmente.
                  </span>
                </li>
              </ol>
            )}
          </div>
        ) : !supported ? (
          <p className="text-xs text-muted-foreground">
            Este navegador não suporta notificações push. Tente abrir em Chrome, Edge, Firefox ou
            Safari.
          </p>
        ) : permission === "denied" ? (
          <p className="text-xs text-destructive">
            Você bloqueou notificações neste navegador. Habilite manualmente nas configurações do
            site.
          </p>
        ) : subscribed ? (
          <Button variant="outline" onClick={disable} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            <span className="ml-2">Desativar notificações deste cartão</span>
          </Button>
        ) : (
          <Button onClick={enable} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            <span className="ml-2">Receber notificações</span>
          </Button>
        )}

        {endpoint && subscribed && (
          <p className="text-[10px] text-muted-foreground">
            Ativado neste aparelho ({endpoint.slice(0, 40)}…)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
