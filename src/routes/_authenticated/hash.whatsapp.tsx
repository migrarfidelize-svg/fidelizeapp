import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/states/EmptyState";
import { MessageSquare, Loader2, ShieldCheck, Save, Zap, Ban, CheckCircle2 } from "lucide-react";
import {
  getWhatsAppProviderConfig, saveWhatsAppProviderConfig, testWhatsAppProvider,
  listWhatsAppConnectionsAdmin, setWhatsAppConnectionSuspended,
} from "@/lib/whatsapp-admin.functions";

export const Route = createFileRoute("/_authenticated/hash/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp & Atendimento — Super Admin" },
      { name: "description", content: "Configuração global do provedor de WhatsApp e monitoramento das conexões dos lojistas." },
    ],
  }),
  component: AdminWhatsAppPage,
});

function AdminWhatsAppPage() {
  const qc = useQueryClient();
  const cfgFn = useServerFn(getWhatsAppProviderConfig);
  const saveFn = useServerFn(saveWhatsAppProviderConfig);
  const testFn = useServerFn(testWhatsAppProvider);
  const connsFn = useServerFn(listWhatsAppConnectionsAdmin);
  const suspFn = useServerFn(setWhatsAppConnectionSuspended);

  const cfg = useQuery({ queryKey: ["wa-provider-config"], queryFn: () => cfgFn() });
  const conns = useQuery({ queryKey: ["wa-connections-admin"], queryFn: () => connsFn() });

  const [form, setForm] = useState({
    provider: "uazapi",
    display_name: "Uazapi",
    base_url: "https://free.uazapi.com",
    mode: "production" as "sandbox" | "production",
    is_enabled: false,
    api_token: "",
  });

  useEffect(() => {
    const row = (cfg.data as any)?.providers?.find((p: any) => p.provider === "uazapi");
    if (row) {
      setForm((f) => ({
        ...f,
        display_name: row.display_name ?? f.display_name,
        base_url: row.base_url ?? f.base_url,
        mode: row.mode ?? f.mode,
        is_enabled: !!row.is_enabled,
      }));
    }
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { ...form, api_token: form.api_token || undefined } }),
    onSuccess: () => { setForm((f) => ({ ...f, api_token: "" })); qc.invalidateQueries({ queryKey: ["wa-provider-config"] }); toast.success("Configuração salva."); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { provider: form.provider } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["wa-provider-config"] });
      r.ok ? toast.success(r.message) : toast.error(r.message);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha no teste."),
  });

  const suspend = useMutation({
    mutationFn: (v: { id: string; suspended: boolean }) => suspFn({ data: { connection_id: v.id, suspended: v.suspended } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-connections-admin"] }),
  });

  const data = cfg.data as any;
  const row = data?.providers?.find((p: any) => p.provider === "uazapi");
  const rows = (conns.data ?? []) as any[];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHero
        icon={MessageSquare}
        eyebrow="Super Admin · Atendimento"
        title="WhatsApp & Central de Atendimento"
        subtitle="Credenciais globais do provedor, teste de conexão e supervisão das instâncias dos lojistas."
      />

      {!data?.cryptoConfigured && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-4 text-sm">
            O secret <strong>WHATSAPP_CRYPTO_KEY</strong> não está disponível neste ambiente — tokens não poderão ser gravados com segurança.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Provedor Uazapi</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Integração ativa</p>
                <p className="text-xs text-muted-foreground">Quando desligada, lojistas não conseguem parear novos números.</p>
              </div>
              <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, is_enabled: v }))} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-name">Nome de exibição</Label>
              <Input id="wa-name" value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-url">URL base da API</Label>
              <Input id="wa-url" value={form.base_url} onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://free.uazapi.com" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-token">Token administrativo</Label>
              <Input
                id="wa-token" type="password" autoComplete="off"
                value={form.api_token}
                onChange={(e) => setForm((f) => ({ ...f, api_token: e.target.value }))}
                placeholder={row?.api_token_masked ? `Salvo (${row.api_token_masked}) — preencha para trocar` : "admintoken da sua conta Uazapi"}
              />
              <p className="text-xs text-muted-foreground">Armazenado criptografado (AES-GCM). Nunca é devolvido em texto puro.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Modo</Label>
              <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox / testes</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar
              </Button>
              <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
                {test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}Testar conexão
              </Button>
            </div>

            {row?.last_test_status ? (
              <p className={`text-xs ${row.last_test_status === "ok" ? "text-emerald-600" : "text-destructive"}`}>
                Último teste: {row.last_test_message}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Webhook</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Cada lojista recebe uma URL exclusiva com token opaco, configurada automaticamente no provedor ao parear:
            </p>
            <code className="block break-all rounded-md bg-muted p-3 text-xs">
              {data?.webhookBaseUrl ?? "…"}/&lt;token-da-conexão&gt;
            </code>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Eventos duplicados são descartados por chave de idempotência e cada mensagem é gravada no tenant correto.
            </p>
            <p className="text-xs text-muted-foreground">Conexões ativas na plataforma: <strong>{data?.connectionsCount ?? 0}</strong></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Conexões dos lojistas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {conns.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={MessageSquare} title="Nenhuma conexão" description="Nenhum estabelecimento conectou o WhatsApp ainda." />
          ) : rows.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.establishments?.name ?? c.establishment_id}</p>
                <p className="text-xs text-muted-foreground">
                  {c.connected_phone || "sem número"} · {c.connection_status}
                  {c.last_error ? ` · ${String(c.last_error).slice(0, 80)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.connection_status === "connected" ? "default" : "outline"}>
                  {c.connection_status === "connected" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}{c.connection_status}
                </Badge>
                <Button
                  size="sm"
                  variant={c.suspended ? "outline" : "ghost"}
                  onClick={() => suspend.mutate({ id: c.id, suspended: !c.suspended })}
                >
                  <Ban className="mr-1 h-3.5 w-3.5" />{c.suspended ? "Reativar" : "Suspender"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
