import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminGetPaymentSettings,
  adminUpdatePaymentSettings,
  adminTestMercadoPagoConnection,
  adminGetWebhookGuide,
  adminListWebhookLogs,
  adminValidateWebhookUrl,
  adminGetWebhookHealth,
  adminRetryWebhookQueue,
  adminSyncWebhookUrl,
  adminSendWebhookTestEvent,
  adminSendWebhookDualTest,
} from "@/lib/mercadopago.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw, ShieldCheck, Radio, Activity, RotateCw, Send } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin/pagamentos")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const getFn = useServerFn(adminGetPaymentSettings);
  const saveFn = useServerFn(adminUpdatePaymentSettings);
  const testFn = useServerFn(adminTestMercadoPagoConnection);

  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin-payment-settings"], queryFn: () => getFn(), refetchInterval: 60_000, refetchOnWindowFocus: true });

  const [environment, setEnvironment] = useState<"sandbox"|"production">("production");
  const [publicKey, setPublicKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (data?.settings) {
      setEnvironment(((data as any).settings.environment as any) ?? "production");
      setPublicKey(((data as any).settings.public_key as any) ?? "");
    }
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      await saveFn({ data: { environment, public_key: publicKey || null } });
      toast.success("Configurações salvas!");
      refetch();
    } catch (e: any) { toast.error(e.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  async function test() {
    setTesting(true);
    setTestResult(null);
    try {
      const r: any = await testFn();
      setTestResult(r);
      toast.success(`Conectado! ${r.account?.nickname ?? r.account?.email ?? ""}`);
      refetch();
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message });
      toast.error(e.message ?? "Falha ao testar conexão");
      refetch();
    } finally { setTesting(false); }
  }

  if (isLoading) return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const creds = (data as any)?.credentials ?? { has_access_token: false, has_webhook_secret: false, has_public_key: false };
  const webhookUrl = (data as any)?.webhook_url ?? "";
  const storedWebhookUrl: string | null = (data as any)?.stored_webhook_url ?? null;
  const webhookStale: boolean = !!(data as any)?.webhook_url_stale;
  const settingsUpdatedAt: string | null = (data as any)?.settings_updated_at ?? null;
  const lastDivergenceAt: string | null = (data as any)?.last_divergence_at ?? null;
  const settings = (data as any)?.settings ?? {};

  const syncFn = useServerFn(adminSyncWebhookUrl);
  const probeFn = useServerFn(adminSendWebhookTestEvent);
  const [syncing, setSyncing] = useState(false);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);

  // Toast one-shot por par (stored,canonical) — evita spam a cada refetch
  const notifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!webhookStale) { notifiedRef.current = null; return; }
    const key = `${storedWebhookUrl}→${webhookUrl}`;
    if (notifiedRef.current === key) return;
    notifiedRef.current = key;
    toast.warning("Webhook do Mercado Pago desatualizado", {
      description: "A URL salva diverge da canônica atual. Atualize no painel do Mercado Pago.",
      action: {
        label: "Abrir painel MP",
        onClick: () => window.open("https://www.mercadopago.com.br/developers/panel/app", "_blank", "noopener,noreferrer"),
      },
      duration: 10_000,
    });
  }, [webhookStale, storedWebhookUrl, webhookUrl]);

  async function reconcileStoredUrl() {
    setSyncing(true);
    try {
      const r: any = await syncFn();
      toast.success(`URL sincronizada: ${r.to}`);
      refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao sincronizar"); }
    finally { setSyncing(false); }
  }

  async function runProbe() {
    setProbing(true);
    setProbeResult(null);
    try {
      const r: any = await probeFn();
      setProbeResult(r);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar evento de teste");
    } finally { setProbing(false); }
  }

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("pt-BR") : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Mercado Pago</h1>
        <p className="text-sm text-muted-foreground">Integração de pagamentos para as assinaturas da plataforma.</p>
      </div>

      {webhookStale && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <div className="font-medium text-amber-900 dark:text-amber-100">URL do webhook desatualizada</div>
                <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
                  A URL salva diverge da URL canônica atual. Atualize também no painel do Mercado Pago para não perder eventos.
                </p>
              </div>
              <div className="grid gap-1 text-xs font-mono">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="bg-destructive/15 text-destructive shrink-0">Salva</Badge>
                  <span className="truncate" title={storedWebhookUrl ?? ""}>{storedWebhookUrl ?? "—"}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shrink-0">Canônica</Badge>
                  <span className="truncate" title={webhookUrl}>{webhookUrl}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-amber-900/80 dark:text-amber-100/80">
                <div><span className="opacity-70">Última atualização salva:</span><br /><span className="font-mono">{fmt(settingsUpdatedAt)}</span></div>
                <div><span className="opacity-70">Divergência detectada:</span><br /><span className="font-mono">{fmt(lastDivergenceAt)}</span></div>
                <div><span className="opacity-70">Última verificação:</span><br /><span className="font-mono">{fmt(probeResult?.checked_at ?? null)}</span></div>
              </div>
              {probeResult && (
                <div className={`rounded-lg border p-2 text-xs ${probeResult.ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
                  <div className="flex items-center gap-2">
                    {probeResult.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="font-medium">
                      {probeResult.ok ? "Endpoint recebeu evento de teste" : "Evento de teste não confirmado"}
                    </span>
                  </div>
                  <div className="mt-1 opacity-80">
                    HTTP {probeResult.status ?? "—"} · {probeResult.latency_ms}ms · log {probeResult.log_matched ? "✓ registrado" : "✗ não encontrado"}
                  </div>
                  <div className="mt-1">{probeResult.message}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL canônica copiada!"); }}>
                  <Copy className="mr-2 h-4 w-4" />Copiar URL canônica
                </Button>
                <Button size="sm" variant="outline" onClick={reconcileStoredUrl} disabled={syncing}>
                  {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sincronizar valor salvo
                </Button>
                <Button size="sm" variant="outline" onClick={runProbe} disabled={probing}>
                  {probing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Testar entrega real
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a
                    href={`https://www.mercadopago.com.br/developers/panel/app?webhook_url=${encodeURIComponent(webhookUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />Atualizar no Mercado Pago
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais do Mercado Pago</CardTitle>
          <CardDescription>
            Somente <strong>Access Token</strong> e <strong>Webhook Secret</strong> são secrets do backend.
            A <strong>Public Key</strong> é preenchida no campo do formulário abaixo (não existe secret obrigatório para ela).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SecretRow
            name="MERCADOPAGO_ACCESS_TOKEN"
            label="Access Token (produção)"
            ok={creds.has_access_token}
            hint={'Painel do Mercado Pago → "Suas integrações" → sua aplicação → "Credenciais de produção" → copie o "Access Token" (começa com APP_USR-…).'}
          />
          <SecretRow
            name="MERCADOPAGO_PUBLIC_KEY"
            label="Public Key"
            ok={creds.has_public_key}
            optional
            source={(creds as any).public_key_source}
            hint={'A Public Key NÃO precisa virar secret — cole ela no campo "Chave pública" logo abaixo e clique em Salvar. O secret MERCADOPAGO_PUBLIC_KEY é apenas um cache opcional para o backend; se estiver vazio, usamos o valor salvo no formulário.'}
          />
          <SecretRow
            name="MERCADOPAGO_WEBHOOK_SECRET"
            label="Webhook Secret"
            ok={creds.has_webhook_secret}
            hint={'Painel do Mercado Pago → "Suas integrações" → sua aplicação → "Webhooks" → após cadastrar a URL, clique em "Configurar notificações" e copie a chave secreta que aparece em "Assinatura secreta".'}
          />
          <p className="text-xs text-muted-foreground">
            Para adicionar ou trocar Access Token/Webhook Secret, peça ao Lovable:
            <em> "atualize o secret MERCADOPAGO_ACCESS_TOKEN"</em>. Os valores são gravados criptografados e injetados como variáveis de ambiente no backend.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
          <CardDescription>Ambiente e Public Key expostas ao navegador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 max-w-xl">
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={environment} onValueChange={v => setEnvironment(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                <SelectItem value="production">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chave pública</Label>
            <Input value={publicKey} onChange={e => setPublicKey(e.target.value)} placeholder="APP_USR-abcd-…" className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">Usada apenas no navegador para tokenizar o cartão. Pode conviver com a variável de ambiente <code>MERCADOPAGO_PUBLIC_KEY</code>; a variável de ambiente tem prioridade.</p>
          </div>
          <div className="space-y-2">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" aria-label="Copiar URL do webhook" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("Copiado!"); }}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Cole no painel do Mercado Pago em <em>Suas integrações → Webhooks</em>. Use os eventos recomendados abaixo.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
            <Button variant="outline" onClick={test} disabled={testing || !creds.has_access_token}>{testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Testar conexão</Button>
            <ValidateWebhookButton />
          </div>
        </CardContent>
      </Card>

      <WebhookHealthCard />

      <DualWebhookTestCard hasSecret={!!creds.has_webhook_secret} />

      <RecommendedEventsCard />

      <WebhookLogsCard />



      <Card>
        <CardHeader><CardTitle className="text-base">Status da conexão</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {settings?.last_tested_at ? (
            <div className="flex items-center gap-2">
              {settings.last_test_status === "ok" ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
              <div className="text-sm">
                <div className="font-medium">{settings.last_test_status === "ok" ? "Conectado" : "Falhou"}</div>
                <div className="text-xs text-muted-foreground">{settings.last_test_message}</div>
                <div className="text-xs text-muted-foreground">Último teste: {new Date(settings.last_tested_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-5 w-5" />Ainda não testado.</div>
          )}
          {testResult?.account && (
            <div className="mt-3 rounded-lg bg-muted p-3 text-xs space-y-1">
              <div><strong>Conta:</strong> {testResult.account.nickname ?? testResult.account.email}</div>
              <div><strong>Site:</strong> {testResult.account.site_id}</div>
              <div><strong>Modo:</strong> <Badge variant={testResult.account.live_mode ? "default" : "secondary"}>{testResult.account.live_mode ? "Produção" : "Teste"}</Badge></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentação</CardTitle>
          <CardDescription>Referências oficiais do Mercado Pago.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <a className="inline-flex items-center gap-2 text-primary hover:underline" href="https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Checkout API (Cartão / PIX / Boleto)</a>
          <a className="inline-flex items-center gap-2 text-primary hover:underline" href="https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Webhooks e assinatura HMAC</a>
          <a className="inline-flex items-center gap-2 text-primary hover:underline" href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Painel de aplicações</a>
        </CardContent>
      </Card>
    </div>
  );
}

function SecretRow({ name, label, ok, hint }: { name: string; label: string; ok: boolean; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          {ok ? <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Configurado</Badge>
              : <Badge variant="outline" className="bg-destructive/15 text-destructive">Não configurado</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        <code className="text-[10px] text-muted-foreground">{name}</code>
      </div>
    </div>
  );
}

function ValidateWebhookButton() {
  const validateFn = useServerFn(adminValidateWebhookUrl);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [open, setOpen] = useState(false);

  async function run() {
    setLoading(true);
    setResult(null);
    setOpen(true);
    try {
      const r: any = await validateFn();
      setResult(r);
      if (r.ok) toast.success(`Handshake OK (${r.status}) em ${r.latency_ms}ms`);
      else toast.error(r.message);
    } catch (e: any) {
      setResult({ ok: false, message: e?.message ?? String(e) });
      toast.error(e?.message ?? "Falha ao validar");
    } finally { setLoading(false); }
  }

  return (
    <>
      <Button variant="outline" onClick={run} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
        Validar webhook URL
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Handshake do webhook</DialogTitle>
            <DialogDescription>Tentativa de GET na URL pública para confirmar acessibilidade.</DialogDescription>
          </DialogHeader>
          {loading && <div className="grid place-items-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {result && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                {result.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                <span className="font-medium">{result.ok ? "OK" : "Falhou"}</span>
              </div>
              <div className="rounded-lg bg-muted p-3 text-xs space-y-1 font-mono break-all">
                <div><strong>URL:</strong> {result.url}</div>
                <div><strong>HTTPS:</strong> {String(result.https)}</div>
                <div><strong>Alcançável:</strong> {String(result.reachable)}</div>
                <div><strong>Status HTTP:</strong> {result.status ?? "—"}</div>
                <div><strong>Latência:</strong> {result.latency_ms} ms</div>
                {result.body_snippet && <div className="pt-2 border-t"><strong>Resposta:</strong> {result.body_snippet}</div>}
              </div>
              <p className="text-xs text-muted-foreground">{result.message}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecommendedEventsCard() {
  const guideFn = useServerFn(adminGetWebhookGuide);
  const { data } = useQuery({ queryKey: ["mp-webhook-guide"], queryFn: () => guideFn() });
  const events = (data as any)?.events ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Radio className="h-4 w-4" />Eventos recomendados</CardTitle>
        <CardDescription>Marque estes eventos no painel do Mercado Pago → Suas integrações → Webhooks. Os obrigatórios já vêm pré-selecionados abaixo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.map((ev: any) => (
          <label key={ev.key} className="flex items-start gap-3 rounded-lg border p-3 cursor-default">
            <Checkbox checked={ev.required} disabled className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{ev.label}</span>
                {ev.required
                  ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" variant="outline">Obrigatório</Badge>
                  : <Badge variant="outline">Opcional</Badge>}
                <code className="text-[10px] text-muted-foreground">{ev.key}</code>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{ev.description}</p>
            </div>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

const statusColor = (s: number | null) => {
  if (s == null) return "bg-muted text-muted-foreground";
  if (s >= 200 && s < 300) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (s >= 400 && s < 500) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-destructive/15 text-destructive";
};

function WebhookLogsCard() {
  const listFn = useServerFn(adminListWebhookLogs);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["mp-webhook-logs", onlyErrors, page],
    queryFn: () => listFn({ data: { page, page_size: 25, only_errors: onlyErrors } }),
  });
  const rows = (data as any)?.rows ?? [];
  const total = (data as any)?.total ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Logs do webhook</CardTitle>
            <CardDescription>Cada entrega recebida do Mercado Pago com status, assinatura e payload.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={onlyErrors} onCheckedChange={v => { setOnlyErrors(!!v); setPage(1); }} />
              Somente com erro
            </label>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="grid place-items-center py-10 text-sm text-muted-foreground">Nenhuma entrega registrada ainda.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>MP ID</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const status = r.response_status ?? (r.error ? 500 : (r.processed ? 200 : 202));
                const mode = r.mode ?? (r.live_mode === true ? "live" : r.live_mode === false ? "test" : "—");
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.event_type}</div>
                      {r.action && <div className="text-muted-foreground">{r.action}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={mode === "live" ? "bg-primary/15 text-primary" : mode === "test" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : ""}>
                        {mode}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.mp_id ?? "—"}</TableCell>
                    <TableCell>
                      {r.signature_valid
                        ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" variant="outline">Válida</Badge>
                        : <Badge className="bg-destructive/15 text-destructive" variant="outline">{mode === "test" ? "N/A" : "Inválida"}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(status)} variant="outline">{status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate" title={r.reason ?? r.error ?? ""}>
                      {r.error
                        ? <span className="text-destructive">{r.reason ?? r.error}</span>
                        : <span className="text-muted-foreground">{r.reason ?? "—"}</span>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {r.retry_count > 0 ? `${r.retry_count}×` : "—"}
                      {r.next_retry_at && !r.processed && (
                        <div className="text-muted-foreground text-[10px]">→ {new Date(r.next_retry_at).toLocaleString("pt-BR")}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>Ver</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>

          </Table>
        )}
        {total > 25 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">Página {page} de {Math.ceil(total / 25)} ({total} entregas)</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Entrega do webhook</DialogTitle>
            <DialogDescription>{selected && new Date(selected.created_at).toLocaleString("pt-BR")} — {selected?.event_type}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>MP ID:</strong> <span className="font-mono">{selected.mp_id ?? "—"}</span></div>
                <div><strong>Ação:</strong> {selected.action ?? "—"}</div>
                <div><strong>Modo:</strong> {selected.mode ?? "—"} (live_mode={String(selected.live_mode)})</div>
                <div><strong>Assinatura válida:</strong> {String(selected.signature_valid)}</div>
                <div><strong>HTTP resposta:</strong> {selected.response_status ?? "—"}</div>
                <div><strong>Processado:</strong> {String(selected.processed)}</div>
                <div><strong>Retries:</strong> {selected.retry_count ?? 0}</div>
                <div><strong>Próximo retry:</strong> {selected.next_retry_at ? new Date(selected.next_retry_at).toLocaleString("pt-BR") : "—"}</div>
                <div className="col-span-2"><strong>Motivo:</strong> <span className="text-muted-foreground">{selected.reason ?? "—"}</span></div>
                <div className="col-span-2"><strong>Erro:</strong> <span className="text-destructive">{selected.error ?? "—"}</span></div>
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Headers</div>
                <ScrollArea className="h-24 rounded-lg border bg-muted/40 p-2">
                  <pre className="text-[10px] font-mono">{JSON.stringify(selected.headers ?? {}, null, 2)}</pre>
                </ScrollArea>
              </div>
              <div>
                <div className="text-xs font-medium mb-1">Payload</div>
                <ScrollArea className="h-64 rounded-lg border bg-muted/40 p-2">
                  <pre className="text-[10px] font-mono">{JSON.stringify(selected.payload ?? {}, null, 2)}</pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function WebhookHealthCard() {
  const healthFn = useServerFn(adminGetWebhookHealth);
  const retryFn = useServerFn(adminRetryWebhookQueue);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["mp-webhook-health"],
    queryFn: () => healthFn(),
    refetchInterval: 30_000,
  });
  const [retrying, setRetrying] = useState(false);

  async function runRetry() {
    setRetrying(true);
    try {
      const r: any = await retryFn();
      toast.success(`Reprocessamento: ${r.recovered}/${r.picked} recuperados, ${r.failed} falharam.`);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reprocessar");
    } finally { setRetrying(false); }
  }

  const h: any = data ?? {};
  const ready: boolean = !!h.ready;
  const pending: number = h.pending_retries ?? 0;

  const StatusPill = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
      <span className={ok ? "" : "text-destructive"}>{label}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Status do webhook</CardTitle>
            <CardDescription>Diagnóstico em tempo real do endpoint do Mercado Pago.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={runRetry} disabled={retrying || pending === 0}>
              {retrying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
              Reprocessar fila ({pending})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-lg border p-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configuração</div>
          <StatusPill ok={!!h.has_access_token} label="Access Token configurado" />
          <StatusPill ok={!!h.has_webhook_secret} label="Webhook Secret configurado (assinatura HMAC live)" />
          <StatusPill ok={!!h.https} label="URL pública HTTPS" />
          <div className="pt-2 border-t">
            <Badge variant="outline" className={ready ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}>
              {ready ? "Pronto para produção" : "Configuração incompleta"}
            </Badge>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Últimas entregas</div>
          <div>
            <div className="text-xs text-muted-foreground">Último teste (painel MP)</div>
            {h.last_test ? (
              <div className="text-sm">
                <Badge variant="outline" className={h.last_test.processed ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-destructive/15 text-destructive"}>
                  {h.last_test.processed ? "Aprovado" : "Falhou"}
                </Badge>
                <span className="ml-2 text-xs text-muted-foreground">{new Date(h.last_test.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ) : <div className="text-xs text-muted-foreground">Nenhum teste recebido ainda. Clique em "Testar" no painel do Mercado Pago.</div>}
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Último evento live</div>
            {h.last_live ? (
              <div className="text-sm">
                <Badge variant="outline" className={h.last_live.processed ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-destructive/15 text-destructive"}>
                  {h.last_live.event_type} — HTTP {h.last_live.response_status ?? "—"}
                </Badge>
                <span className="ml-2 text-xs text-muted-foreground">{new Date(h.last_live.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ) : <div className="text-xs text-muted-foreground">Nenhum evento de produção recebido ainda.</div>}
          </div>
          {h.last_failure && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">Última falha</div>
              <div className="text-xs text-destructive truncate" title={h.last_failure.error}>{h.last_failure.reason ?? h.last_failure.error}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(h.last_failure.created_at).toLocaleString("pt-BR")}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


function DualWebhookTestCard({ hasSecret }: { hasSecret: boolean }) {
  const dualFn = useServerFn(adminSendWebhookDualTest);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const r: any = await dualFn();
      setResult(r);
      const both = r.simulator.ok && r.live.ok;
      if (both) toast.success("Ambos os caminhos foram validados.");
      else if (r.simulator.ok) toast.warning("Simulador OK, mas evento assinado falhou.");
      else toast.error("Falha em um ou mais caminhos.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao executar teste dual");
    } finally { setLoading(false); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Teste dual do webhook</CardTitle>
          <CardDescription>
            Envia dois payloads controlados: <strong>simulador</strong> (sem HMAC) e <strong>evento live</strong> (com HMAC assinado com <code>MERCADOPAGO_WEBHOOK_SECRET</code>). Compara os dois caminhos lado a lado.
          </CardDescription>
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Executar teste
        </Button>
      </CardHeader>
      <CardContent>
        {!hasSecret && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100">
            <AlertCircle className="inline h-3.5 w-3.5 mr-1" />
            O caminho HMAC exige <code>MERCADOPAGO_WEBHOOK_SECRET</code> configurado. Sem ele, apenas o simulador é validável.
          </div>
        )}
        {!result && !loading && (
          <div className="text-sm text-muted-foreground">Clique em <em>Executar teste</em> para disparar os dois payloads.</div>
        )}
        {result && (
          <div className="grid gap-3 md:grid-cols-2">
            <ProbePane title="Simulador (sem HMAC)" data={result.simulator} />
            <ProbePane title="Evento live (com HMAC)" data={result.live} />
            <div className="md:col-span-2 rounded-lg border bg-muted/40 p-3 text-[11px] text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">Como o handler decide o caminho</div>
              <div>
                O webhook classifica cada requisição em <code>test</code> / <code>live</code> / <code>unknown</code> e só exige HMAC quando o modo é <code>live</code>. Regras aplicadas em ordem:
              </div>
              <ul className="ml-4 list-disc space-y-0.5">
                <li><code>explicit_type_test</code> — body contém <code>type: "test"</code>.</li>
                <li><code>explicit_action_test</code> — body contém <code>action: "test.created"</code>.</li>
                <li><code>sandbox_dummy_id</code> — <code>live_mode:false</code> com <code>data.id:"123456"</code>.</li>
                <li><code>panel_simulator_ua</code> — user-agent contém <code>restclient-node</code> (botão "Testar URL" do painel MP), mesmo com <code>live_mode:true</code>.</li>
                <li><code>live_mode_true</code> — <code>live_mode:true</code> sem nenhum sinal acima → evento REAL, HMAC obrigatória.</li>
              </ul>
            </div>
            <div className="md:col-span-2 text-[11px] text-muted-foreground">
              URL testada: <code className="font-mono">{result.url}</code> · Verificado em {new Date(result.checked_at).toLocaleString("pt-BR")}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProbePane({ title, data }: { title: string; data: any }) {
  const ok = !!data?.ok;
  const modeMatched = data?.expected_log_mode ? data?.log_mode === data?.expected_log_mode : null;
  const sigMatched = data?.expected_signature_valid !== undefined
    ? data?.signature_valid === data?.expected_signature_valid
    : null;
  return (
    <div className={`rounded-xl border p-3 ${ok ? "border-emerald-500/40 bg-emerald-500/10" : "border-destructive/40 bg-destructive/10"}`}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
        <div className="font-medium text-sm">{title}</div>
        <Badge variant="outline" className="ml-auto text-[10px]">{data?.path}</Badge>
      </div>

      {data?.path_explanation && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {data.path_explanation}
        </p>
      )}
      {data?.detection_rule && (
        <div className="mt-1 text-[11px]">
          <span className="opacity-60">Regra de detecção esperada:</span>{" "}
          <code className="font-mono text-[10px] rounded bg-muted px-1 py-0.5">{data.detection_rule}</code>
        </div>
      )}

      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] font-mono">
        <div><span className="opacity-60">HTTP</span> {data?.status ?? "—"}</div>
        <div><span className="opacity-60">Latência</span> {data?.latency_ms ?? "—"}ms</div>
        <div><span className="opacity-60">Log</span> {data?.log_matched ? "✓" : "✗"}</div>
        <div><span className="opacity-60">Processado</span> {data?.log_processed === true ? "✓" : data?.log_processed === false ? "✗" : "—"}</div>
        <div>
          <span className="opacity-60">Modo</span> {data?.log_mode ?? "—"}
          {data?.expected_log_mode && (
            <span className={`ml-1 ${modeMatched ? "text-emerald-600" : "text-destructive"}`}>
              {modeMatched ? "✓" : `≠ ${data.expected_log_mode}`}
            </span>
          )}
        </div>
        <div>
          <span className="opacity-60">Assinatura</span>{" "}
          {data?.signature_valid === true ? "válida" : data?.signature_valid === false ? "inválida" : "—"}
          {data?.expected_signature_valid !== undefined && (
            <span className={`ml-1 ${sigMatched ? "text-emerald-600" : "text-destructive"}`}>
              {sigMatched ? "✓" : `≠ esperado ${data.expected_signature_valid ? "válida" : "inválida"}`}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 text-xs">{data?.message}</div>
      {data?.body_snippet && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] opacity-70">Resposta bruta</summary>
          <pre className="mt-1 max-h-32 overflow-auto rounded bg-black/40 p-2 text-[10px] text-emerald-100">{data.body_snippet}</pre>
        </details>
      )}
    </div>
  );
}
