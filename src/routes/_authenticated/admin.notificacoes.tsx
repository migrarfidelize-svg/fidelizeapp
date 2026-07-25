import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { BellDot as HeroIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Loader2, Send, Users, CheckCircle2, XCircle } from "lucide-react";
import {
  adminPushOverview,
  adminListPushLogs,
  adminBroadcastPush,
} from "@/lib/push.functions";

export const Route = createFileRoute("/_authenticated/admin/notificacoes")({
  component: AdminNotifPage,
});

function AdminNotifPage() {
  const overviewFn = useServerFn(adminPushOverview);
  const logsFn = useServerFn(adminListPushLogs);
  const bcastFn = useServerFn(adminBroadcastPush);

  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ["admin_push_overview"],
    queryFn: () => overviewFn(),
  });

  const [logsFilter, setLogsFilter] = useState<string>("all");
  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ["admin_push_logs", logsFilter],
    queryFn: () =>
      logsFn({
        data: {
          establishment_id: logsFilter === "all" ? undefined : logsFilter,
          limit: 150,
        },
      }),
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [respectPrefs, setRespectPrefs] = useState(true);
  const [target, setTarget] = useState<"all" | "select">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const ests = overview?.establishments ?? [];

  const selectedCount = useMemo(() => {
    if (target === "all") return overview?.totals.active_subs ?? 0;
    let n = 0;
    for (const b of overview?.breakdown ?? []) {
      if (selected.has(b.establishment_id)) n += b.active_subs;
    }
    return n;
  }, [target, selected, overview]);

  const send = useMutation({
    mutationFn: async () =>
      bcastFn({
        data: {
          title: title.trim(),
          body: body.trim() || undefined,
          url: url.trim() || undefined,
          establishment_ids:
            target === "select" ? Array.from(selected) : undefined,
          respect_prefs: respectPrefs,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `Enviado para ${r.sent} de ${r.total} inscritos${r.skipped ? ` (${r.skipped} ignorados por preferência)` : ""}.`,
      );
      setTitle("");
      setBody("");
      setUrl("");
      refetch();
      refetchLogs();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha no envio"),
  });

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canSend =
    title.trim().length >= 2 &&
    !send.isPending &&
    (target === "all" || selected.size > 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Notificações"}
        title={"Central de notificações"}
        subtitle={"Push, e-mail e in-app disparados para operadores da plataforma."}
      />
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bell className="h-5 w-5" /> Notificações Push — Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Visão global de inscrições e envio de broadcast para os clientes finais das empresas.
        </p>
      </header>

      <AdminPushDiagnostics />


      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Inscrições ativas"
          value={overview.totals.active_subs}
        />
        <Kpi
          icon={<Users className="h-4 w-4 opacity-60" />}
          label="Inscrições totais"
          value={overview.totals.total_subs}
        />
        <Kpi
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Entregues 30d"
          value={overview.totals.sent_30d}
        />
        <Kpi
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          label="Falhas 30d"
          value={overview.totals.failed_30d}
        />
      </div>

      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enviar broadcast</CardTitle>
          <CardDescription>
            A notificação chega em segundos para todos os clientes das empresas selecionadas que ativaram push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Título *</Label>
              <Input
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Aviso importante da Fidelize"
              />
            </div>
            <div className="space-y-1">
              <Label>Link (opcional)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea
              value={body}
              rows={3}
              maxLength={200}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escreva algo curto e direto"
            />
          </div>

          <div className="space-y-2">
            <Label>Destino</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as "all" | "select")}>
              <SelectTrigger className="w-full md:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                <SelectItem value="select">Selecionar empresas…</SelectItem>
              </SelectContent>
            </Select>

            {target === "select" && (
              <div className="max-h-64 overflow-y-auto rounded-md border p-2">
                {ests.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">Nenhuma empresa ativa.</p>
                ) : (
                  ests.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={(c) => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (c) n.add(e.id);
                            else n.delete(e.id);
                            return n;
                          });
                        }}
                      />
                      <span className="text-sm">{e.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t pt-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="respect"
                checked={respectPrefs}
                onCheckedChange={setRespectPrefs}
              />
              <Label htmlFor="respect" className="text-sm">
                Respeitar preferências (categoria “campanha”)
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Alvo estimado: <strong>{selectedCount}</strong> inscrito(s)
              </span>
              <Button onClick={() => send.mutate()} disabled={!canSend}>
                {send.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="ml-2">Enviar</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown per establishment */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Empresas com push ativo</CardTitle>
          <CardDescription>Inscritos ativos e envios dos últimos 30 dias.</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma inscrição ativa ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-right">Inscritos ativos</TableHead>
                    <TableHead className="text-right">Entregues 30d</TableHead>
                    <TableHead className="text-right">Falhas 30d</TableHead>
                    <TableHead className="text-right">Expirados 30d</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.breakdown.map((b) => (
                    <TableRow key={b.establishment_id}>
                      <TableCell className="font-medium">{b.establishment_name}</TableCell>
                      <TableCell className="text-right">{b.active_subs}</TableCell>
                      <TableCell className="text-right text-emerald-700">{b.sent}</TableCell>
                      <TableCell className="text-right text-destructive">{b.failed}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{b.expired}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader className="flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">Histórico de envios</CardTitle>
            <CardDescription>Últimos 150 disparos.</CardDescription>
          </div>
          <Select value={logsFilter} onValueChange={setLogsFilter}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {ests.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <TableHead>Empresa</TableHead>
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
                      <TableCell className="text-xs">{l.establishment_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{l.title}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            l.status === "sent"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : l.status === "expired"
                                ? "bg-muted text-muted-foreground"
                                : "bg-destructive/15 text-destructive"
                          }
                        >
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
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

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-md bg-muted p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}
