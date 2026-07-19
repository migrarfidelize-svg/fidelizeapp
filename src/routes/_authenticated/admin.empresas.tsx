import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListEstablishments, adminSetEstablishmentActive, adminSetEstablishmentPlan, adminDeleteEstablishment } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, MoreVertical, Ban, CheckCircle2, ExternalLink, Trash2, CreditCard, Download, BarChart3, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { downloadCSV, downloadPDF } from "@/lib/export";
import { adminReportPaymentFailure } from "@/lib/admin.functions";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/states";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/empresas")({
  component: AdminEmpresas,
});

const PLAN_LABEL: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };
const PLAN_OPTIONS = ["free", "starter", "pro", "enterprise"] as const;

function AdminEmpresas() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListEstablishments);
  const setActive = useServerFn(adminSetEstablishmentActive);
  const setPlan = useServerFn(adminSetEstablishmentPlan);
  const del = useServerFn(adminDeleteEstablishment);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [plan, setPlan_] = useState<"all" | "free" | "starter" | "pro" | "enterprise">("all");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-ests", query, status, plan],
    queryFn: () => listFn({ data: { query: query || undefined, status, plan } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-ests"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const toggleActive = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => setActive({ data: { establishment_id: v.id, active: v.active } }),
    onSuccess: (_r, v) => { toast.success(v.active ? "Empresa desbloqueada" : "Empresa bloqueada"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const changePlan = useMutation({
    mutationFn: (v: { id: string; plan: "free" | "starter" | "pro" | "enterprise" }) => setPlan({ data: { establishment_id: v.id, plan: v.plan } }),
    onSuccess: () => { toast.success("Plano atualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { establishment_id: id } }),
    onSuccess: () => { toast.success("Empresa excluída"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  const reportFail = useServerFn(adminReportPaymentFailure);
  const flagFailure = useMutation({
    mutationFn: (id: string) => reportFail({ data: { establishment_id: id, message: "Falha de pagamento reportada manualmente" } }),
    onSuccess: () => { toast.success("Falha de pagamento registrada"); qc.invalidateQueries({ queryKey: ["admin-alerts"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  function exportCSV() {
    const rows = (data ?? []).map(e => [e.name, e.slug, PLAN_LABEL[e.plan] ?? e.plan, e.active ? "Ativa" : "Bloqueada", e.owner_name ?? "", e.email ?? "", e.phone ?? "", e.customers, e.stamps, formatDate(e.created_at)]);
    downloadCSV(`fidelize-empresas-${new Date().toISOString().slice(0,10)}.csv`,
      ["Nome","Slug","Plano","Status","Responsável","Email","Telefone","Clientes","Carimbos","Cadastro"], rows);
  }
  function exportPDF() {
    const rows = (data ?? []).map(e => [e.name, PLAN_LABEL[e.plan] ?? e.plan, e.active ? "Ativa" : "Bloqueada", e.owner_name ?? "-", e.customers, e.stamps, formatDate(e.created_at)]);
    downloadPDF(`fidelize-empresas-${new Date().toISOString().slice(0,10)}.pdf`, "Empresas — Fidelize",
      ["Nome","Plano","Status","Responsável","Clientes","Carimbos","Cadastro"], rows, `Gerado em ${new Date().toLocaleString("pt-BR")} · ${(data ?? []).length} empresas`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
          <h1 className="font-display text-3xl font-bold">Empresas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie estabelecimentos, planos e acesso.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, slug ou email…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="blocked">Bloqueadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={plan} onValueChange={(v) => setPlan_(v as any)}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos planos</SelectItem>
              {PLAN_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PLAN_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-6"><LoadingSkeleton variant="list" rows={5} /></div>}
          {isError && !isLoading && (
            <div className="p-6">
              <ErrorState
                title="Falha ao carregar empresas"
                error={error}
                onRetry={() => refetch()}
              />
            </div>
          )}
          {!isLoading && !isError && (data?.length ?? 0) === 0 && (
            <div className="p-6">
              <EmptyState
                icon={Building2}
                title="Nenhuma empresa encontrada"
                description="Ajuste os filtros ou aguarde novos cadastros."
              />
            </div>
          )}
          <div className="divide-y">
            {(data ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{e.name}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-soft text-primary">{PLAN_LABEL[e.plan] ?? e.plan}</span>
                    {e.active
                      ? <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-success/10 text-success">Ativa</span>
                      : <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-destructive/10 text-destructive">Bloqueada</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">/{e.slug} · {e.owner_name ?? "sem responsável"} · desde {formatDate(e.created_at)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{e.customers} clientes · {e.stamps} carimbos</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Ações da empresa"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem asChild><Link to="/admin/empresa/$id" params={{ id: e.id }}><BarChart3 className="mr-2 h-4 w-4" />Ver detalhes</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to="/l/$slug" params={{ slug: e.slug }} target="_blank"><ExternalLink className="mr-2 h-4 w-4" />Ver página pública</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => flagFailure.mutate(e.id)}><AlertTriangle className="mr-2 h-4 w-4" />Reportar falha de pagamento</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {e.active
                      ? <DropdownMenuItem onClick={() => toggleActive.mutate({ id: e.id, active: false })}><Ban className="mr-2 h-4 w-4" />Bloquear</DropdownMenuItem>
                      : <DropdownMenuItem onClick={() => toggleActive.mutate({ id: e.id, active: true })}><CheckCircle2 className="mr-2 h-4 w-4" />Desbloquear</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-2"><CreditCard className="h-3 w-3" /> Mudar plano</div>
                    {PLAN_OPTIONS.map((p) => (
                      <DropdownMenuItem key={p} disabled={e.plan === p} onClick={() => changePlan.mutate({ id: e.id, plan: p })}>
                        {PLAN_LABEL[p]}{e.plan === p ? " (atual)" : ""}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem onSelect={(ev) => ev.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir empresa</DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir “{e.name}”?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação remove permanentemente a empresa, seus clientes, carimbos e recompensas. Não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
