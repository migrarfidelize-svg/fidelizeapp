import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellRing, BellOff, Loader2, AlertTriangle, Share, Settings, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ensurePwaRegistration } from "@/lib/pwa-register";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import { subscribeAdminPush, getAdminPushStatus } from "@/lib/push.functions";
import { trackEngagement } from "@/lib/engagement";
import { IosSetupGuide } from "@/components/pwa/IosSetupGuide";

const DISMISS_KEY = "fidelize:merchant-push-dismissed:v1";
const SKIP_UNTIL_KEY = "fidelize:merchant-push-skip-until:v1";
/** Só reabrimos o convite depois de 24h sem aceite. */
const SNOOZE_HOURS = 24;

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  return /iPhone|iPod/.test(ua) || /iPad/.test(ua) || (navigator.platform === "MacIntel" && touch > 1);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
function browserName(): "chrome" | "edge" | "samsung" | "firefox" | "safari" | "outro" {
  if (typeof navigator === "undefined") return "outro";
  const ua = navigator.userAgent;
  if (/EdgA?\//.test(ua)) return "edge";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "outro";
}

/**
 * Ativação de notificações no dispositivo do lojista.
 * Trata explicitamente os caminhos de erro: permissão negada, bloqueio
 * permanente do navegador, prompt fechado sem escolha (pular), iOS sem app
 * instalado e falhas de assinatura no push service.
 */
export function MerchantPushCard() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const subscribe = useServerFn(subscribeAdminPush);
  const getStatus = useServerFn(getAdminPushStatus);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // iOS só expõe Web Push quando o app está instalado na tela de início.
    if (isIos() && !isStandalone()) {
      setSupported(true);
      setNeedsInstall(true);
      setSubscribed(false);
      return;
    }

    const ok =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(ok);
    if (!ok) {
      setSubscribed(false);
      return;
    }
    setPermission(Notification.permission);
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      const until = Number(localStorage.getItem(SKIP_UNTIL_KEY) || 0);
      setSkipped(Number.isFinite(until) && until > Date.now());
    } catch { /* noop */ }

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

  // Convite em popup: aparece na entrada e só volta 24h depois se não ativar.
  useEffect(() => {
    if (subscribed !== false) return;
    if (dismissed || skipped || !supported) return;
    const t = setTimeout(() => setPromptOpen(true), 600);
    return () => clearTimeout(t);
  }, [subscribed, dismissed, skipped, supported]);

  function snooze() {
    try {
      localStorage.setItem(SKIP_UNTIL_KEY, String(Date.now() + SNOOZE_HOURS * 3600000));
    } catch { /* noop */ }
    setPromptOpen(false);
  }

  async function enable() {
    setBusy(true);
    setFailure(null);
    try {
      if (Notification.permission === "denied") {
        setPermission("denied");
        setShowHelp(true);
        trackEngagement("merchant", "push_blocked", { stage: "pre-check" });
        toast.error("As notificações estão bloqueadas para este site no navegador.");
        return;
      }

      let perm: NotificationPermission;
      try {
        perm = await Notification.requestPermission();
      } catch {
        setFailure("Não foi possível abrir o pedido de permissão. Recarregue a página e tente novamente.");
        toast.error("Não foi possível abrir o pedido de permissão.");
        return;
      }
      setPermission(perm);

      if (perm === "denied") {
        setShowHelp(true);
        trackEngagement("merchant", "push_denied", { stage: "permission" });
        toast.error("Permissão negada. Dá para reverter nas configurações do site.");
        return;
      }
      if (perm === "default") {
        // Usuário fechou/pulou o aviso do navegador sem escolher.
        trackEngagement("merchant", "push_dismissed", { stage: "permission" });
        setFailure("Você fechou o aviso sem escolher. Toque em “Ativar notificações” e responda “Permitir”.");
        toast.info("Pedido de permissão ignorado. Você pode tentar de novo quando quiser.");
        return;
      }

      const reg = await ensurePwaRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          });
        } catch (err) {
          const name = (err as { name?: string })?.name;
          if (name === "NotAllowedError") {
            setPermission("denied");
            setShowHelp(true);
            trackEngagement("merchant", "push_blocked", { stage: "subscribe" });
            setFailure("O navegador bloqueou a assinatura de notificações para este site.");
            toast.error("Notificações bloqueadas pelo navegador.");
          } else if (name === "AbortError" || name === "InvalidStateError") {
            setFailure("O serviço de notificações do navegador não respondeu. Feche e reabra o app e tente novamente.");
            toast.error("O serviço de notificações não respondeu. Tente novamente.");
          } else {
            setFailure("Não foi possível registrar este aparelho para notificações.");
            toast.error("Falha ao registrar o aparelho.");
          }
          return;
        }
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
      if (st.subscribed) {
        setFailure(null);
        trackEngagement("merchant", "push_enabled", { source: "merchant-card" });
        toast.success("Notificações ativadas neste aparelho 🎉");
      } else {
        trackEngagement("merchant", "push_failed", { stage: "server-confirm" });
        setFailure("O aparelho foi registrado, mas o servidor não confirmou. Tente novamente em instantes.");
        toast.error("Não conseguimos concluir a ativação. Tente novamente.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao ativar notificações.";
      setFailure(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function skipForNow() {
    snooze();
    setSkipped(true);
    toast.info("Tudo bem — voltamos a lembrar em 24 horas.");
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
    setDismissed(true);
    setPromptOpen(false);
  }

  if (dismissed || skipped) return null;
  if (subscribed === null) return null;
  // Nada fixo na página: browser sem suporte ou já ativo não renderiza card.
  if (!supported || subscribed) return null;

  const denied = permission === "denied";

  return (
    <>
      <Dialog
        open={promptOpen}
        onOpenChange={(o) => {
          if (!o) snooze();
          else setPromptOpen(true);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mb-1 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent">
              {denied ? <BellOff className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
            </div>
            <DialogTitle>
              {needsInstall
                ? "Instale o app para receber notificações"
                : denied
                  ? "Notificações bloqueadas"
                  : "Ative as notificações"}
            </DialogTitle>
            <DialogDescription>
              {needsInstall
                ? "No iPhone, o aviso só funciona com o Fidelize adicionado à tela de início."
                : denied
                  ? "Seu navegador está bloqueando os avisos deste site. Leva 20 segundos para reverter."
                  : "Receba avisos de novas avaliações, respostas do suporte e alertas do seu programa."}
            </DialogDescription>
          </DialogHeader>

          {failure && !denied && (
            <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">{failure}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {needsInstall ? (
              <Button size="sm" onClick={() => { setPromptOpen(false); setShowHelp(true); }}>
                <Share className="mr-2 h-4 w-4" />
                Como instalar
              </Button>
            ) : denied ? (
              <>
                <Button size="sm" onClick={() => { setPromptOpen(false); setShowHelp(true); }}>
                  <Settings className="mr-2 h-4 w-4" />
                  Como desbloquear
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setPermission(Notification.permission); void enable(); }}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Já liberei
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                {failure ? "Tentar novamente" : "Ativar notificações"}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={skipForNow}>Agora não</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {needsInstall ? "Instalar no iPhone / iPad" : "Liberar notificações"}
            </DialogTitle>
            <DialogDescription>
              {needsInstall
                ? "O iOS só entrega notificações para apps na tela de início."
                : `Passo a passo no ${browserName() === "outro" ? "seu navegador" : browserName()}.`}
            </DialogDescription>
          </DialogHeader>

          {needsInstall ? (
            <IosSetupGuide
              withNotifications
              subscribed={!!subscribed}
              onEnable={enable}
              busy={busy}
            />
          ) : isIos() ? (
            <IosSetupGuide
              withNotifications
              subscribed={!!subscribed}
              onEnable={enable}
              busy={busy}
            />
          ) : (
            <>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
                  <span>Toque no <strong>cadeado</strong> (ou ⋮ &gt; Informações do site) ao lado do endereço.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
                  <span>Abra <strong>Permissões</strong> e mude <strong>Notificações</strong> para <strong>Permitir</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
                  <span>Recarregue a página e toque em <strong>Já liberei</strong>.</span>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Se o bloqueio persistir, apague os dados do site nas configurações do navegador e tente de novo.
              </p>
            </>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
