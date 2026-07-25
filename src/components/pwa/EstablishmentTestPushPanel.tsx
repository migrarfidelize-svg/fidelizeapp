import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Send, Loader2, Bell, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { ensurePwaRegistration } from "@/lib/pwa-register";
import {
  previewEstablishmentTestPush,
  sendEstablishmentTestPush,
} from "@/lib/push.functions";

type Preview = Awaited<ReturnType<typeof previewEstablishmentTestPush>>;
type SendResult = Awaited<ReturnType<typeof sendEstablishmentTestPush>>;

/**
 * Painel de teste isolado por empresa. Só afeta 1 subscription do lojista.
 * Preserva o backend/VAPID/SW; usa a função server sendEstablishmentTestPush.
 */
export function EstablishmentTestPushPanel({
  defaultName = "NextStage",
}: {
  defaultName?: string;
}) {
  const previewFn = useServerFn(previewEstablishmentTestPush);
  const sendFn = useServerFn(sendEstablishmentTestPush);

  const [name, setName] = useState(defaultName);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [feedback, setFeedback] = useState<"received" | "missing" | null>(null);
  const [localBusy, setLocalBusy] = useState(false);

  async function doPreview() {
    setLoading(true);
    setPreview(null);
    setResult(null);
    setFeedback(null);
    try {
      const p = await previewFn({ data: { establishmentName: name.trim() } });
      setPreview(p);
      if (!p.selected) toast.warning(`Nenhum dispositivo ativo para ${p.establishment.name}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao localizar empresa.");
    } finally {
      setLoading(false);
    }
  }

  async function doLocalTest() {
    setLocalBusy(true);
    try {
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") throw new Error("Permissão não concedida.");
      }
      const reg = await ensurePwaRegistration();
      await reg.showNotification(`Teste local — ${preview?.establishment.name ?? "empresa"}`, {
        body: "O navegador e o Windows permitiram exibir esta notificação.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `local-${Date.now()}`,
        requireInteraction: false,
      });
      toast.success("Alerta local disparado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no alerta local.");
    } finally {
      setLocalBusy(false);
    }
  }

  async function doSend() {
    if (!preview?.selected) return;
    setSending(true);
    setConfirmOpen(false);
    try {
      const r = await sendFn({
        data: {
          establishmentId: preview.establishment.id,
          subscriptionId: preview.selected.id,
          clientNotificationId: `nextstage-test-${Date.now()}`,
        },
      });
      setResult(r);
      if (r.status === "provider_accepted") {
        toast.success(`Aceito pelo provedor (HTTP ${r.status_code}).`);
      } else if (r.status === "subscription_expired") {
        toast.warning("Subscription expirada. Dispositivo precisa reativar as notificações.");
      } else {
        toast.error(`Falha HTTP ${r.status_code ?? "?"}.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setSending(false);
    }
  }

  const sel = preview?.selected;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Teste isolado por empresa
        </CardTitle>
        <CardDescription className="text-xs">
          Envia UMA notificação para UM dispositivo do lojista. Não afeta clientes finais nem outras empresas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome exato da empresa"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" onClick={doPreview} disabled={loading || !name.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Localizar"}
          </Button>
        </div>

        {preview ? (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{preview.establishment.name}</span>
              <Badge variant="outline">{preview.totalMatching} disp. lojista</Badge>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              ID: {preview.establishment.id}
            </div>
            {sel ? (
              <div className="mt-2 space-y-0.5">
                <div>Dispositivo: {sel.operating_system} / {sel.browser} / {sel.device_type}</div>
                <div>Subscription: <span className="font-mono">{sel.id.slice(0, 8)}…</span></div>
                <div>Endpoint: <span className="font-mono">{sel.endpoint_prefix}</span></div>
                <div>Inscrito em: {new Date(sel.created_at).toLocaleString("pt-BR")}</div>
                <div className="mt-2 text-muted-foreground">Destinatários: 1 · Clientes afetados: 0</div>
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">Nenhum dispositivo ativo do lojista.</p>
            )}
            {preview.others.length > 0 ? (
              <p className="mt-2 text-[10px] text-amber-500">
                Existem {preview.others.length} outra(s) subscription(s) ativa(s); será usada apenas a mais recente.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={doLocalTest}
            disabled={!preview?.selected || localBusy}
            className="gap-1.5"
          >
            {localBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
            1. Testar alerta local
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={!preview?.selected || sending}
            className="gap-1.5"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            2. Enviar notificação de teste
          </Button>
        </div>

        {result ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 font-medium">
              {result.status === "provider_accepted" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              Resultado do envio
            </div>
            <div className="space-y-0.5 font-mono text-[11px]">
              <div>Empresa: {result.establishment.name}</div>
              <div>Notification ID: {result.notification_id}</div>
              <div>Subscription: {result.subscription_id.slice(0, 8)}…</div>
              <div>Status: {result.status}</div>
              <div>HTTP: {result.status_code ?? "—"}</div>
              {"recipients_sent" in result ? (
                <>
                  <div>Destinatários selecionados: {result.recipients_selected}</div>
                  <div>Aceitos pelo provedor: {result.recipients_sent}</div>
                  <div>Clientes atingidos: {result.customers_affected}</div>
                  <div>Outras empresas atingidas: {result.other_establishments_affected}</div>
                </>
              ) : null}
              {"deduplicated" in result && result.deduplicated ? (
                <div className="text-amber-500">Ignorado por deduplicação (5s).</div>
              ) : null}
            </div>
            {"note" in result && result.note ? (
              <p className="mt-2 text-[10px] text-muted-foreground">{result.note}</p>
            ) : null}

            {result.status === "provider_accepted" ? (
              <div className="mt-3 space-y-2 border-t pt-2">
                <p className="text-xs font-medium">A notificação apareceu no dispositivo?</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={feedback === "received" ? "default" : "outline"}
                    onClick={() => {
                      setFeedback("received");
                      toast.success("Teste concluído com sucesso.");
                    }}
                  >
                    Sim, recebi
                  </Button>
                  <Button
                    size="sm"
                    variant={feedback === "missing" ? "destructive" : "outline"}
                    onClick={() => setFeedback("missing")}
                  >
                    Não recebi
                  </Button>
                </div>
                {feedback === "missing" ? (
                  <ol className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    <li>1. Confirme que o teste foi feito no mesmo Chrome que ativou as notificações.</li>
                    <li>2. Chrome → Configurações → Privacidade → Notificações: domínio permitido.</li>
                    <li>3. Windows → Sistema → Notificações: Chrome autorizado.</li>
                    <li>4. Desative Não Perturbe / Assistente de Foco.</li>
                    <li>5. Chrome pode executar em segundo plano.</li>
                    <li>6. Rode primeiro o "Testar alerta local".</li>
                  </ol>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar teste para {preview?.establishment.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Será enviada uma única notificação para o dispositivo ativo do lojista.
              <br />
              Empresa: {preview?.establishment.name}
              <br />
              Dispositivo: {sel?.operating_system} / {sel?.browser}
              <br />
              Destinatários: 1 · Clientes afetados: 0
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSend}>Enviar notificação de teste</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
