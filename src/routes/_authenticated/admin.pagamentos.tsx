import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Copy, Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw, ShieldCheck, Radio, Activity, RotateCw } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin/pagamentos")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  const getFn = useServerFn(adminGetPaymentSettings);
  const saveFn = useServerFn(adminUpdatePaymentSettings);
  const testFn = useServerFn(adminTestMercadoPagoConnection);

  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin-payment-settings"], queryFn: () => getFn() });

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
  const settings = (data as any)?.settings ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Mercado Pago</h1>
        <p className="text-sm text-muted-foreground">Integração de pagamentos para as assinaturas da plataforma.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciais (segredos do backend)</CardTitle>
          <CardDescription>Access Token e Webhook Secret nunca aparecem em tela. Configure-os como secrets do projeto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SecretRow name="MERCADOPAGO_ACCESS_TOKEN" label="Access Token" ok={creds.has_access_token} hint="Painel Mercado Pago → Suas integrações → Credenciais de produção" />
          <SecretRow name="MERCADOPAGO_PUBLIC_KEY" label="Public Key (backend cache)" ok={creds.has_public_key} hint="Mesma tela — pode ser gravada também como secret; é referenciada no navegador para tokenizar cartão." />
          <SecretRow name="MERCADOPAGO_WEBHOOK_SECRET" label="Webhook Secret" ok={creds.has_webhook_secret} hint="Painel Mercado Pago → Webhooks → chave secreta gerada ao configurar a URL." />
          <p className="text-xs text-muted-foreground">Para adicionar/atualizar, peça ao Lovable: <em>“atualize o secret MERCADOPAGO_ACCESS_TOKEN”</em>. Os valores são gravados criptografados e injetados como variáveis de ambiente no backend.</p>
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
                <TableHead>MP ID</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Processado</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="text-right">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r: any) => {
                const status = r.error ? 500 : (r.processed ? 200 : 202);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-medium">{r.event_type}</div>
                      {r.action && <div className="text-muted-foreground">{r.action}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.mp_id ?? "—"}</TableCell>
                    <TableCell>
                      {r.signature_valid
                        ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" variant="outline">Válida</Badge>
                        : <Badge className="bg-destructive/15 text-destructive" variant="outline">Inválida</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(status)} variant="outline">{status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">{r.error ?? "—"}</TableCell>
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
                <div><strong>Live mode:</strong> {String(selected.live_mode)}</div>
                <div><strong>Assinatura válida:</strong> {String(selected.signature_valid)}</div>
                <div><strong>Processado:</strong> {String(selected.processed)}</div>
                <div><strong>Erro:</strong> {selected.error ?? "—"}</div>
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
