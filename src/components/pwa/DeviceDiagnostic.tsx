import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { detectPWAState, type PWAState } from "@/lib/pwa-installation";
import { canRegisterServiceWorker } from "@/lib/pwa-register";

type Row = { label: string; value: string; ok?: boolean | null };

/**
 * Diagnóstico do dispositivo atual (Sistema → Notificações Push → Diagnóstico).
 * Somente leitura. Não altera subscriptions nem envia push.
 */
export function DeviceDiagnostic() {
  const [state, setState] = useState<PWAState>(() => detectPWAState());
  const [swReg, setSwReg] = useState<boolean>(false);
  const [swActive, setSwActive] = useState<boolean>(false);
  const [subEndpoint, setSubEndpoint] = useState<string | null>(null);
  const [manifestOk, setManifestOk] = useState<boolean | null>(null);

  async function refresh() {
    setState(detectPWAState());
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      const mine = regs.find((r) =>
        (r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "").endsWith("/sw.js"),
      );
      setSwReg(!!mine);
      setSwActive(!!mine?.active);
      if (mine) {
        try {
          const sub = await mine.pushManager.getSubscription();
          setSubEndpoint(sub?.endpoint ?? null);
        } catch {
          setSubEndpoint(null);
        }
      }
    }
    try {
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      setManifestOk(!!link?.href);
    } catch {
      setManifestOk(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const gate = canRegisterServiceWorker();
  const rows: Row[] = [
    { label: "Plataforma", value: state.platform },
    { label: "Navegador", value: state.browser },
    { label: "Domínio", value: state.hostname },
    { label: "HTTPS", value: String(state.isHTTPS), ok: state.isHTTPS },
    { label: "Manifest carregado", value: String(!!manifestOk), ok: manifestOk },
    { label: "Service Worker registrado", value: String(swReg), ok: swReg },
    { label: "Service Worker ativo", value: String(swActive), ok: swActive },
    {
      label: "Ambiente permite SW",
      value: gate.allowed ? "sim" : `não (${(gate as { reason?: string }).reason ?? "?"})`,
      ok: gate.allowed,
    },
    { label: "Modo standalone", value: String(state.isStandalone), ok: state.isStandalone },
    { label: "Aplicativo instalado", value: String(state.isInstalled), ok: state.isInstalled },
    { label: "Notification API", value: String(state.supportsNotifications), ok: state.supportsNotifications },
    { label: "PushManager", value: String(state.supportsPushManager), ok: state.supportsPushManager },
    { label: "Permissão atual", value: state.notificationPermission, ok: state.notificationPermission === "granted" },
    {
      label: "Subscription no navegador",
      value: subEndpoint ? subEndpoint.slice(0, 60) + "…" : "não",
      ok: !!subEndpoint,
    },
    { label: "beforeinstallprompt disponível", value: String(state.canUseBeforeInstallPrompt), ok: null },
    { label: "Navegador embutido", value: String(state.isInAppBrowser), ok: !state.isInAppBrowser },
  ];

  async function copyDiagnostic() {
    const text = rows.map((r) => `${r.label}: ${r.value}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Diagnóstico copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  const advice = buildAdvice(state, swActive, !!subEndpoint);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Diagnóstico do dispositivo</CardTitle>
          <CardDescription className="text-xs">
            Verifica o estado real do aparelho, navegador e inscrição de push.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Executar novamente
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyDiagnostic}>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y divide-border/60 overflow-hidden rounded-lg border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="flex items-center gap-1.5 font-mono">
                <span className="max-w-[280px] truncate">{r.value}</span>
                {r.ok === true ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : r.ok === false ? (
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                ) : null}
              </span>
            </div>
          ))}
        </div>

        {advice ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="whitespace-pre-line">{advice}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function buildAdvice(state: PWAState, swActive: boolean, hasSub: boolean): string | null {
  if (state.isInAppBrowser) {
    return "Você está em um navegador embutido (Instagram, Facebook, WhatsApp, etc.). Abra este endereço no navegador padrão do sistema para instalar e receber notificações.";
  }
  if (state.isIOS && !state.isStandalone) {
    return "No iPhone/iPad, abra no Safari, use Compartilhar → Adicionar à Tela de Início e depois abra pelo ícone. As notificações só funcionam depois disso.";
  }
  if (state.isAndroid && !state.isStandalone) {
    return "Instale o aplicativo (botão acima) e abra pelo ícone criado na tela inicial para receber notificações em segundo plano.";
  }
  if (state.notificationPermission === "denied") {
    return "As notificações foram bloqueadas nas configurações do navegador. Abra as permissões do site e libere notificações para este domínio.";
  }
  if (state.notificationPermission === "default") {
    return 'Toque em "Ativar notificações" para conceder permissão.';
  }
  if (!swActive) {
    return "O Service Worker ainda não está ativo. Recarregue a página e verifique novamente.";
  }
  if (!hasSub) {
    return "Este dispositivo ainda não está registrado. Ative as notificações para criar a inscrição.";
  }
  if (state.platform === "windows") {
    return "No Windows: verifique Sistema → Notificações (permitir Chrome/Edge), desative Não Perturbe/Assistente de Foco e mantenha o Chrome executando em segundo plano. O servidor pode ter enviado (HTTP 201) mesmo que o Windows/Chrome bloqueie a exibição.";
  }
  return null;
}
