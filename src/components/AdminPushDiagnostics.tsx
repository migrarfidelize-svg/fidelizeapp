import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Loader2, Send, Copy, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { canRegisterServiceWorker, ensurePwaRegistration } from "@/lib/pwa-register";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";
import {
  subscribeAdminPush,
  getAdminPushStatus,
  sendAdminTestPush,
  logAdminPushEvent,
  vapidHealthCheck,
  listMyPushEvents,
} from "@/lib/push.functions";

type Check = { label: string; value: string | boolean; ok?: boolean; hint?: string };

function detectBrowser(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/EdgA?\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Outro";
}
function detectOS(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Windows/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Outro";
}
function detectDeviceType(): "mobile" | "tablet" | "desktop" {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1))
    return "tablet";
  if (/Android|iPhone|iPod|Mobile/.test(ua)) return "mobile";
  return "desktop";
}
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function AdminPushDiagnostics() {
  const subscribeFn = useServerFn(subscribeAdminPush);
  const statusFn = useServerFn(getAdminPushStatus);
  const testFn = useServerFn(sendAdminTestPush);
  const logFn = useServerFn(logAdminPushEvent);
  const vapidFn = useServerFn(vapidHealthCheck);
  const eventsFn = useServerFn(listMyPushEvents);

  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [localTestBusy, setLocalTestBusy] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [swRegistered, setSwRegistered] = useState<boolean>(false);
  const [swActive, setSwActive] = useState<boolean>(false);
  const [vapid, setVapid] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const gate = useMemo(() => (typeof window === "undefined" ? { allowed: false, reason: "unsupported" as const } : canRegisterServiceWorker()), []);
  const browser = useMemo(detectBrowser, []);
  const os = useMemo(detectOS, []);
  const deviceType = useMemo(detectDeviceType, []);
  const standalone = useMemo(isStandalone, []);

  async function refreshAll() {
    try {
      if ("Notification" in window) setPermission(Notification.permission);
      const regs = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
      const mine = regs.find((r) => (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "").endsWith("/sw.js"));
      setSwRegistered(!!mine);
      setSwActive(!!mine?.active);
      if (mine) {
        const sub = await mine.pushManager.getSubscription();
        if (sub) {
          setEndpoint(sub.endpoint);
          const st = await statusFn({ data: { endpoint: sub.endpoint } });
          setSubscribed(!!st.subscribed);
        } else {
          setEndpoint(null);
          setSubscribed(false);
        }
      }
      const v = await vapidFn();
      setVapid(v);
      const evs = await eventsFn();
      setEvents(evs ?? []);
    } catch (e) {
      // best-effort
      console.warn("[push-diag] refresh failed", e);
    }
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableHere() {
    setBusy(true);
    setLastError(null);
    try {
      if (!gate.allowed) {
        const reasonMsg: Record<string, string> = {
          unsupported: "Este navegador não suporta notificações push.",
          "not-production": "O registro só funciona no domínio publicado.",
          "in-iframe": "Abra este endereço em uma aba própria, fora do editor da Lovable.",
          "preview-host": "As notificações só podem ser ativadas no aplicativo publicado.",
          "kill-switch": "O parâmetro ?sw=off está desativando o service worker.",
        };
        throw new Error(reasonMsg[gate.reason] || "Ambiente não permite registrar o service worker.");
      }
      await logFn({ data: { event_type: "permission_request_started", hostname: location.hostname, browser, operating_system: os } });
      const perm = await Notification.requestPermission();
      setPermission(perm);
      await logFn({
        data: {
          event_type: perm === "granted" ? "permission_granted" : "permission_denied",
          status: perm,
          hostname: location.hostname,
          browser,
          operating_system: os,
        },
      });
      if (perm !== "granted") throw new Error("Permissão não concedida.");

      await logFn({ data: { event_type: "service_worker_registration_started", hostname: location.hostname } });
      const reg = await ensurePwaRegistration();
      setSwRegistered(true);
      setSwActive(!!reg.active);
      await logFn({ data: { event_type: "service_worker_registration_success", status: "active" } });

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        await logFn({ data: { event_type: "push_subscription_started" } });
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          });
          await logFn({ data: { event_type: "push_subscription_created" } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logFn({ data: { event_type: "push_subscription_failed", error_message: msg } });
          throw new Error(`Falha ao criar subscription: ${msg}`);
        }
      }

      const json = sub.toJSON();
      await logFn({ data: { event_type: "subscription_persist_started" } });
      try {
        await subscribeFn({
          data: {
            endpoint: sub.endpoint,
            p256dh: json.keys?.p256dh ?? "",
            auth: json.keys?.auth ?? "",
            user_agent: navigator.userAgent.slice(0, 300),
            device_type: deviceType,
            operating_system: os,
            browser,
            permission_status: perm,
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logFn({ data: { event_type: "subscription_persist_failed", error_message: msg } });
        throw new Error(`Falha ao salvar no banco: ${msg}`);
      }
      setEndpoint(sub.endpoint);
      setSubscribed(true);
      toast.success("Dispositivo registrado com sucesso.");
      await refreshAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!endpoint) return;
    setTestBusy(true);
    setLastError(null);
    try {
      const r = await testFn({ data: { endpoint } });
      toast.success(`Notificação enviada (HTTP ${r.status}). Verifique seu dispositivo.`);
      await refreshAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      toast.error(msg);
    } finally {
      setTestBusy(false);
    }
  }

  async function sendLocalDisplayTest() {
    setLocalTestBusy(true);
    setLastError(null);
    try {
      if (Notification.permission !== "granted") {
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") throw new Error("Permissão não concedida.");
      }
      const reg = await ensurePwaRegistration();
      const localNotificationOptions = {
        body: "Se este alerta aparecer, a exibição do navegador/Windows está liberada.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `local-display-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        data: { url: "/admin/notificacoes" },
      } as NotificationOptions;
      await reg.showNotification("Teste local Fidelize", localNotificationOptions);
      toast.success("Teste local disparado. Se não apareceu, o bloqueio está no navegador ou no sistema operacional.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      toast.error(msg);
    } finally {
      setLocalTestBusy(false);
    }
  }

  const checks: Check[] = [
    { label: "Ambiente permite Service Worker", value: gate.allowed, ok: gate.allowed, hint: !gate.allowed ? (gate as any).reason : undefined },
    { label: "'serviceWorker' em navigator", value: "serviceWorker" in navigator, ok: "serviceWorker" in navigator },
    { label: "'PushManager' em window", value: typeof window !== "undefined" && "PushManager" in window, ok: typeof window !== "undefined" && "PushManager" in window },
    { label: "Notification API disponível", value: typeof window !== "undefined" && "Notification" in window, ok: typeof window !== "undefined" && "Notification" in window },
    { label: "Service Worker registrado", value: swRegistered, ok: swRegistered },
    { label: "Service Worker ativo", value: swActive, ok: swActive },
    { label: "Permissão de notificação", value: permission, ok: permission === "granted" },
    { label: "PWA em modo standalone", value: standalone, ok: standalone, hint: !standalone && os === "iOS" ? "No iOS instale via 'Adicionar à Tela de Início'" : undefined },
    { label: "Dispositivo", value: `${deviceType} · ${os} · ${browser}` },
    { label: "Hostname", value: typeof window !== "undefined" ? window.location.hostname : "-" },
    { label: "VAPID pública carregada (frontend)", value: !!VAPID_PUBLIC_KEY, ok: !!VAPID_PUBLIC_KEY },
    { label: "VAPID pública configurada (backend)", value: !!vapid?.public_key_present, ok: !!vapid?.public_key_format_ok },
    { label: "VAPID privada configurada (backend)", value: !!vapid?.private_key_present, ok: !!vapid?.private_key_format_ok },
    { label: "VAPID subject", value: vapid?.subject ?? "-", ok: !!vapid?.subject_present },
    { label: "Subscription persistida", value: subscribed, ok: subscribed },
    { label: "Endpoint", value: endpoint ? `${endpoint.slice(0, 60)}…` : "—", ok: !!endpoint },
  ];

  function copyReport() {
    const safe = checks.map((c) => `- ${c.label}: ${typeof c.value === "boolean" ? (c.value ? "sim" : "não") : c.value}`);
    const evtLines = events
      .slice(0, 20)
      .map((e) => `  · [${e.created_at}] ${e.event_type} ${e.status ?? ""} ${e.error_message ?? ""}`);
    const text = [
      "# Fidelize — Diagnóstico Push",
      ...safe,
      "",
      `VAPID pública (preview): ${vapid?.public_key_preview ?? "-"}`,
      `Último erro: ${lastError ?? "-"}`,
      "",
      "Eventos recentes:",
      ...evtLines,
    ].join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Relatório copiado."))
      .catch(() => toast.error("Não foi possível copiar."));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Diagnóstico de Push Notifications
          </CardTitle>
          <CardDescription>
            Registre este dispositivo, envie uma notificação real de teste e inspecione todos os pontos do fluxo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-muted-foreground break-all">
                    {typeof c.value === "boolean" ? (c.value ? "sim" : "não") : String(c.value)}
                  </div>
                  {c.hint && <div className="text-[10px] text-amber-600 dark:text-amber-400">{c.hint}</div>}
                </div>
                {c.ok === true ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : c.ok === false ? (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                ) : null}
              </div>
            ))}
          </div>

          {lastError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="text-muted-foreground break-words">{lastError}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={enableHere} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              {subscribed ? "Reativar neste dispositivo" : "Ativar notificações neste dispositivo"}
            </Button>
            <Button variant="outline" onClick={sendTest} disabled={!subscribed || testBusy}>
              {testBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar notificação de teste
            </Button>
            <Button variant="outline" onClick={sendLocalDisplayTest} disabled={localTestBusy}>
              {localTestBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
              Testar alerta local
            </Button>
            <Button variant="ghost" onClick={refreshAll}>
              <RefreshCw className="mr-2 h-4 w-4" /> Executar diagnóstico
            </Button>
            <Button variant="ghost" onClick={copyReport}>
              <Copy className="mr-2 h-4 w-4" /> Copiar relatório técnico
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos recentes deste usuário</CardTitle>
          <CardDescription>Últimos 50 eventos do ciclo de push registrados.</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento ainda. Clique em "Ativar notificações" acima.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={e.status === "failed" ? "destructive" : "outline"}>{e.event_type}</Badge>
                    {e.error_message && (
                      <span className="text-destructive break-all">{e.error_message}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
