import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Headphones as HeroIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminListSupportTickets, adminSupportDashboard, listSupportQuickReplies, saveSupportQuickReply, deleteSupportQuickReply } from "@/lib/support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Ticket, Clock, AlertTriangle, CheckCircle2, MessageSquare, Zap, Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/suporte/")({
  head: () => ({ meta: [{ title: "Suporte — Administração" }] }),
  component: AdminSupport,
});

const CATEGORY_LABEL: Record<string, string> = {
  duvidas: "Dúvidas", tecnico: "Técnico", carimbos: "Carimbos", clientes: "Clientes",
  qrcode: "QR Code", campanhas: "Campanhas", pagamentos: "Pagamentos", conta: "Conta",
  sugestao: "Sugestão", outro: "Outro",
};
const STATUS: Record<string, { label: string; color: string }> = {
  open:             { label: "Aberto", color: "bg-blue-100 text-blue-800" },
  in_progress:      { label: "Em atendimento", color: "bg-indigo-100 text-indigo-800" },
  waiting_customer: { label: "Aguardando cliente", color: "bg-amber-100 text-amber-800" },
  answered:         { label: "Respondido", color: "bg-emerald-100 text-emerald-800" },
  resolved:         { label: "Resolvido", color: "bg-green-100 text-green-800" },
  closed:           { label: "Fechado", color: "bg-gray-100 text-gray-700" },
};
const PRIORITY: Record<string, string> = {
  low: "bg-gray-100 text-gray-700", normal: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800", urgent: "bg-red-100 text-red-800",
};

function AdminSupport() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListSupportTickets);
  const dashFn = useServerFn(adminSupportDashboard);

  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [assigned, setAssigned] = useState<"all"|"me"|"unassigned">("all");
  const [q, setQ] = useState("");

  const { data: dash } = useQuery({ queryKey: ["adm-support-dash"], queryFn: () => dashFn(), refetchInterval: 30000 });
  const { data: tickets } = useQuery({
    queryKey: ["adm-support", status, priority, category, assigned, q],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: () => listFn({ data: { status: status as any, priority: priority as any, category: category as any, assigned, q } }),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const ch = supabase.channel("adm-support-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["adm-support"] });
        qc.invalidateQueries({ queryKey: ["adm-support-dash"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Suporte"}
        title={"Suporte global"}
        subtitle={"Todos os tickets abertos por lojistas e clientes finais em um só painel."}
      />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Suporte da Plataforma</h1>
          <p className="text-sm text-muted-foreground">Tickets enviados pelas empresas cadastradas.</p>
        </div>
        <QuickRepliesDialog />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Ticket}   label="Abertos"                value={dash?.open ?? 0} tone="blue" />
        <Kpi icon={Clock}    label="Em atendimento"         value={dash?.in_progress ?? 0} tone="indigo" />
        <Kpi icon={MessageSquare} label="Aguardando cliente" value={dash?.waiting_customer ?? 0} tone="amber" />
        <Kpi icon={CheckCircle2} label="Respondidos hoje"   value={dash?.responded_today ?? 0} tone="emerald" />
        <Kpi icon={CheckCircle2} label="Resolvidos"         value={dash?.resolved ?? 0} tone="green" />
        <Kpi icon={AlertTriangle} label="Atrasados (>24h)"  value={dash?.overdue ?? 0} tone="red" />
        <Kpi icon={Clock}    label="1ª resposta (média)"    value={`${dash?.avg_first_response_min ?? 0}min`} tone="indigo" />
        <Kpi icon={Clock}    label="Resolução (média)"      value={`${Math.round((dash?.avg_resolution_min ?? 0)/60)}h`} tone="indigo" />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap gap-2 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar protocolo, assunto ou e-mail…" className="pl-9" />
        </div>
        <FilterSelect label="Status" value={status} onChange={setStatus} options={[
          { v: "all", l: "Todos" }, { v: "unanswered", l: "Sem resposta" }, { v: "overdue", l: "Atrasados" },
          ...Object.entries(STATUS).map(([v, s]) => ({ v, l: s.label })),
        ]} />
        <FilterSelect label="Prioridade" value={priority} onChange={setPriority} options={[
          { v: "all", l: "Todas" }, { v: "urgent", l: "Urgente" }, { v: "high", l: "Alta" }, { v: "normal", l: "Normal" }, { v: "low", l: "Baixa" },
        ]} />
        <FilterSelect label="Categoria" value={category} onChange={setCategory} options={[
          { v: "all", l: "Todas" }, ...Object.entries(CATEGORY_LABEL).map(([v, l]) => ({ v, l })),
        ]} />
        <FilterSelect label="Atendente" value={assigned} onChange={(v) => setAssigned(v as "all"|"me"|"unassigned")} options={[
          { v: "all", l: "Todos" }, { v: "me", l: "Meus" }, { v: "unassigned", l: "Sem atendente" },
        ]} />
      </div>

      {/* Lista */}
      <div className="rounded-xl border bg-card divide-y">
        {(!tickets || tickets.length === 0) ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum ticket encontrado.</div>
        ) : tickets.map(t => {
          const st = STATUS[t.status] ?? STATUS.open;
          const waitingHours = Math.round((Date.now() - new Date(t.updated_at).getTime()) / 3600000);
          return (
            <Link key={t.id} to="/admin/suporte/$id" params={{ id: t.id }} className="block p-4 hover:bg-muted/30 transition">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{t.protocol}</span>
                    {t.has_unread_admin && <span className="inline-flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                    <Badge className={st.color} variant="secondary">{st.label}</Badge>
                    <Badge className={PRIORITY[t.priority]} variant="secondary">{t.priority}</Badge>
                    <Badge variant="outline">{CATEGORY_LABEL[t.category] ?? t.category}</Badge>
                  </div>
                  <div className="font-medium truncate">{t.subject}</div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{t.establishment_name ?? "—"}</span>
                    <span>· {t.requester_name ?? t.requester_email}</span>
                    <span>· {t.requester_email}</span>
                    <span>· Última atualização há {waitingHours}h</span>
                    {!t.first_response_at && <span className="text-amber-700">· Sem resposta</span>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Ticket; label: string; value: number|string; tone: string }) {
  const bg: Record<string,string> = {
    blue: "bg-blue-100 text-blue-800", indigo: "bg-indigo-100 text-indigo-800",
    amber: "bg-amber-100 text-amber-800", emerald: "bg-emerald-100 text-emerald-800",
    green: "bg-green-100 text-green-800", red: "bg-red-100 text-red-800",
  };
  return (
    <div className="rounded-xl border bg-card p-3 flex items-center gap-3">
      <div className={`rounded-lg p-2 ${bg[tone]}`}><Icon className="h-4 w-4" /></div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold">{value}</div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="min-w-[150px]">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function QuickRepliesDialog() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSupportQuickReplies);
  const saveFn = useServerFn(saveSupportQuickReply);
  const delFn = useServerFn(deleteSupportQuickReply);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ id?: string; shortcut: string; title: string; body: string }>({ shortcut: "", title: "", body: "" });
  const { data: replies } = useQuery({ queryKey: ["support-qr"], queryFn: () => listFn(), enabled: open });

  async function save() {
    try {
      await saveFn({ data: editing });
      toast.success("Modelo salvo");
      qc.invalidateQueries({ queryKey: ["support-qr"] });
      setEditing({ shortcut: "", title: "", body: "" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
  }
  async function remove(id: string) {
    if (!confirm("Excluir modelo?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["support-qr"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Zap className="h-4 w-4 mr-1" />Modelos de resposta</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Modelos de resposta rápida</DialogTitle></DialogHeader>
        <Tabs defaultValue="list">
          <TabsList><TabsTrigger value="list">Existentes</TabsTrigger><TabsTrigger value="new">Novo / Editar</TabsTrigger></TabsList>
          <TabsContent value="list">
            <ul className="space-y-2 max-h-96 overflow-auto">
              {(replies ?? []).map(r => (
                <li key={r.id} className="rounded-lg border p-3">
                  <div className="flex justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.shortcut}</code><strong>{r.title}</strong></div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.body}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, shortcut: r.shortcut, title: r.title, body: r.body })}>Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="new" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Atalho</Label><Input value={editing.shortcut} onChange={(e) => setEditing({ ...editing, shortcut: e.target.value })} placeholder="/recebido" /></div>
              <div><Label>Título</Label><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></div>
            </div>
            <div><Label>Mensagem</Label><Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={5} /></div>
            <div className="flex justify-end gap-2">
              {editing.id && <Button variant="ghost" onClick={() => setEditing({ shortcut: "", title: "", body: "" })}>Limpar</Button>}
              <Button onClick={save}><Plus className="h-4 w-4 mr-1" />{editing.id ? "Salvar" : "Criar modelo"}</Button>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
