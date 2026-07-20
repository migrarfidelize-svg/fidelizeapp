import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plug, CheckCircle2, XCircle, Loader2, KeyRound, ExternalLink, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  listIntegrationCatalog,
  listIntegrations,
  upsertIntegration,
  toggleIntegration,
  testIntegration,
} from "@/lib/integrations/integrations.functions";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  component: IntegrationsPage,
});

type CatalogMeta = Awaited<ReturnType<typeof listIntegrationCatalog>>[number];
type IntegrationRow = Awaited<ReturnType<typeof listIntegrations>>[number];

function IntegrationsPage() {
  const catalogFn = useServerFn(listIntegrationCatalog);
  const listFn = useServerFn(listIntegrations);

  const catalog = useQuery({ queryKey: ["integrations-catalog"], queryFn: () => catalogFn() });
  const saved = useQuery({ queryKey: ["integrations-saved"], queryFn: () => listFn() });

  const byKey = useMemo(() => {
    const map = new Map<string, IntegrationRow>();
    (saved.data ?? []).forEach((r: IntegrationRow) => map.set(`${r.category}:${r.provider}`, r));
    return map;
  }, [saved.data]);

  const grouped = useMemo(() => {
    const ai: CatalogMeta[] = [];
    const payments: CatalogMeta[] = [];
    (catalog.data ?? []).forEach((m) => (m.category === "ai" ? ai.push(m) : payments.push(m)));
    return { ai, payments };
  }, [catalog.data]);

  const isLoading = catalog.isLoading || saved.isLoading;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Plug className="h-5 w-5" /></span>
            Integrações
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Central única para provedores de IA e Pagamentos. Ative, configure e teste conexões
            reais com cada serviço. Credenciais permanecem armazenadas com segurança no backend.
          </p>
        </div>
      </div>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList>
          <TabsTrigger value="ai">Inteligência Artificial</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-6">
          {isLoading ? <SkeletonGrid /> : <Grid metas={grouped.ai} byKey={byKey} onChanged={() => saved.refetch()} />}
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          {isLoading ? <SkeletonGrid /> : <Grid metas={grouped.payments} byKey={byKey} onChanged={() => saved.refetch()} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}><CardContent className="p-6 animate-pulse h-40 bg-muted/30" /></Card>
      ))}
    </div>
  );
}

function Grid({ metas, byKey, onChanged }: { metas: CatalogMeta[]; byKey: Map<string, IntegrationRow>; onChanged: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metas.map((meta) => (
        <ProviderCard key={`${meta.category}:${meta.id}`} meta={meta} row={byKey.get(`${meta.category}:${meta.id}`)} onChanged={onChanged} />
      ))}
    </div>
  );
}

function ProviderCard({ meta, row, onChanged }: { meta: CatalogMeta; row?: IntegrationRow; onChanged: () => void }) {
  const qc = useQueryClient();
  const toggleFn = useServerFn(toggleIntegration);
  const testFn = useServerFn(testIntegration);
  const [openConfig, setOpenConfig] = useState(false);
  const [testing, setTesting] = useState(false);

  const enabled = row?.enabled ?? false;
  const status = row?.last_test_status as "ok" | "error" | null | undefined;
  const secretStatus = ((row as any)?.secret_status ?? {}) as Record<string, boolean>;

  const missingSecrets = meta.fields
    .filter((f) => f.kind === "secret" && f.required && !secretStatus[f.name])
    .map((f) => f.secretName ?? f.name);

  const toggle = useMutation({
    mutationFn: (next: boolean) => toggleFn({ data: { category: meta.category, provider: meta.id, enabled: next } }) as Promise<unknown>,
    onSuccess: () => { toast.success(enabled ? "Integração desativada." : "Integração ativada."); onChanged(); qc.invalidateQueries({ queryKey: ["integrations-saved"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao alterar."),
  });

  async function runTest() {
    setTesting(true);
    try {
      const result = await testFn({ data: { category: meta.category, provider: meta.id } });
      if (result.ok) toast.success(`OK · ${result.latency_ms ?? "?"}ms · ${result.message}`);
      else toast.error(`Falhou · ${result.status ?? "?"} · ${result.message}`);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Erro no teste"); }
    finally { setTesting(false); }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center text-xl">{meta.icon ?? "🔌"}</div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{meta.label}</CardTitle>
              <p className="text-xs text-muted-foreground line-clamp-2">{meta.description}</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {status === "ok" && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Conectado</Badge>}
          {status === "error" && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro</Badge>}
          {!status && <Badge variant="outline">Nunca testado</Badge>}
          {row?.mode && <Badge variant="outline" className="capitalize">{row.mode}</Badge>}
          {missingSecrets.length > 0 && <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><KeyRound className="h-3 w-3" />{missingSecrets.length} secret(s) pendente(s)</Badge>}
        </div>
        {row?.last_test_message && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={row.last_test_message}>{row.last_test_message}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpenConfig(true)}><Settings2 className="h-4 w-4 mr-1" />Configurar</Button>
          <Button size="sm" onClick={runTest} disabled={testing}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar conexão"}</Button>
          {meta.docsUrl && (
            <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Docs <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>

      <ConfigDialog open={openConfig} onOpenChange={setOpenConfig} meta={meta} row={row} onSaved={onChanged} secretStatus={secretStatus} />
    </Card>
  );
}

function ConfigDialog({
  open, onOpenChange, meta, row, onSaved, secretStatus,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; meta: CatalogMeta;
  row?: IntegrationRow; onSaved: () => void; secretStatus: Record<string, boolean>;
}) {
  const upsertFn = useServerFn(upsertIntegration);
  const qc = useQueryClient();
  const initialConfig = (row?.config ?? {}) as Record<string, unknown>;
  const [mode, setMode] = useState<"sandbox" | "production">((row?.mode as any) ?? "production");
  const [config, setConfig] = useState<Record<string, unknown>>({ ...initialConfig });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await upsertFn({ data: { category: meta.category, provider: meta.id, mode: meta.supportsMode ? mode : null, config } });
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["integrations-saved"] });
      onSaved();
      onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><span className="text-xl">{meta.icon ?? "🔌"}</span>{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {meta.supportsMode && (
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox / Teste</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {meta.fields.map((f) => {
            if (f.kind === "secret") {
              const present = secretStatus[f.name];
              return (
                <div key={f.name} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">{f.label}</Label>
                    {present
                      ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Configurado</Badge>
                      : <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><KeyRound className="h-3 w-3" />Pendente</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Salve o valor como secret <code className="font-mono">{f.secretName}</code>.
                    {f.helpText ? ` ${f.helpText}` : ""}
                  </p>
                </div>
              );
            }
            const value = (config[f.name] ?? f.defaultValue ?? "") as string | number;
            return (
              <div key={f.name} className="space-y-1">
                <Label className="text-sm">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                <Input
                  type={f.kind === "number" ? "number" : f.kind === "password" ? "password" : "text"}
                  placeholder={f.placeholder}
                  value={value as any}
                  onChange={(e) => setConfig((c) => ({ ...c, [f.name]: f.kind === "number" ? Number(e.target.value) : e.target.value }))}
                />
                {f.helpText && <p className="text-xs text-muted-foreground">{f.helpText}</p>}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
