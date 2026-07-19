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
import { Copy, Loader2, CheckCircle2, XCircle, AlertCircle, ExternalLink, RefreshCw, ShieldCheck, Radio } from "lucide-react";
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

        </CardContent>
      </Card>

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
