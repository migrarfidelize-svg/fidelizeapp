import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { BellRing as HeroIcon } from "lucide-react";
import { useState } from "react";
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
import { Loader2, Send, Bell, Users, Zap, AlertTriangle, Sparkles } from "lucide-react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listPushLogs, broadcastPush, getPushQuotaStatus } from "@/lib/push.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/notificacoes")({
  component: NotifPage,
});

function NotifPage() {
  const getEsts = useServerFn(getMyEstablishments);
  const listLogs = useServerFn(listPushLogs);
  const bcast = useServerFn(broadcastPush);
  const quotaFn = useServerFn(getPushQuotaStatus);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");

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

  const send = useMutation({
    mutationFn: async () => {
      if (!activeEst) return;
      return bcast({
        data: {
          establishment_id: activeEst.id,
          title: title.trim(),
          body: body.trim() || undefined,
          url: url.trim() || undefined,
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

  const quota = quotaQ.data;
  const blockedByPlan = !!quota && !quota.allowed;
  const limitReached =
    !!quota && quota.daily_limit != null && quota.remaining != null && quota.remaining <= 0;
  const canSend = !!quota && quota.allowed && !limitReached && title.trim().length >= 2;

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
        subtitle={"Alertas de operação, cobrança, suporte e retenção em um só lugar."}
      />
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-5 w-5" /> Notificações Push
        </h1>
        <p className="text-sm text-muted-foreground">
          Envie um aviso instantâneo a todos os clientes que ativaram notificações.
        </p>
      </header>

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
                <Users className="h-3.5 w-3.5" /> Destinatários estimados
              </div>
              <div className="mt-1 text-lg font-semibold">{quota.recipients}</div>
              <div className="text-[11px] text-muted-foreground">Inscritos ativos que aceitam campanhas</div>
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
              <div className="text-muted-foreground">
                Faça upgrade para enviar avisos instantâneos aos seus clientes.
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/app/planos">Ver planos</Link>
            </Button>
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
                Você já enviou {quota?.sent_today} de {quota?.daily_limit} broadcasts hoje. Tente novamente amanhã ou faça upgrade.
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/planos">Upgrade</Link>
            </Button>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova mensagem</CardTitle>
          <CardDescription>
            Respeita as preferências do cliente (usa a categoria “campanha”).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Novidade da casa!"
            />
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea
              value={body}
              rows={3}
              maxLength={200}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Descrição curta"
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
          <div className="flex justify-end">
            <Button
              onClick={() => send.mutate()}
              disabled={send.isPending || title.trim().length < 2}
            >
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="ml-2">Enviar broadcast</span>
            </Button>
          </div>
        </CardContent>
      </Card>

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
