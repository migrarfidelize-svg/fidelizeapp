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

function isAndroid() {
  if (typeof navigator === "undefined") return false;
  return /Android/.test(navigator.userAgent);
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/.test(navigator.userAgent);
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
    setErrorMsg(null);
    setErrorHint(null);
    try {
      // Step 1: request permission
      let perm: NotificationPermission;
      try {
        perm = await Notification.requestPermission();
      } catch (e) {
        throw new Error(
          `PERMISSION_ERROR::Não foi possível solicitar a permissão de notificações. ${
            e instanceof Error ? e.message : ""
          }`,
        );
      }
      setPermission(perm);
      if (perm === "denied") {
        throw new Error(
          "PERMISSION_DENIED::Você bloqueou as notificações neste site. É preciso desbloquear manualmente nas configurações do navegador.",
        );
      }
      if (perm !== "granted") {
        throw new Error(
          "PERMISSION_DISMISSED::Você fechou o pedido de permissão sem responder. Toque em ‘Receber notificações’ novamente e escolha ‘Permitir’.",
        );
      }

      // Step 2: service worker
      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.ready;
      } catch (e) {
        throw new Error(
          `SW_ERROR::O service worker não está ativo neste navegador. Recarregue a página e tente novamente. ${
            e instanceof Error ? e.message : ""
          }`,
        );
      }

      // Step 3: subscribe with VAPID
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          });
        } catch (e) {
          const raw = e instanceof Error ? e.message : String(e);
          if (/permission/i.test(raw)) {
            throw new Error(
              "PERMISSION_DENIED::O navegador recusou o registro do push (permissão negada em segundo plano).",
            );
          }
          if (/gcm|fcm|network|fetch|unreachable/i.test(raw)) {
            throw new Error(
              `PUSH_NETWORK::O serviço de push do navegador está inacessível. Verifique sua conexão e desative VPN/bloqueadores. Detalhe: ${raw}`,
            );
          }
          throw new Error(`SUBSCRIBE_ERROR::Falha ao registrar no serviço de push. Detalhe: ${raw}`);
        }
      }

      // Step 4: persist on server
      const json = sub.toJSON();
      try {
        await subscribe({
          data: {
            token,
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
            user_agent: navigator.userAgent.slice(0, 300),
          },
        });
      } catch (e) {
        // Server rejected — roll back the browser subscription so state stays consistent.
        try {
          await sub.unsubscribe();
        } catch {
          /* ignore */
        }
        throw new Error(
          `SERVER_ERROR::Não conseguimos salvar sua inscrição no servidor. Tente novamente em instantes. Detalhe: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }

      setEndpoint(sub.endpoint);
      setSubscribed(true);
      toast.success("Notificações ativadas neste cartão!");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Falha ao ativar notificações.";
      const [code, ...rest] = raw.split("::");
      const message = rest.length ? rest.join("::") : raw;
      setErrorMsg(message);
      if (code === "PERMISSION_DENIED") {
        setErrorHint("unblock");
        setShowUnblockGuide(true);
      } else if (code === "PUSH_NETWORK") {
        setErrorHint("network");
      } else if (code === "SERVER_ERROR") {
        setErrorHint("retry");
      } else if (code === "SW_ERROR") {
        setErrorHint("reload");
      } else {
        setErrorHint(null);
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setErrorMsg(null);
    setErrorHint(null);
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
      setErrorMsg(msg);
      setErrorHint("retry");
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
          <BlockedGuide browser={detectBrowser()} open={showUnblockGuide} onToggle={() => setShowUnblockGuide((v) => !v)} />
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

        {errorMsg && permission !== "denied" && (
          <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="font-medium text-destructive">Não foi possível ativar</p>
                <p className="text-muted-foreground break-words">{errorMsg}</p>
              </div>
            </div>
            {errorHint === "network" && (
              <p className="text-muted-foreground">
                • Verifique sua internet, desative VPN/proxy e bloqueadores como AdGuard ou Brave Shields, depois toque em <strong>Receber notificações</strong> novamente.
              </p>
            )}
            {errorHint === "reload" && (
              <p className="text-muted-foreground">
                • Recarregue a página (puxe para baixo ou pressione F5) e tente ativar de novo.
              </p>
            )}
            {errorHint === "retry" && (
              <Button size="sm" variant="outline" onClick={enable} disabled={busy} className="w-full">
                Tentar novamente
              </Button>
            )}
          </div>
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

function BlockedGuide({
  browser,
  open,
  onToggle,
}: {
  browser: ReturnType<typeof detectBrowser>;
  open: boolean;
  onToggle: () => void;
}) {
  const steps: Record<string, string[]> = {
    chrome: [
      "Toque no cadeado 🔒 (ou ícone de ajustes) ao lado do endereço do site.",
      "Abra ‘Permissões do site’ → ‘Notificações’.",
      "Troque de ‘Bloquear’ para ‘Permitir’ e recarregue esta página.",
    ],
    edge: [
      "Toque no cadeado 🔒 ao lado do endereço do site.",
      "Abra ‘Permissões para este site’ → ‘Notificações’.",
      "Selecione ‘Permitir’ e recarregue a página.",
    ],
    firefox: [
      "Toque no cadeado 🔒 ao lado do endereço.",
      "Abra ‘Mais informações’ → ‘Permissões’ → ‘Enviar notificações’.",
      "Desmarque ‘Usar padrão’ e escolha ‘Permitir’, depois recarregue.",
    ],
    safari: [
      "Abra Ajustes do iPhone/iPad → ‘Notificações’.",
      "Encontre este app (adicionado à tela de início) e ative ‘Permitir Notificações’.",
      "Volte aqui e recarregue a página.",
    ],
    opera: [
      "Toque no cadeado 🔒 ao lado do endereço.",
      "Abra permissões do site → ‘Notificações’ → ‘Permitir’.",
      "Recarregue a página.",
    ],
    samsung: [
      "Toque no cadeado 🔒 ao lado do endereço.",
      "Abra ‘Permissões’ → ‘Notificações’ → ‘Permitir’.",
      "Recarregue a página.",
    ],
    other: [
      "Abra as permissões deste site nas configurações do navegador.",
      "Localize ‘Notificações’ e mude de ‘Bloquear’ para ‘Permitir’.",
      "Recarregue esta página e tente novamente.",
    ],
  };
  const list = steps[browser] ?? steps.other;
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="space-y-1">
          <p className="font-medium text-destructive">Notificações bloqueadas neste navegador</p>
          <p className="text-muted-foreground">
            O navegador está recusando o pedido automaticamente. Para reativar, é preciso desbloquear
            manualmente nas configurações do site.
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onToggle} className="w-full">
        <Info className="mr-2 h-4 w-4" />
        {open ? "Ocultar passo a passo" : "Ver como desbloquear"}
      </Button>
      {open && (
        <ol className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-foreground">
          {list.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-bold text-primary">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
          <li className="flex gap-2 border-t border-border/60 pt-2 text-muted-foreground">
            <span>ℹ️</span>
            <span>
              Depois de permitir, recarregue esta página e toque em <strong>Receber notificações</strong> novamente.
            </span>
          </li>
        </ol>
      )}
    </div>
  );
}

