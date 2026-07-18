import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { listEmailQueue, retryQueueItem, deleteQueueItem, runQueueNow } from "@/lib/email.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RefreshCw, PlayCircle, Trash2, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/emails/fila")({
  head: () => ({ meta: [{ title: "Fila de e-mails — Fidelize" }] }),
  component: QueuePage,
});

function fmt(dt?: string | null) { if (!dt) return "—"; try { return new Date(dt).toLocaleString("pt-BR"); } catch { return dt; } }

function QueuePage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getAdminStatus);
  const listFn = useServerFn(listEmailQueue);
  const retryFn = useServerFn(retryQueueItem);
  const deleteFn = useServerFn(deleteQueueItem);
  const runNow = useServerFn(runQueueNow);

  const { data: admin, isLoading: adminLoading } = useQuery({ queryKey: ["admin-status"], queryFn: () => getStatus() });
  const enabled = !!admin?.isAdmin;
  const [status, setStatus] = useState<"pending"|"processing"|"sent"|"failed"|"all">("pending");
  const { data, isLoading } = useQuery({
    queryKey: ["email-queue", status], queryFn: () => listFn({ data: { status, limit: 100 } }),
    enabled, refetchInterval: 10_000,
  });

  if (adminLoading) return <div className="text-muted-foreground">Verificando permissões…</div>;
  if (!admin?.isAdmin) return <div className="max-w-md mx-auto mt-16 p-6 rounded-xl border bg-card text-center"><h2 className="text-lg font-semibold">Acesso restrito</h2></div>;

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><ListChecks className="h-5 w-5" /> Fila de e-mails</h1>
          <p className="text-sm text-muted-foreground">Reenvio automático com backoff exponencial (1min, 5min, 15min, 1h, 6h). Máx. 5 tentativas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="gap-1" onClick={() => qc.invalidateQueries({ queryKey: ["email-queue"] })}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button className="gap-1 gradient-brand text-primary-foreground" onClick={async () => {
            try { const r = await runNow(); toast.success(`Processados ${r.picked} • enviados ${r.sent} • erros ${r.failed + r.dead}`); qc.invalidateQueries({ queryKey: ["email-queue"] }); }
            catch (e: any) { toast.error(e?.message ?? "Falha"); }
          }}><PlayCircle className="h-4 w-4" /> Processar agora</Button>
        </div>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="processing">Processando</TabsTrigger>
          <TabsTrigger value="failed">Falharam</TabsTrigger>
          <TabsTrigger value="sent">Enviados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mensagens</CardTitle>
          <CardDescription>{items.length} registro(s).</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> :
          items.length === 0 ? <div className="text-sm text-muted-foreground">Nenhum item.</div> :
          <div className="divide-y">
            {items.map((it: any) => (
              <div key={it.id} className="py-3 flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-medium truncate">{it.subject}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    para <span className="font-mono">{it.to_email}</span>
                    {it.template && <> · template <span className="font-mono">{it.template}</span></>}
                    · tentativas <strong>{it.attempts}/{it.max_attempts}</strong>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Criado {fmt(it.created_at)} · Próxima tentativa {fmt(it.next_attempt_at)}{it.sent_at && <> · Enviado {fmt(it.sent_at)}</>}
                  </div>
                  {it.last_error && <div className="text-xs text-destructive break-all">{it.last_error}</div>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <StatusBadge status={it.status} />
                  <div className="flex gap-1">
                    {it.status !== "sent" && (
                      <Button size="sm" variant="secondary" className="h-7 gap-1" onClick={async () => {
                        try { await retryFn({ data: { id: it.id } }); toast.success("Reenfileirado"); qc.invalidateQueries({ queryKey: ["email-queue"] }); }
                        catch (e: any) { toast.error(e?.message ?? "Falha"); }
                      }}><RefreshCw className="h-3 w-3" /> Retry</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-destructive" onClick={async () => {
                      if (!confirm("Remover da fila?")) return;
                      try { await deleteFn({ data: { id: it.id } }); qc.invalidateQueries({ queryKey: ["email-queue"] }); }
                      catch (e: any) { toast.error(e?.message ?? "Falha"); }
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Enviado</Badge>;
  if (status === "pending") return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pendente</Badge>;
  if (status === "processing") return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20">Processando</Badge>;
  return <Badge variant="destructive">Falhou</Badge>;
}
