import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { BellRing as HeroIcon } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Bell, Users, Zap, AlertTriangle, Sparkles, Clock, X, Wallet, Gift, Compass, QrCode, Link2, Megaphone } from "lucide-react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import {
  listPushLogs,
  broadcastPush,
  getPushQuotaStatus,
  previewPushSegment,
  scheduleBroadcast,
  listScheduledBroadcasts,
  cancelScheduledBroadcast,
} from "@/lib/push.functions";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/notificacoes")({
  component: NotifPage,
});

type Segment = {
  tiers?: Array<"bronze" | "prata" | "ouro" | "diamante">;
  activity?: "all" | "active_30d" | "inactive_30d" | "inactive_60d";
  campaign_id?: string | null;
  min_stamps?: number | null;
};

const TIERS = [
  { key: "bronze", label: "Bronze" },
  { key: "prata", label: "Prata" },
  { key: "ouro", label: "Ouro" },
  { key: "diamante", label: "Diamante" },
] as const;

const BASE_DEEP_LINKS = [
  { key: "wallet", label: "Minha carteira", path: "/carteira", icon: Wallet },
  { key: "qr", label: "Meu QR", path: "/carteira?tab=qr", icon: QrCode },
  { key: "prizes", label: "Meus prêmios", path: "/carteira/premios", icon: Gift },
  { key: "discover", label: "Descobrir lojas", path: "/carteira/descobrir", icon: Compass },
] as const;

function NotifPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const listLogs = useServerFn(listPushLogs);
  const bcast = useServerFn(broadcastPush);
  const quotaFn = useServerFn(getPushQuotaStatus);
  const previewFn = useServerFn(previewPushSegment);
  const scheduleFn = useServerFn(scheduleBroadcast);
  const listScheduledFn = useServerFn(listScheduledBroadcasts);
  const cancelScheduledFn = useServerFn(cancelScheduledBroadcast);

  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [segment, setSegment] = useState<Segment>({ activity: "all" });
  const [scheduleAt, setScheduleAt] = useState<string>("");

  // Campaigns for segment "specific card"
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns_min", activeEst?.id],
    enabled: !!activeEst?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("establishment_id", activeEst!.id)
        .order("name");
      return data ?? [];
    },
  });

  const quotaQ = useQuery({
    queryKey: ["push_quota", activeEst?.id],
    queryFn: () => quotaFn({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const { data: logs, refetch } = useQuery({
    queryKey: ["push_logs", activeEst?.id],
    queryFn: () => listLogs({ data: { establishment_id: activeEst!.id, limit: 100 } }),
    enabled: !!activeEst?.id,
  });

  const scheduledQ = useQuery({
    queryKey: ["scheduled_push", activeEst?.id],
    queryFn: () => listScheduledFn({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });

  // Debounced segment preview
  const [previewCount, setPreviewCount] = useState<{ customers: number; subscribers: number } | null>(null);
  useEffect(() => {
    if (!activeEst?.id) return;
    const t = setTimeout(async () => {
      try {
        const r = await previewFn({
          data: { establishment_id: activeEst.id, segment: normalizeSegment(segment) },
        });
        setPreviewCount(r);
      } catch {
        /* noop */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [segment, activeEst?.id, previewFn]);

  const send = useMutation({
    mutationFn: async () => {
      if (!activeEst) return;
      return bcast({
        data: {
          establishment_id: activeEst.id,
          title: title.trim(),
          body: body.trim() || undefined,
          url: url.trim() || undefined,
          segment: normalizeSegment(segment),
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`Enviado para ${r?.sent ?? 0} de ${r?.total ?? 0} inscritos.`);
      setTitle("");
      setBody("");
      setUrl("");
      refetch();
      quotaQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no envio"),
  });

  const schedule = useMutation({
    mutationFn: async () => {
      if (!activeEst || !scheduleAt) return;
      return scheduleFn({
        data: {
          establishment_id: activeEst.id,
          title: title.trim(),
          body: body.trim() || undefined,
          url: url.trim() || undefined,
          segment: normalizeSegment(segment),
          scheduled_at: new Date(scheduleAt).toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Agendamento criado.");
      setTitle("");
      setBody("");
      setUrl("");
      setScheduleAt("");
      scheduledQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao agendar"),
  });

  const cancelSch = useMutation({
    mutationFn: async (id: string) => cancelScheduledFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      scheduledQ.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao cancelar"),
  });

  const quota = quotaQ.data;
  const blockedByPlan = !!quota && !quota.allowed;
  const limitReached =
    !!quota && quota.daily_limit != null && quota.remaining != null && quota.remaining <= 0;
  const canSend = !!quota && quota.allowed && !limitReached && title.trim().length >= 2;
  const canSchedule = !!quota && quota.allowed && title.trim().length >= 2 && !!scheduleAt;

  const minDateTime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  }, []);

  function toggleTier(t: (typeof TIERS)[number]["key"]) {
    setSegment((s) => {
      const cur = new Set(s.tiers ?? []);
      if (cur.has(t)) cur.delete(t);
      else cur.add(t);
      return { ...s, tiers: cur.size ? (Array.from(cur) as Segment["tiers"]) : undefined };
    });
  }

  if (!activeEst) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Central · Alertas"}
        title={"Notificações"}
        subtitle={"Envie avisos segmentados, com botões de destino e agendamento."}
      />

      {/* Quota / plano */}
      {quota && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Plano
                </div>
                <Badge variant="secondary" className="uppercase text-[10px]">{quota.tier}</Badge>
              </div>
              <div className="mt-1 text-lg font-semibold">
                {quota.daily_limit == null ? "Ilimitado" : `${quota.daily_limit}/dia`}
              </div>
              <div className="text-[11px] text-muted-foreground">Limite diário do plano</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5" /> Enviados hoje
              </div>
              <div className="mt-1 text-lg font-semibold">
                {quota.sent_today}
                {quota.daily_limit != null && (
                  <span className="text-sm text-muted-foreground"> / {quota.daily_limit}</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {quota.remaining == null ? "Sem limite" : `Restam ${quota.remaining} hoje`}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> No segmento atual
              </div>
              <div className="mt-1 text-lg font-semibold">{previewCount?.subscribers ?? "—"}</div>
              <div className="text-[11px] text-muted-foreground">
                {previewCount ? `${previewCount.customers} clientes · ${previewCount.subscribers} inscritos` : "Ajuste o segmento abaixo"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {blockedByPlan && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">Notificações push não estão no seu plano</div>
              <div className="text-muted-foreground">Faça upgrade para enviar avisos aos seus clientes.</div>
            </div>
            <Button asChild size="sm"><Link to="/app/planos">Ver planos</Link></Button>
          </CardContent>
        </Card>
      )}

      {!blockedByPlan && limitReached && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <div className="font-semibold">Limite diário atingido</div>
              <div className="text-muted-foreground">
                Você já usou {quota?.sent_today}/{quota?.daily_limit} broadcasts hoje. Agende para amanhã ou faça upgrade.
              </div>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/app/planos">Upgrade</Link></Button>
          </CardContent>
        </Card>
      )}

      {/* Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Nova mensagem
          </CardTitle>
          <CardDescription>Respeita as preferências do cliente (categoria "campanha").</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="Novidade da casa!" />
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea value={body} rows={3} maxLength={200} onChange={(e) => setBody(e.target.value)} placeholder="Descrição curta" />
          </div>

          {/* Deep-link buttons */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Destino ao tocar</Label>
            <div className="flex flex-wrap gap-2">
              {DEEP_LINKS.map((d) => {
                const Icon = d.icon;
                const full = typeof window !== "undefined" ? `${window.location.origin}${d.path}` : d.path;
                const active = url === full;
                return (
                  <Button
                    key={d.key}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUrl(active ? "" : full)}
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {d.label}
                  </Button>
                );
              })}
            </div>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Ou cole uma URL personalizada"
              className="text-xs"
            />
          </div>

          {/* Segment */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Segmentação
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Níveis</Label>
              <div className="flex flex-wrap gap-1.5">
                {TIERS.map((t) => {
                  const on = segment.tiers?.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleTier(t.key)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
                <span className="text-[11px] text-muted-foreground self-center ml-1">
                  {segment.tiers?.length ? "" : "(todos)"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Atividade</Label>
                <Select
                  value={segment.activity ?? "all"}
                  onValueChange={(v) => setSegment((s) => ({ ...s, activity: v as Segment["activity"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active_30d">Ativos (últimos 30 dias)</SelectItem>
                    <SelectItem value="inactive_30d">Inativos (30+ dias)</SelectItem>
                    <SelectItem value="inactive_60d">Inativos (60+ dias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cartão específico</Label>
                <Select
                  value={segment.campaign_id ?? "any"}
                  onValueChange={(v) => setSegment((s) => ({ ...s, campaign_id: v === "any" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Qualquer cartão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer cartão</SelectItem>
                    {(campaigns ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Mínimo de carimbos {segment.min_stamps ? `(≥ ${segment.min_stamps})` : ""}
              </Label>
              <Input
                type="number"
                min={0}
                max={999}
                value={segment.min_stamps ?? ""}
                onChange={(e) =>
                  setSegment((s) => ({
                    ...s,
                    min_stamps: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="ex.: 5 (clientes prestes a resgatar)"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="rounded-lg border p-3 space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Agendar (opcional)
            </Label>
            <Input
              type="datetime-local"
              value={scheduleAt}
              min={minDateTime}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Envio automático próximo do horário escolhido. Deixe em branco para enviar agora.
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {scheduleAt ? (
              <Button
                onClick={() => schedule.mutate()}
                disabled={schedule.isPending || !canSchedule}
                variant="secondary"
              >
                {schedule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                <span className="ml-2">Agendar envio</span>
              </Button>
            ) : (
              <Button
                onClick={() => send.mutate()}
                disabled={send.isPending || !canSend}
                title={
                  blockedByPlan
                    ? "Recurso indisponível no seu plano"
                    : limitReached
                      ? "Limite diário atingido"
                      : undefined
                }
              >
                {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-2">
                  {blockedByPlan
                    ? "Bloqueado pelo plano"
                    : limitReached
                      ? "Limite diário atingido"
                      : `Enviar para ${previewCount?.subscribers ?? 0} inscritos`}
                </span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled list */}
      {scheduledQ.data && scheduledQ.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Agendamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledQ.data.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(s.scheduled_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{s.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            s.status === "sent"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : s.status === "failed"
                                ? "bg-destructive/15 text-destructive"
                                : s.status === "canceled"
                                  ? "bg-muted"
                                  : "bg-amber-500/15 text-amber-700"
                          }
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.result?.sent != null
                          ? `${s.result.sent}/${s.result.total ?? "?"} enviados`
                          : s.result?.reason ?? "—"}
                      </TableCell>
                      <TableCell>
                        {s.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelSch.mutate(s.id)}
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico recente</CardTitle>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{l.title}</TableCell>
                      <TableCell>
                        <Badge
                          variant={l.status === "sent" ? "default" : "secondary"}
                          className={
                            l.status === "sent"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : l.status === "failed"
                                ? "bg-destructive/15 text-destructive"
                                : ""
                          }
                        >
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {l.error ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeSegment(s: Segment): Segment {
  const out: Segment = {};
  if (s.tiers && s.tiers.length > 0) out.tiers = s.tiers;
  if (s.activity && s.activity !== "all") out.activity = s.activity;
  if (s.campaign_id) out.campaign_id = s.campaign_id;
  if (s.min_stamps && s.min_stamps > 0) out.min_stamps = s.min_stamps;
  return out;
}
