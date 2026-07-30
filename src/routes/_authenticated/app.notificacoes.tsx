import { RouteLoading } from "@/components/RouteLoading";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, Bell, Users, Zap, AlertTriangle, Sparkles, Clock, X, Wallet, Gift, Compass, QrCode, Link2, Megaphone, Search, UserCheck, Info } from "lucide-react";
import { getMyEstablishments, listCustomers } from "@/lib/loyalty.functions";

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
  customer_ids?: string[] | null;
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
  const activeEst = memberships?.[0]?.establishment as { id: string; name: string; slug: string } | undefined;
  const deepLinks = [
    ...BASE_DEEP_LINKS,
    ...(activeEst?.slug
      ? [{ key: "promotions", label: "Minhas promoções", path: `/carteira/${activeEst.slug}/promocoes`, icon: Megaphone } as const]
      : []),
  ];

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [segment, setSegment] = useState<Segment>({ activity: "all" });
  const [scheduleAt, setScheduleAt] = useState<string>("");

  const [customerMode, setCustomerMode] = useState<"all" | "specific">("all");
  const [customerQuery, setCustomerQuery] = useState("");
  const listCustomersFn = useServerFn(listCustomers);

  const { data: customersData, isFetching: loadingCustomers } = useQuery({
    queryKey: ["notif_customers", activeEst?.id, customerQuery],
    enabled: !!activeEst?.id && customerMode === "specific",
    queryFn: () =>
      listCustomersFn({
        data: { establishment_id: activeEst!.id, query: customerQuery, page: 1, page_size: 50 },
      }),
    staleTime: 15_000,
  });

  function toggleCustomer(id: string) {
    setSegment((s) => {
      const cur = new Set(s.customer_ids ?? []);
      if (cur.has(id)) cur.delete(id);
      else cur.add(id);
      return { ...s, customer_ids: cur.size ? Array.from(cur) : null };
    });
  }



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

  const [confirmOpen, setConfirmOpen] = useState(false);

  // Debounced segment preview
  type PreviewData = {
    customers: number;
    subscribers: number;
    operators?: number;
    reachable_customers?: number;
    without_device?: number;
    sample?: Array<{ id: string; name: string | null; phone: string | null; tier: string | null }>;
  };
  const [previewCount, setPreviewCount] = useState<PreviewData | null>(null);
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

  const segmentChips = useMemo<string[]>(() => {
    const chips: string[] = [];
    chips.push(segment.tiers?.length ? `Níveis: ${segment.tiers.join(", ")}` : "Todos os níveis");
    const act: Record<string, string> = {
      all: "Qualquer atividade",
      active_30d: "Ativos (30 dias)",
      inactive_30d: "Inativos (30+ dias)",
      inactive_60d: "Inativos (60+ dias)",
    };
    chips.push(act[segment.activity ?? "all"]);
    if (segment.campaign_id) {
      const c = (campaigns ?? []).find((x: any) => x.id === segment.campaign_id);
      chips.push(`Cartão: ${c?.name ?? "selecionado"}`);
    }
    if (segment.min_stamps) chips.push(`Mín. ${segment.min_stamps} carimbos`);
    if (segment.customer_ids?.length) chips.push(`${segment.customer_ids.length} cliente(s) escolhidos`);
    return chips;
  }, [segment, campaigns]);


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
      setConfirmOpen(false);
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
      <RouteLoading fullscreen={false} className="min-h-[40vh]" />
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
                {previewCount
                  ? `${previewCount.customers} clientes · ${previewCount.subscribers} inscritos${
                      previewCount.operators ? ` · ${previewCount.operators} dispositivos da equipe` : ""
                    }`
                  : "Ajuste o segmento abaixo"}
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
              {deepLinks.map((d: typeof deepLinks[number]) => {
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

            {/* Individual customer picker */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" /> Clientes
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode("all");
                    setSegment((s) => ({ ...s, customer_ids: null }));
                  }}
                  className={`px-2.5 py-1 rounded-full text-xs border transition ${
                    customerMode === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  Todos que casarem com o segmento
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("specific")}
                  className={`px-2.5 py-1 rounded-full text-xs border transition ${
                    customerMode === "specific"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  Escolher cliente por cliente
                </button>
              </div>

              {customerMode === "specific" && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Buscar por nome, telefone ou código"
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                  {(segment.customer_ids?.length ?? 0) > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{segment.customer_ids!.length} selecionado(s)</span>
                      <button
                        type="button"
                        className="underline hover:text-foreground"
                        onClick={() => setSegment((s) => ({ ...s, customer_ids: null }))}
                      >
                        Limpar seleção
                      </button>
                    </div>
                  )}
                  <div className="max-h-60 overflow-y-auto rounded border bg-background divide-y">
                    {loadingCustomers && (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> Carregando…
                      </div>
                    )}
                    {!loadingCustomers && (customersData?.customers ?? []).length === 0 && (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        Nenhum cliente encontrado.
                      </div>
                    )}
                    {(customersData?.customers ?? []).map((c: any) => {
                      const checked = (segment.customer_ids ?? []).includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer hover:bg-muted/60 ${
                            checked ? "bg-primary/5" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCustomer(c.id)}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                          <span className="flex-1 truncate font-medium">{c.name || "—"}</span>
                          <span className="text-muted-foreground">{c.phone || c.code || ""}</span>
                        </label>
                      );
                    })}
                  </div>
                  {customersData && customersData.total > (customersData.customers?.length ?? 0) && (
                    <p className="text-[10px] text-muted-foreground">
                      Mostrando {customersData.customers?.length ?? 0} de {customersData.total}. Refine a busca para ver mais.
                    </p>
                  )}
                </div>
              )}
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
                onClick={() => setConfirmOpen(true)}
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
                      : `Revisar e enviar (${(previewCount?.subscribers ?? 0) + (previewCount?.operators ?? 0)})`}
                </span>
              </Button>
            )}

          </div>

          {previewCount && previewCount.subscribers === 0 && !previewCount.operators && !blockedByPlan && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-foreground">
                  Nenhum cliente inscrito neste segmento ainda.
                </div>
                <div className="text-muted-foreground">
                  Só recebem push quem instalou o app na tela inicial <strong>e</strong> tocou em "Ativar notificações".
                  Divulgue o QR do cartão fidelidade e peça para o cliente adicionar à tela inicial —
                  no primeiro acesso pelo ícone o app pede permissão automaticamente (exceto iOS, onde é feito com um toque no card).
                </div>
              </div>
            </div>
          )}

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

      {/* Confirmação com prévia do público */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Confirmar envio
            </DialogTitle>
            <DialogDescription>Revise a mensagem e o público antes de disparar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Prévia da notificação */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-start gap-2">
                <Bell className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{title.trim() || "—"}</div>
                  {body.trim() && <div className="text-xs text-muted-foreground">{body.trim()}</div>}
                  {url.trim() && (
                    <div className="mt-1 text-[10px] text-muted-foreground truncate">Destino: {url.trim()}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Números */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2">
                <div className="text-lg font-semibold">{previewCount?.subscribers ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Clientes com dispositivo</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-lg font-semibold">{previewCount?.operators ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Dispositivos da equipe</div>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-2">
                <div className="text-lg font-semibold text-primary">
                  {(previewCount?.subscribers ?? 0) + (previewCount?.operators ?? 0)}
                </div>
                <div className="text-[10px] text-muted-foreground">Total de destinatários</div>
              </div>
            </div>

            {/* Filtros aplicados */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Segmento
              </div>
              <div className="flex flex-wrap gap-1.5">
                {segmentChips.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                ))}
              </div>
              {!!previewCount?.without_device && (
                <p className="text-[11px] text-muted-foreground">
                  {previewCount.without_device} cliente(s) do segmento ainda não ativaram notificações e não receberão.
                </p>
              )}
            </div>

            {/* Amostra */}
            {!!previewCount?.sample?.length && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold">Alguns destinatários</div>
                <div className="max-h-40 overflow-y-auto rounded border divide-y">
                  {previewCount.sample.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                      <span className="flex-1 truncate font-medium">{c.name || "Cliente"}</span>
                      {c.tier && <Badge variant="outline" className="text-[9px] uppercase">{c.tier}</Badge>}
                      <span className="text-muted-foreground">{c.phone ?? ""}</span>
                    </div>
                  ))}
                </div>
                {(previewCount.reachable_customers ?? 0) > previewCount.sample.length && (
                  <p className="text-[10px] text-muted-foreground">
                    +{(previewCount.reachable_customers ?? 0) - previewCount.sample.length} outros clientes.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={send.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => send.mutate()}
              disabled={
                send.isPending ||
                !canSend ||
                (previewCount?.subscribers ?? 0) + (previewCount?.operators ?? 0) === 0
              }
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">
                Confirmar envio ({(previewCount?.subscribers ?? 0) + (previewCount?.operators ?? 0)})
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

}

function normalizeSegment(s: Segment): Segment {
  const out: Segment = {};
  if (s.tiers && s.tiers.length > 0) out.tiers = s.tiers;
  if (s.activity && s.activity !== "all") out.activity = s.activity;
  if (s.campaign_id) out.campaign_id = s.campaign_id;
  if (s.min_stamps && s.min_stamps > 0) out.min_stamps = s.min_stamps;
  if (s.customer_ids && s.customer_ids.length > 0) out.customer_ids = s.customer_ids;
  return out;

}
