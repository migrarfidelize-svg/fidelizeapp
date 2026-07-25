import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { MessageSquareWarning as HeroIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Star, Search, Eye, EyeOff, Trash2, ShieldAlert, TrendingDown, TrendingUp, MessageSquare, Lock, Download, X } from "lucide-react";
import { downloadCSV } from "@/lib/export";
import {
  adminReviewsOverview,
  adminReviewsRanking,
  adminReviewsList,
  adminReviewsFraudSignals,
  adminSetReviewHidden,
  adminDeleteReview,
  adminListEstablishmentsMini,
} from "@/lib/admin-reviews.functions";
import { adminListFeatureGateEvents, adminFeatureGateSummary } from "@/lib/feature-gate.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/avaliacoes")({
  component: Page,
});

function Stars({ n, size = 4 }: { n: number; size?: number }) {
  const px = size * 4;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: px, height: px }}
          className={i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

function Page() {
  const [days, setDays] = useState(30);

  const overviewFn = useServerFn(adminReviewsOverview);
  const rankingFn = useServerFn(adminReviewsRanking);
  const fraudFn = useServerFn(adminReviewsFraudSignals);

  const overview = useQuery({ queryKey: ["adm-rev-overview", days], queryFn: () => overviewFn({ data: { days } }) });
  const worst = useQuery({ queryKey: ["adm-rev-rank-worst", days], queryFn: () => rankingFn({ data: { days, order: "worst", limit: 10 } }) });
  const best = useQuery({ queryKey: ["adm-rev-rank-best", days], queryFn: () => rankingFn({ data: { days, order: "best", limit: 10 } }) });
  const volume = useQuery({ queryKey: ["adm-rev-rank-vol", days], queryFn: () => rankingFn({ data: { days, order: "volume", limit: 10 } }) });
  const fraud = useQuery({ queryKey: ["adm-rev-fraud", days], queryFn: () => fraudFn({ data: { days: Math.min(days, 14) } }) });

  const o = overview.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Avaliações da Plataforma</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada, moderação central e sinais de fraude.</p>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi title="Total" value={o?.total ?? 0} icon={<MessageSquare className="h-4 w-4" />} />
        <Kpi title="Nota média" value={o ? o.avg.toFixed(2) : "—"} icon={<Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />} />
        <Kpi title="Baixas pendentes" value={o?.lowPending ?? 0} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} accent="destructive" />
        <Kpi title="Ocultas" value={o?.hidden ?? 0} icon={<EyeOff className="h-4 w-4" />} />
        <Kpi title="Sinais de fraude" value={(fraud.data?.device.length ?? 0) + (fraud.data?.ip.length ?? 0) + (fraud.data?.bursts.length ?? 0)} icon={<ShieldAlert className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full flex-wrap h-auto">
          <TabsTrigger value="overview">Panorama</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="moderation">Moderação</TabsTrigger>
          <TabsTrigger value="fraud">Fraude</TabsTrigger>
          <TabsTrigger value="blocked"><Lock className="mr-1 h-3 w-3" />Bloqueios de plano</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Distribuição de notas</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(o?.dist ?? []).slice().reverse().map((d) => {
                  const pct = o && o.total ? Math.round((d.count / o.total) * 100) : 0;
                  return (
                    <div key={d.n} className="flex items-center gap-3">
                      <div className="w-12"><Stars n={d.n} /></div>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-24 text-right text-xs text-muted-foreground">{d.count} · {pct}%</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
            <CardContent>
              {o?.series.length ? (
                <MiniSeries data={o.series} />
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados no período.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking" className="grid md:grid-cols-3 gap-3">
          <RankCard title="Piores notas" icon={<TrendingDown className="h-4 w-4 text-destructive" />} rows={worst.data ?? []} kind="avg" />
          <RankCard title="Melhores notas" icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} rows={best.data ?? []} kind="avg" />
          <RankCard title="Maior volume" icon={<MessageSquare className="h-4 w-4" />} rows={volume.data ?? []} kind="count" />
        </TabsContent>

        <TabsContent value="moderation">
          <Moderation />
        </TabsContent>

        <TabsContent value="fraud" className="space-y-4">
          <FraudCard title="Múltiplas avaliações do mesmo dispositivo (≥3)" rows={fraud.data?.device ?? []} labelKey="Dispositivo" />
          <FraudCard title="Múltiplas avaliações do mesmo IP (≥5)" rows={fraud.data?.ip ?? []} labelKey="IP" />
          <FraudCard title="Rajadas em 10 minutos (≥10)" rows={fraud.data?.bursts ?? []} labelKey="Janela" />
        </TabsContent>

        <TabsContent value="blocked" className="space-y-4">
          <BlockedByPlan days={days} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ title, value, icon, accent }: { title: string; value: any; icon: React.ReactNode; accent?: "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs ${accent === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>{icon}{title}</div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function MiniSeries({ data }: { data: { date: string; count: number; avg: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date} · ${d.count} avaliações · média ${d.avg.toFixed(2)}`}>
          <div className="w-full bg-primary/70 rounded-t" style={{ height: `${(d.count / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function RankCard({ title, icon, rows, kind }: { title: string; icon: React.ReactNode; rows: any[]; kind: "avg" | "count" }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2">{icon}{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Sem dados.</p>}
        {rows.map((r) => (
          <div key={r.est.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0 flex items-center gap-2">
              {r.est.logo_url && <img src={r.est.logo_url} alt="" className="h-6 w-6 rounded object-cover" />}
              <div className="min-w-0">
                <div className="truncate font-medium">{r.est.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{r.est.plan} · {r.count} avaliações{r.lowPending ? ` · ${r.lowPending} baixas pendentes` : ""}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              {kind === "avg" ? (
                <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /><span className="font-semibold">{r.avg.toFixed(2)}</span></div>
              ) : (
                <div className="font-semibold">{r.count}</div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Moderation() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"any" | "new" | "analyzing" | "contacting" | "resolved" | "archived" | "hidden">("any");
  const [ratingMax, setRatingMax] = useState<string>("any");
  const [establishmentId, setEstablishmentId] = useState<string>("any");
  const [page, setPage] = useState(1);

  const listFn = useServerFn(adminReviewsList);
  const hideFn = useServerFn(adminSetReviewHidden);
  const delFn = useServerFn(adminDeleteReview);
  const estsFn = useServerFn(adminListEstablishmentsMini);

  const ests = useQuery({ queryKey: ["adm-ests-mini"], queryFn: () => estsFn() });
  const list = useQuery({
    queryKey: ["adm-rev-list", q, status, ratingMax, establishmentId, page],
    queryFn: () => listFn({
      data: {
        q, status,
        ratingMax: ratingMax === "any" ? undefined : Number(ratingMax),
        establishmentId: establishmentId === "any" ? null : establishmentId,
        page, pageSize: 25,
      },
    }),
  });

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / (list.data?.pageSize ?? 25)));

  async function onHide(id: string, hidden: boolean) {
    try { await hideFn({ data: { reviewId: id, hidden } }); toast.success(hidden ? "Avaliação ocultada." : "Avaliação exibida novamente."); list.refetch(); }
    catch (e: any) { toast.error(e.message ?? "Falha ao atualizar."); }
  }
  async function onDelete(id: string, reason: string) {
    try { await delFn({ data: { reviewId: id, reason } }); toast.success("Avaliação removida."); list.refetch(); }
    catch (e: any) { toast.error(e.message ?? "Falha ao remover."); }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por comentário, nome ou e-mail" className="pl-8" />
          </div>
          <Select value={ratingMax} onValueChange={(v) => { setRatingMax(v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Nota" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer nota</SelectItem>
              <SelectItem value="1">≤ 1 estrela</SelectItem>
              <SelectItem value="2">≤ 2 estrelas</SelectItem>
              <SelectItem value="3">≤ 3 estrelas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Todos status</SelectItem>
              <SelectItem value="new">Novo</SelectItem>
              <SelectItem value="analyzing">Em análise</SelectItem>
              <SelectItem value="contacting">Em contato</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
              <SelectItem value="archived">Arquivado</SelectItem>
              <SelectItem value="hidden">Ocultas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={establishmentId} onValueChange={(v) => { setEstablishmentId(v); setPage(1); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="any">Todas empresas</SelectItem>
              {(ests.data ?? []).map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {list.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {list.data?.items.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma avaliação encontrada.</p>}
        {list.data?.items.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Stars n={r.rating} />
                  <span className="text-sm font-medium">{r.anonymous ? "Anônimo" : (r.customer_name || "Cliente")}</span>
                  {r.public_hidden && <Badge variant="destructive">Oculta</Badge>}
                  {r.merchant_reply && <Badge variant="secondary">Respondida</Badge>}
                  <Badge variant="outline">{r.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
              </div>

              <div className="text-xs text-muted-foreground">
                {r.establishment?.name ?? r.establishment_id}
                {(r.customer_email || r.customer_phone) && !r.anonymous && (
                  <> · {r.customer_email ?? ""} {r.customer_phone ? `· ${r.customer_phone}` : ""}</>
                )}
              </div>

              {r.comment && <p className="text-sm">{r.comment}</p>}

              {r.merchant_reply && (
                <div className="rounded-lg border-l-2 border-primary bg-muted/40 p-2 text-sm">
                  <div className="text-[10px] uppercase tracking-wide text-primary font-semibold">Resposta do lojista</div>
                  <p className="mt-0.5">{r.merchant_reply}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => onHide(r.id, !r.public_hidden)}>
                  {r.public_hidden ? <><Eye className="mr-1 h-4 w-4" />Exibir</> : <><EyeOff className="mr-1 h-4 w-4" />Ocultar</>}
                </Button>
                <DeleteReviewDialog onConfirm={(reason) => onDelete(r.id, reason)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {list.data && list.data.total > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">{list.data.total} resultado(s)</div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-xs">Página {page} de {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteReviewDialog({ onConfirm }: { onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive"><Trash2 className="mr-1 h-4 w-4" />Excluir</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação remove permanentemente a avaliação e é registrada na auditoria da plataforma. Use apenas para conteúdo abusivo, ilegal ou spam.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input placeholder="Motivo (registrado na auditoria)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(reason)}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function FraudCard({ title, rows, labelKey }: { title: string; rows: any[]; labelKey: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Nenhum sinal detectado.</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-0">
            <div className="min-w-0">
              <div className="truncate font-medium">{r.establishment?.name ?? r.est}</div>
              <div className="text-[11px] text-muted-foreground truncate">{labelKey}: <code>{r.sample ?? "—"}</code></div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-semibold">{r.count}×</div>
              <div className="text-[11px] text-muted-foreground">média {(r.ratings.reduce((a: number, b: number) => a + b, 0) / r.ratings.length).toFixed(1)}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BlockedByPlan({ days }: { days: number }) {
  const listFn = useServerFn(adminListFeatureGateEvents);
  const sumFn = useServerFn(adminFeatureGateSummary);
  const [feature, setFeature] = useState<string>("public_reviews");
  const [planTier, setPlanTier] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [searchDeb, setSearchDeb] = useState<string>("");
  const [csvDelim, setCsvDelim] = useState<"," | ";">(",");

  const summary = useQuery({ queryKey: ["adm-gate-sum", days], queryFn: () => sumFn({ data: { days } }) });
  const list = useQuery({
    queryKey: ["adm-gate-list", days, feature, planTier, searchDeb],
    queryFn: () => listFn({ data: {
      days,
      feature_key: feature === "all" ? undefined : feature,
      plan_tier: planTier === "all" ? undefined : planTier,
      search: searchDeb || undefined,
      limit: 500,
    } }),
  });

  const FEATURE_LABELS: Record<string, string> = {
    public_reviews: "Avaliações públicas (QR + página)",
  };

  function exportCsv() {
    const data = list.data ?? [];
    const rows = data.map((r: any) => [
      new Date(r.created_at).toISOString(),
      r.establishments?.name ?? "",
      r.establishments?.slug ?? "",
      r.plan_tier ?? "",
      r.feature_key,
      FEATURE_LABELS[r.feature_key] ?? r.feature_key,
      r.action,
      r.user_name ?? "",
      r.user_email ?? "",
      r.context ? JSON.stringify(r.context) : "",
    ]);
    const preamble = [
      `Exportação: Bloqueios de plano — /admin/avaliações`,
      `Gerado em: ${new Date().toISOString()}`,
      `Período: últimos ${days} dias`,
      `Filtro Recurso: ${feature === "all" ? "Todos" : (FEATURE_LABELS[feature] ?? feature)}`,
      `Filtro Plano: ${planTier === "all" ? "Todos" : planTier}`,
      `Filtro Busca (empresa): ${searchDeb || "—"}`,
      `Separador: ${csvDelim === "," ? "vírgula (,)" : "ponto e vírgula (;)"}`,
      `Total de eventos: ${data.length}`,
    ];
    const suffix = [
      feature !== "all" ? feature : "todos",
      planTier !== "all" ? planTier : "todos",
      searchDeb ? searchDeb.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 24) : "sem-busca",
      `${days}d`,
    ].join("_");
    downloadCSV(
      `bloqueios-plano_${suffix}_${new Date().toISOString().slice(0,10)}.csv`,
      ["Data (ISO)", "Empresa", "Slug", "Plano", "Recurso (chave)", "Recurso (nome)", "Ação", "Usuário", "E-mail", "Contexto"],
      rows,
      { delimiter: csvDelim, preamble },
    );
  }


  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo por recurso ({days}d)</CardTitle></CardHeader>
        <CardContent>
          {summary.data && summary.data.byFeature.length ? (
            <div className="space-y-2">
              {summary.data.byFeature.map((f) => (
                <div key={f.feature_key} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-semibold">{FEATURE_LABELS[f.feature_key] ?? f.feature_key}</div>
                    <div className="text-xs text-muted-foreground">{f.distinct_establishments} empresa(s) afetada(s)</div>
                  </div>
                  <div className="text-2xl font-bold">{f.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum bloqueio registrado no período.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Tentativas bloqueadas</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={csvDelim} onValueChange={(v) => setCsvDelim(v as "," | ";")}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Separador: vírgula (,)</SelectItem>
                  <SelectItem value=";">Separador: ponto e vírgula (;)</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!list.data || list.data.length === 0}>
                <Download className="h-4 w-4 mr-1.5" /> Exportar CSV (filtros aplicados)
              </Button>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa (nome ou slug)…"
                className="pl-8 pr-8"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  // Manual debounce
                  window.clearTimeout((window as any).__gateSearchT);
                  (window as any).__gateSearchT = window.setTimeout(() => setSearchDeb(e.target.value), 350);
                }}
              />
              {search && (
                <button type="button" onClick={() => { setSearch(""); setSearchDeb(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Select value={feature} onValueChange={setFeature}>
              <SelectTrigger><SelectValue placeholder="Recurso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os recursos</SelectItem>
                <SelectItem value="public_reviews">Avaliações públicas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planTier} onValueChange={setPlanTier}>
              <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {list.data && list.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada para os filtros atuais.</p>
          )}
          {list.data && list.data.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mb-2">{list.data.length} evento(s) encontrado(s).</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 pr-3">Data</th>
                      <th className="py-2 pr-3">Empresa</th>
                      <th className="py-2 pr-3">Plano</th>
                      <th className="py-2 pr-3">Recurso</th>
                      <th className="py-2 pr-3">Usuário</th>
                      <th className="py-2 pr-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(r.created_at)}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.establishments?.name ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground">/{r.establishments?.slug ?? "—"}</div>
                        </td>
                        <td className="py-2 pr-3"><Badge variant="outline">{r.plan_tier ?? "—"}</Badge></td>
                        <td className="py-2 pr-3 text-xs">{FEATURE_LABELS[r.feature_key] ?? r.feature_key}</td>
                        <td className="py-2 pr-3">
                          <div>{r.user_name ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground">{r.user_email ?? ""}</div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="font-mono text-xs">{r.action}</div>
                          {r.context && Object.keys(r.context).length > 0 && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-xs" title={JSON.stringify(r.context)}>
                              {JSON.stringify(r.context)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
