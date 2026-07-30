import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Plug as HeroIcon } from "lucide-react";
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
import {
  Plug, CheckCircle2, XCircle, Loader2, KeyRound, ExternalLink, Settings2,
  Copy, CopyCheck, RotateCcw, AlertTriangle, Clock, BookOpen, History, Webhook, Save,
  Sparkles, CreditCard, Zap, Target, ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { ProviderBrand, providerAccent } from "@/components/integrations/ProviderBrand";
import { SectionBanner } from "@/components/integrations/SectionBanner";
import { toast } from "sonner";
import {
  listIntegrationCatalog,
  listIntegrations,
  listWebhooks,
  listIntegrationHistory,
  upsertIntegration,
  toggleIntegration,
  testIntegration,
  saveIntegrationCredentials,
} from "@/lib/integrations/integrations.functions";

export const Route = createFileRoute("/_authenticated/hash/integracoes")({
  component: IntegrationsPage,
});

type CatalogMeta = Awaited<ReturnType<typeof listIntegrationCatalog>>[number];
type IntegrationRow = Awaited<ReturnType<typeof listIntegrations>>[number];
type WebhookRow = Awaited<ReturnType<typeof listWebhooks>>[number];

/* ---------------- helpers ---------------- */

async function copyToClipboard(text: string, label = "Copiado.") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Não foi possível copiar. Copie manualmente.");
  }
}

function StatusBadge({ status }: { status?: "ok" | "error" | null }) {
  if (status === "ok") return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Configurado</Badge>;
  if (status === "error") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Erro no último teste</Badge>;
  return <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" />Nunca testado</Badge>;
}

/* ---------------- page ---------------- */

function IntegrationsPage() {
  const catalogFn = useServerFn(listIntegrationCatalog);
  const listFn = useServerFn(listIntegrations);
  const webhooksFn = useServerFn(listWebhooks);

  const catalog = useQuery({ queryKey: ["integrations-catalog"], queryFn: () => catalogFn() });
  const saved = useQuery({ queryKey: ["integrations-saved"], queryFn: () => listFn() });
  const webhooks = useQuery({ queryKey: ["integrations-webhooks"], queryFn: () => webhooksFn() });

  const byKey = useMemo(() => {
    const map = new Map<string, IntegrationRow>();
    (saved.data ?? []).forEach((r: IntegrationRow) => map.set(`${r.category}:${r.provider}`, r));
    return map;
  }, [saved.data]);

  const grouped = useMemo(() => {
    const ai: CatalogMeta[] = [];
    const payments: CatalogMeta[] = [];
    const marketing: CatalogMeta[] = [];
    (catalog.data ?? []).forEach((m) => {
      if (m.category === "ai") ai.push(m);
      else if (m.category === "marketing") marketing.push(m);
      else payments.push(m);
    });
    return { ai, payments, marketing };
  }, [catalog.data]);

  const isLoading = catalog.isLoading || saved.isLoading;

  const aiConfigured = grouped.ai.filter((m) => byKey.get(`ai:${m.id}`)?.enabled).length;
  const payConfigured = grouped.payments.filter((m) => byKey.get(`payments:${m.id}`)?.enabled).length;
  const mktConfigured = grouped.marketing.filter((m) => byKey.get(`marketing:${m.id}`)?.enabled).length;
  const webhooksActive = (webhooks.data ?? []).length;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Integrações"}
        title={"Central de integrações"}
        subtitle={"Provedores de IA, pagamentos e webhooks — Strategy/Factory unificado."}
      />
      <SectionBanner
        title="Centro de Integrações"
        subtitle="Configure, teste e monitore todas as integrações (IA, Pagamentos e Webhooks) em um único painel. Credenciais editáveis e armazenadas apenas no backend."
        icon={Plug}
        gradient="from-indigo-600 via-violet-600 to-violet-600"
        accent="#a855f7"
        stats={[
          { label: "IA ativas", value: aiConfigured },
          { label: "Pagamentos", value: payConfigured },
          { label: "Marketing", value: mktConfigured },
          { label: "Webhooks", value: webhooksActive },
        ]}
      />

      <Tabs defaultValue="providers" className="w-full">
        <TabsList>
          <TabsTrigger value="providers"><Zap className="h-4 w-4 mr-1" />Provedores</TabsTrigger>
          <TabsTrigger value="marketing"><Target className="h-4 w-4 mr-1" />Marketing &amp; Pixel</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1" />Webhooks</TabsTrigger>
          <TabsTrigger value="captcha"><ShieldCheck className="h-4 w-4 mr-1" />Captcha</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="mt-6 space-y-10">
          <section className="space-y-5">
            <SectionBanner
              title="Inteligência Artificial"
              subtitle="Conecte modelos de linguagem para automações, respostas inteligentes e geração de conteúdo em todo o sistema."
              icon={Sparkles}
              gradient="from-emerald-500 via-teal-500 to-violet-600"
              accent="#14b8a6"
              stats={[{ label: "Provedores", value: grouped.ai.length }, { label: "Ativos", value: aiConfigured }]}
            />
            {isLoading ? <SkeletonGrid /> : <Grid metas={grouped.ai} byKey={byKey} onChanged={() => saved.refetch()} />}
          </section>
          <section className="space-y-5">
            <SectionBanner
              title="Pagamentos"
              subtitle="Gateways para assinaturas, checkout transparente, PIX, cartão e boleto. Configure credenciais e webhooks com segurança."
              icon={CreditCard}
              gradient="from-amber-500 via-orange-500 to-rose-600"
              accent="#f97316"
              stats={[{ label: "Gateways", value: grouped.payments.length }, { label: "Ativos", value: payConfigured }]}
            />
            {isLoading ? <SkeletonGrid /> : <Grid metas={grouped.payments} byKey={byKey} onChanged={() => saved.refetch()} />}
          </section>
        </TabsContent>

        <TabsContent value="marketing" className="mt-6 space-y-5">
          <SectionBanner
            title="Marketing &amp; Rastreamento"
            subtitle="Conecte o Pixel do Meta e a Conversions API para medir conversões do site público, montar públicos e otimizar campanhas no Facebook e Instagram."
            icon={Target}
            gradient="from-sky-500 via-blue-600 to-indigo-700"
            accent="#0866ff"
            stats={[{ label: "Canais", value: grouped.marketing.length }, { label: "Ativos", value: mktConfigured }]}
          />
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 flex gap-3 text-sm">
              <KeyRound className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="font-medium">As credenciais são inseridas apenas aqui, manualmente.</p>
                <p className="text-muted-foreground">
                  O token da Conversions API é gravado somente no backend e nunca retorna ao navegador — a tela mostra apenas os
                  últimos dígitos. O Pixel ID é público por natureza e é validado (somente dígitos) antes de ir para o site.
                  O Pixel nunca é carregado em páginas autenticadas.
                </p>
              </div>
            </CardContent>
          </Card>
          {isLoading ? <SkeletonGrid /> : <Grid metas={grouped.marketing} byKey={byKey} onChanged={() => saved.refetch()} />}
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <WebhooksPanel data={webhooks.data ?? []} loading={webhooks.isLoading} />
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

/* ---------------- providers grid ---------------- */

function Grid({ metas, byKey, onChanged }: { metas: CatalogMeta[]; byKey: Map<string, IntegrationRow>; onChanged: () => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metas.map((meta, idx) => (
        <motion.div
          key={`${meta.category}:${meta.id}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.05, duration: 0.35, ease: "easeOut" }}
        >
          <ProviderCard meta={meta} row={byKey.get(`${meta.category}:${meta.id}`)} onChanged={onChanged} />
        </motion.div>
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
  const credsMasked = ((row as any)?.credentials_masked ?? {}) as Record<string, { set: boolean; masked: string | null }>;

  // Um secret é considerado "atendido" se: existe env OU credencial gravada no DB.
  const requiredSecrets = meta.fields.filter((f) => f.kind === "secret" && f.required);
  const missingRequired = requiredSecrets.filter((f) => !secretStatus[f.name] && !credsMasked[f.name]?.set);
  const hasAnyValue = meta.fields.some((f) => f.kind === "secret" && (secretStatus[f.name] || credsMasked[f.name]?.set));
  const configState: "ok" | "partial" | "empty" =
    missingRequired.length === 0 && hasAnyValue ? "ok" : hasAnyValue ? "partial" : "empty";

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

  const accent = providerAccent(meta.id);
  return (
    <Card
      className="group relative flex flex-col overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
      style={{ ["--accent" as any]: accent }}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] opacity-80"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-40"
        style={{ background: accent }}
      />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ProviderBrand providerId={meta.id} />
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
          {configState === "ok" && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Configurado</Badge>}
          {configState === "partial" && <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><AlertTriangle className="h-3 w-3" />Configuração incompleta</Badge>}
          {configState === "empty" && <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />Não configurado</Badge>}
          <StatusBadge status={status} />
          {row?.mode && <Badge variant="outline" className="capitalize">{row.mode}</Badge>}
        </div>
        {row?.last_tested_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Último teste: {new Date(row.last_tested_at).toLocaleString("pt-BR")}
          </p>
        )}
        {row?.last_test_message && (
          <p className="text-xs text-muted-foreground line-clamp-2" title={row.last_test_message}>{row.last_test_message}</p>
        )}
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setOpenConfig(true)}><Settings2 className="h-4 w-4 mr-1" />Gerenciar</Button>
          <Button size="sm" onClick={runTest} disabled={testing}>{testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}</Button>
          {meta.docsUrl && (
            <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Docs oficiais <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>

      <ManageDialog open={openConfig} onOpenChange={setOpenConfig} meta={meta} row={row} onSaved={onChanged} credsMasked={credsMasked} secretStatus={secretStatus} />
    </Card>
  );
}

/* ---------------- manage dialog with tabs ---------------- */

function ManageDialog({
  open, onOpenChange, meta, row, onSaved, credsMasked, secretStatus,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; meta: CatalogMeta;
  row?: IntegrationRow; onSaved: () => void;
  credsMasked: Record<string, { set: boolean; masked: string | null }>;
  secretStatus: Record<string, boolean>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3"><ProviderBrand providerId={meta.id} size="sm" animate={false} />{meta.label}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="config" className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="config">Configuração</TabsTrigger>
            <TabsTrigger value="credentials"><KeyRound className="h-3 w-3 mr-1" />Credenciais</TabsTrigger>
            <TabsTrigger value="guide"><BookOpen className="h-3 w-3 mr-1" />Como configurar</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3 w-3 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4">
            <ConfigTab meta={meta} row={row} onSaved={onSaved} />
          </TabsContent>
          <TabsContent value="credentials" className="mt-4">
            <CredentialsTab meta={meta} onSaved={onSaved} credsMasked={credsMasked} secretStatus={secretStatus} />
          </TabsContent>
          <TabsContent value="guide" className="mt-4">
            <GuideTab meta={meta} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryTab row={row} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ConfigTab({ meta, row, onSaved }: { meta: CatalogMeta; row?: IntegrationRow; onSaved: () => void }) {
  const upsertFn = useServerFn(upsertIntegration);
  const qc = useQueryClient();
  const initialConfig = (row?.config ?? {}) as Record<string, unknown>;
  const [mode, setMode] = useState<"sandbox" | "production">((row?.mode as any) ?? "production");
  const [config, setConfig] = useState<Record<string, unknown>>({ ...initialConfig });
  const [saving, setSaving] = useState(false);

  const nonSecretFields = meta.fields.filter((f) => f.kind !== "secret" && f.kind !== "password");
  const dirty = JSON.stringify(config) !== JSON.stringify(initialConfig) || (row?.mode ?? "production") !== mode;

  async function save() {
    setSaving(true);
    try {
      await upsertFn({ data: { category: meta.category, provider: meta.id, mode: meta.supportsMode ? mode : null, config } });
      toast.success("Configuração salva.");
      qc.invalidateQueries({ queryKey: ["integrations-saved"] });
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  function reset() {
    setConfig({ ...initialConfig });
    setMode((row?.mode as any) ?? "production");
  }

  return (
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

      {nonSecretFields.length === 0 && (
        <p className="text-sm text-muted-foreground">Este provedor não possui parâmetros adicionais além das credenciais.</p>
      )}

      {nonSecretFields.map((f) => {
        const value = (config[f.name] ?? f.defaultValue ?? "") as string | number;
        return (
          <div key={f.name} className="space-y-1">
            <Label className="text-sm">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
            <Input
              type={f.kind === "number" ? "number" : "text"}
              placeholder={f.placeholder}
              value={value as any}
              onChange={(e) => setConfig((c) => ({ ...c, [f.name]: f.kind === "number" ? Number(e.target.value) : e.target.value }))}
            />
            {f.helpText && <p className="text-xs text-muted-foreground">{f.helpText}</p>}
          </div>
        );
      })}

      <DialogFooter className="pt-2">
        <Button variant="ghost" onClick={reset} disabled={!dirty}><RotateCcw className="h-4 w-4 mr-1" />Restaurar</Button>
        <Button onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" />Salvar alterações</>)}</Button>
      </DialogFooter>
    </div>
  );
}

function CredentialsTab({
  meta, onSaved, credsMasked, secretStatus,
}: {
  meta: CatalogMeta; onSaved: () => void;
  credsMasked: Record<string, { set: boolean; masked: string | null }>;
  secretStatus: Record<string, boolean>;
}) {
  const saveFn = useServerFn(saveIntegrationCredentials);
  const qc = useQueryClient();
  const secretFields = meta.fields.filter((f) => f.kind === "secret" || f.kind === "password");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const dirty = Object.values(drafts).some((v) => v !== "");

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(drafts)) if (v !== "") payload[k] = v;
      if (Object.keys(payload).length === 0) { toast.info("Nada a salvar."); setSaving(false); return; }
      await saveFn({ data: { category: meta.category, provider: meta.id, credentials: payload } });
      toast.success("Credenciais atualizadas.");
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["integrations-saved"] });
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar credenciais"); }
    finally { setSaving(false); }
  }

  async function clearOne(field: string) {
    if (!confirm(`Remover o valor salvo para "${field}"?`)) return;
    setSaving(true);
    try {
      await saveFn({ data: { category: meta.category, provider: meta.id, credentials: { [field]: null } } });
      toast.success("Valor removido.");
      qc.invalidateQueries({ queryKey: ["integrations-saved"] });
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao remover"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Todos os valores são armazenados apenas no backend. A UI mostra somente uma máscara do valor gravado.
        Deixe o campo em branco para manter o valor atual — preencha para sobrescrever.
      </p>
      {secretFields.map((f) => {
        const masked = credsMasked[f.name];
        const envSet = secretStatus[f.name];
        return (
          <div key={f.name} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <div className="flex items-center gap-1">
                {masked?.set
                  ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Salvo {masked.masked}</Badge>
                  : envSet
                    ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" />Env {f.secretName}</Badge>
                    : <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700"><KeyRound className="h-3 w-3" />Vazio</Badge>}
              </div>
            </div>
            <Input
              type="password"
              autoComplete="off"
              placeholder={masked?.set ? "•••• (manter atual)" : (f.placeholder ?? f.secretName ?? f.label)}
              value={drafts[f.name] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [f.name]: e.target.value }))}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {f.helpText ?? (f.secretName ? `Alternativa: definir como secret ${f.secretName}.` : "")}
              </p>
              {masked?.set && (
                <Button variant="ghost" size="sm" onClick={() => clearOne(f.name)} disabled={saving}>Remover valor salvo</Button>
              )}
            </div>
          </div>
        );
      })}

      <DialogFooter>
        <Button variant="ghost" onClick={() => setDrafts({})} disabled={!dirty}><RotateCcw className="h-4 w-4 mr-1" />Cancelar</Button>
        <Button onClick={save} disabled={!dirty || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="h-4 w-4 mr-1" />Salvar credenciais</>)}</Button>
      </DialogFooter>
    </div>
  );
}

function GuideTab({ meta }: { meta: CatalogMeta }) {
  const guide = (meta as any).guide as null | {
    intro: string; prerequisites?: string[];
    steps: { title: string; description: string; url?: string }[];
    troubleshooting?: { symptom: string; fix: string }[];
  };
  if (!guide) return <p className="text-sm text-muted-foreground">Guia em breve.</p>;
  return (
    <div className="space-y-4 text-sm">
      <p>{guide.intro}</p>
      {guide.prerequisites && guide.prerequisites.length > 0 && (
        <div>
          <h4 className="font-semibold mb-1">Pré-requisitos</h4>
          <ul className="list-disc pl-5 text-muted-foreground">{guide.prerequisites.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      <ol className="space-y-3">
        {guide.steps.map((s, i) => (
          <li key={i} className="rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-semibold grid place-items-center">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-medium">{s.title}</p>
                <p className="text-muted-foreground">{s.description}</p>
                {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mt-1">Abrir <ExternalLink className="h-3 w-3" /></a>}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {guide.troubleshooting && guide.troubleshooting.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-amber-600" />Problemas comuns</h4>
          <ul className="space-y-2">
            {guide.troubleshooting.map((t, i) => (
              <li key={i} className="rounded-md bg-muted/40 p-2 text-xs">
                <p className="font-medium">{t.symptom}</p>
                <p className="text-muted-foreground">{t.fix}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HistoryTab({ row }: { row?: IntegrationRow }) {
  const historyFn = useServerFn(listIntegrationHistory);
  const q = useQuery({
    queryKey: ["integration-history", row?.id ?? "-"],
    queryFn: () => historyFn({ data: { integration_id: row!.id } }),
    enabled: !!row?.id,
  });

  const details = (row as any)?.last_test_details as null | { status: number | null; latency_ms: number | null; message: string; environment: string | null; started_at: string; finished_at: string; extra: any };

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border p-3">
        <h4 className="font-semibold mb-2">Último teste</h4>
        {row?.last_tested_at ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Data:</span> {new Date(row.last_tested_at).toLocaleString("pt-BR")}</div>
            <div><span className="text-muted-foreground">Status:</span> {row.last_test_status ?? "—"}</div>
            <div><span className="text-muted-foreground">HTTP:</span> {details?.status ?? "—"}</div>
            <div><span className="text-muted-foreground">Latência:</span> {details?.latency_ms != null ? `${details.latency_ms} ms` : "—"}</div>
            <div><span className="text-muted-foreground">Ambiente:</span> {details?.environment ?? "—"}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Mensagem:</span> <span className="break-words">{row.last_test_message}</span></div>
          </div>
        ) : <p className="text-xs text-muted-foreground">Nenhum teste executado.</p>}
      </div>

      <div>
        <h4 className="font-semibold mb-2">Alterações (auditoria)</h4>
        {q.isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> :
          (q.data ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Sem eventos.</p> :
            <ul className="space-y-1 text-xs max-h-64 overflow-y-auto">
              {(q.data ?? []).map((ev: any) => (
                <li key={ev.id} className="flex items-start gap-2 border-b py-1">
                  <span className="text-muted-foreground shrink-0">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                  <span className="font-mono">{ev.action}</span>
                  {ev.metadata && <span className="text-muted-foreground truncate">{JSON.stringify(ev.metadata)}</span>}
                </li>
              ))}
            </ul>}
      </div>
    </div>
  );
}

/* ---------------- webhooks panel ---------------- */

function WebhooksPanel({ data, loading }: { data: WebhookRow[]; loading: boolean }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const g: Record<string, WebhookRow[]> = {};
    data.forEach((w) => { (g[w.provider] ||= []).push(w); });
    return g;
  }, [data]);

  async function copyOne(w: WebhookRow) {
    await copyToClipboard(w.url, "Webhook copiado.");
    setCopiedId(w.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  async function copyAll() {
    const text = data.map((w) => `${w.label}\n${w.methods.join(", ")} ${w.url}`).join("\n\n");
    await copyToClipboard(text, `${data.length} webhooks copiados.`);
  }

  if (loading) return <Card><CardContent className="p-6 animate-pulse h-40 bg-muted/30" /></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Endpoints públicos do sistema. Cole essas URLs nos painéis dos provedores.</p>
        <Button variant="outline" size="sm" onClick={copyAll}><Copy className="h-4 w-4 mr-1" />Copiar todos</Button>
      </div>

      {Object.entries(grouped).map(([provider, items]) => (
        <Card key={provider}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base capitalize flex items-center gap-2">
              <Webhook className="h-4 w-4" /> {provider}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((w) => (
              <div key={w.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{w.label}</p>
                    <p className="text-xs text-muted-foreground">{w.description}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {w.methods.map((m) => <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs bg-muted/50 rounded px-2 py-1" title={w.url}>{w.url}</code>
                  <Button size="sm" variant="outline" onClick={() => copyOne(w)}>
                    {copiedId === w.id ? <CopyCheck className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {w.configurable_in && (
                  <p className="text-xs text-muted-foreground">Configuração avançada: <a href={w.configurable_in} className="text-primary underline">{w.configurable_in}</a></p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
