import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetEstablishmentDetail, adminSetEstablishmentActive, adminSetEstablishmentPlan, adminReportPaymentFailure, adminDemoteMemberToCustomer } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Ban, CheckCircle2, ExternalLink, AlertTriangle, Download, Users, Stamp, Gift, UserPlus, UserMinus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { formatDate } from "@/lib/format";
import { downloadCSV, downloadPDF } from "@/lib/export";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/hash/empresa/$id")({
  component: EmpresaDetail,
});

const PLAN_LABEL: Record<string, string> = { free: "Gratuito", starter: "Starter", pro: "Pro", enterprise: "Enterprise" };
const EVENT_LABEL: Record<string, string> = { upgrade: "Upgrade", downgrade: "Downgrade", cancel: "Cancelamento", reactivate: "Reativação", payment_failed: "Falha de pagamento", plan_change: "Mudança de plano" };
const EVENT_STYLE: Record<string, string> = { upgrade: "bg-success/10 text-success", downgrade: "bg-warning/10 text-warning", cancel: "bg-destructive/10 text-destructive", reactivate: "bg-success/10 text-success", payment_failed: "bg-destructive/10 text-destructive", plan_change: "bg-primary-soft text-primary" };

function EmpresaDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(adminGetEstablishmentDetail);
  const setActive = useServerFn(adminSetEstablishmentActive);
  const setPlan = useServerFn(adminSetEstablishmentPlan);
  const reportFail = useServerFn(adminReportPaymentFailure);
  const demoteFn = useServerFn(adminDemoteMemberToCustomer);

  const { data, isLoading } = useQuery({ queryKey: ["admin-est-detail", id], queryFn: () => fn({ data: { establishment_id: id } }) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-est-detail", id] });

  const toggle = useMutation({
    mutationFn: (active: boolean) => setActive({ data: { establishment_id: id, active } }),
    onSuccess: () => { toast.success("Status atualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });
  const changePlan = useMutation({
    mutationFn: (plan: "free" | "starter" | "pro" | "enterprise") => setPlan({ data: { establishment_id: id, plan } }),
    onSuccess: () => { toast.success("Plano atualizado"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });
  const flag = useMutation({
    mutationFn: () => reportFail({ data: { establishment_id: id, message: "Falha de pagamento reportada manualmente" } }),
    onSuccess: () => { toast.success("Falha registrada"); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });
  const demote = useMutation({
    mutationFn: (user_id: string) => demoteFn({ data: { establishment_id: id, user_id } }),
    onSuccess: (r: any) => {
      toast.success(r?.profile_updated
        ? "Acesso removido. Usuário agora vai para /carteira no próximo login."
        : "Acesso removido desta empresa. Usuário ainda é lojista em outra empresa.");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  if (isLoading || !data) return <LoadingSkeleton variant="page" />;
  const { establishment: e, metrics, series, events, audits, campaigns, members } = data;

  function exportCSV() {
    downloadCSV(`fidelize-${e.slug}-metricas-30d.csv`,
      ["Métrica","Valor"],
      [["Empresa", e.name], ["Slug", e.slug], ["Plano", PLAN_LABEL[e.plan] ?? e.plan], ["Status", e.active ? "Ativa" : "Bloqueada"], ["Clientes totais", metrics.customersTotal], ["Novos clientes (30d)", metrics.customersNew30], ["Carimbos totais", metrics.stampsTotal], ["Carimbos (30d)", metrics.stamps30], ["Recompensas resgatadas (30d)", metrics.rewards30], ["Cadastrada em", formatDate(e.created_at)]]
    );
  }
  function exportPDF() {
    downloadPDF(`fidelize-${e.slug}-metricas-30d.pdf`, `${e.name} — Métricas (30 dias)`,
      ["Data","Carimbos"], series.map(s => [s.day, s.carimbos]),
      `Plano ${PLAN_LABEL[e.plan] ?? e.plan} · ${metrics.customersTotal} clientes · ${metrics.stamps30} carimbos nos últimos 30 dias`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button onClick={() => navigate({ to: "/hash/empresas" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"><ArrowLeft className="h-3 w-3" /> Empresas</button>
          <h1 className="font-display text-3xl font-bold">{e.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
            <span>/{e.slug}</span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${e.active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{e.active ? "Ativa" : "Bloqueada"}</span>
            <Link to="/cartao/$slug" params={{ slug: e.slug }} target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline text-xs"><ExternalLink className="h-3 w-3" /> página pública</Link>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-2 h-4 w-4" />CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button>
          {e.active
            ? <Button variant="outline" size="sm" onClick={() => toggle.mutate(false)}><Ban className="mr-2 h-4 w-4" />Bloquear</Button>
            : <Button variant="outline" size="sm" onClick={() => toggle.mutate(true)}><CheckCircle2 className="mr-2 h-4 w-4" />Desbloquear</Button>}
          <Button variant="outline" size="sm" onClick={() => flag.mutate()}><AlertTriangle className="mr-2 h-4 w-4" />Reportar falha de pagamento</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} label="Clientes totais" value={metrics.customersTotal} />
        <MetricCard icon={UserPlus} label="Novos (30d)" value={metrics.customersNew30} />
        <MetricCard icon={Stamp} label="Carimbos (30d)" value={metrics.stamps30} />
        <MetricCard icon={Gift} label="Recompensas (30d)" value={metrics.rewards30} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">Carimbos nos últimos 30 dias</h3>
              <span className="text-xs text-muted-foreground">Total: {metrics.stamps30}</span>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="carimbos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Assinatura</div>
              <div className="mt-1 font-display text-2xl font-bold">{PLAN_LABEL[e.plan] ?? e.plan}</div>
              <div className="mt-2">
                <Select value={e.plan} onValueChange={(v) => changePlan.mutate(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["free","starter","pro","enterprise"] as const).map(p => <SelectItem key={p} value={p}>{PLAN_LABEL[p]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="pt-4 border-t space-y-1 text-sm">
              <div className="text-muted-foreground text-xs uppercase tracking-wider">Contato</div>
              <div>{e.email ?? "—"}</div>
              <div className="text-muted-foreground">{e.phone ?? "—"}</div>
              <div className="text-muted-foreground text-xs mt-2">Desde {formatDate(e.created_at)}</div>
              <div className="text-muted-foreground text-xs">{members.filter((m: any) => m.active).length} membros ativos · {campaigns.filter((c: any) => c.active).length} campanhas</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-display font-semibold">Eventos de assinatura</h3>
            <p className="text-xs text-muted-foreground">Últimos 30 registros</p>
            <div className="mt-4 space-y-2 max-h-96 overflow-auto pr-1">
              {events.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Sem eventos registrados.</div>}
              {events.map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ${EVENT_STYLE[ev.event_type] ?? "bg-muted"}`}>{EVENT_LABEL[ev.event_type] ?? ev.event_type}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">{ev.message ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{new Date(ev.created_at).toLocaleString("pt-BR")}{ev.from_plan && ev.to_plan ? ` · ${ev.from_plan} → ${ev.to_plan}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="font-display font-semibold">Auditoria</h3>
            <p className="text-xs text-muted-foreground">Ações administrativas nesta empresa</p>
            <div className="mt-4 space-y-2 max-h-96 overflow-auto pr-1">
              {audits.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Sem registros.</div>}
              {audits.map((a: any) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/40">
                  <div className="text-sm font-medium">{a.action}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString("pt-BR")}</div>
                  {a.metadata && Object.keys(a.metadata).length > 0 && (
                    <pre className="mt-1 text-[11px] text-muted-foreground overflow-x-auto">{JSON.stringify(a.metadata, null, 0)}</pre>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-display font-semibold">Membros desta empresa</h3>
              <p className="text-xs text-muted-foreground">Remover o acesso rebaixa o usuário para /carteira quando ele não tiver outro vínculo ativo.</p>
            </div>
            <span className="text-xs text-muted-foreground">{members.filter((m: any) => m.active).length} ativo(s) · {members.length} no total</span>
          </div>
          <div className="mt-4 divide-y">
            {members.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Nenhum membro registrado.</div>}
            {members.map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 py-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{m.display_name || m.full_name || m.invited_email || m.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="uppercase tracking-wider">{m.role}</span>
                    <span>·</span>
                    <span>Conta: {m.account_type}</span>
                    <span>·</span>
                    <span className={m.active ? "text-success" : "text-destructive"}>{m.active ? "ativo" : "removido"}</span>
                  </div>
                </div>
                {m.active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={demote.isPending}
                    onClick={() => {
                      if (confirm(`Remover acesso de lojista deste usuário? Ele será enviado para /carteira no próximo login se não tiver outro vínculo ativo.`)) {
                        demote.mutate(m.user_id);
                      }
                    }}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />Remover acesso
                  </Button>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-muted text-muted-foreground">Sem acesso</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 font-display text-3xl font-bold">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}
