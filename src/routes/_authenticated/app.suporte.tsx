import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { LifeBuoy as HeroIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listTickets, getTicket, agentReply, updateTicket, helpdeskDashboard, listQuickReplies, saveQuickReply, deleteQuickReply, uploadTicketAttachment } from "@/lib/helpdesk.functions";
import { AttachmentPicker, type Attachment } from "@/components/AttachmentPicker";
import { AttachmentList, type AttachmentRef } from "@/components/AttachmentList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Ticket, Clock, CheckCircle2, Star, Send, Lock, Zap, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/app/suporte")({
  head: () => ({ meta: [{ title: "Suporte — Fidelize" }] }),
  component: AgentInbox,
});

const priorityColor: Record<string, string> = { low: "bg-gray-100 text-gray-700", normal: "bg-blue-100 text-blue-800", high: "bg-orange-100 text-orange-800", urgent: "bg-red-100 text-red-800" };
const statusLabel: Record<string, string> = { open: "Aberto", pending: "Aguarda cliente", on_hold: "Em análise", solved: "Resolvido", closed: "Fechado" };

function AgentInbox() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const listFn = useServerFn(listTickets);
  const dashFn = useServerFn(helpdeskDashboard);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; name: string } | undefined;

  const [status, setStatus] = useState<"open"|"pending"|"on_hold"|"solved"|"closed"|"all">("open");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const { data: tickets } = useQuery({
    queryKey: ["hd-tickets", est?.id, status, q],
    queryFn: () => listFn({ data: { establishment_id: est!.id, status, q, assigned_to_me: false } }),
    enabled: !!est, refetchInterval: 15000,
  });

  const { data: dash } = useQuery({
    queryKey: ["hd-dash", est?.id],
    queryFn: () => dashFn({ data: { establishment_id: est!.id } }),
    enabled: !!est,
  });

  if (!est) return <div className="text-center text-muted-foreground py-12">Selecione uma empresa</div>;

  return (
    <div>
      <PageHero
        icon={HeroIcon}
        eyebrow={"Suporte · Tickets"}
        title={"Meu suporte"}
        subtitle={"Abra e acompanhe chamados com o time Fidelize em tempo real."}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Central de Suporte</h1>
          <p className="text-sm text-muted-foreground">Tickets, base de conhecimento e métricas.</p>
        </div>
        <Link to="/app/kb"><Button variant="outline">Base de conhecimento</Button></Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4 mb-6">
        <Metric label="Chamados (30d)" value={dash?.total ?? 0} icon={Ticket} />
        <Metric label="Abertos" value={dash?.open ?? 0} icon={Clock} accent="text-blue-600" />
        <Metric label="TMR médio" value={dash ? `${dash.tmrMinutes}min` : "—"} icon={Clock} accent="text-orange-600" />
        <Metric label="CSAT" value={dash?.csat ? `${dash.csat}%` : "—"} icon={Star} accent="text-green-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <Input placeholder="Buscar assunto…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <TabsList className="grid grid-cols-4 w-full h-8">
                <TabsTrigger value="open" className="text-xs">Abertos</TabsTrigger>
                <TabsTrigger value="pending" className="text-xs">Aguarda</TabsTrigger>
                <TabsTrigger value="solved" className="text-xs">Resolvidos</TabsTrigger>
                <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {!tickets?.length && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum ticket</div>}
            {tickets?.map(t => (
              <button key={t.id} onClick={() => setSelected(t.id)} className={`w-full text-left p-3 hover:bg-muted/50 ${selected === t.id ? "bg-primary-soft/40" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">#{t.number}</div>
                  <Badge className={priorityColor[t.priority] ?? ""} variant="secondary">{t.priority}</Badge>
                </div>
                <div className="mt-1 font-medium text-sm line-clamp-1">{t.subject}</div>
                <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{t.requester_name ?? t.requester_email}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{new Date(t.updated_at).toLocaleString("pt-BR")}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          {selected ? <TicketDetail id={selected} establishmentId={est.id} onChange={() => qc.invalidateQueries({ queryKey: ["hd-tickets"] })} /> : (
            <div className="rounded-2xl border bg-card grid place-items-center h-[70vh] text-muted-foreground text-sm">Selecione um chamado</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: typeof Ticket; accent?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function TicketDetail({ id, establishmentId, onChange }: { id: string; establishmentId: string; onChange: () => void }) {
  const qc = useQueryClient();
  const fetchTicket = useServerFn(getTicket);
  const reply = useServerFn(agentReply);
  const update = useServerFn(updateTicket);
  const upload = useServerFn(uploadTicketAttachment);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const { data } = useQuery({ queryKey: ["hd-ticket", id], queryFn: () => fetchTicket({ data: { id } }), refetchInterval: 15000 });

  if (!data) return <LoadingSkeleton variant="page" />;
  const { ticket, messages } = data;

  async function send() {
    if (!body.trim() && attachments.length === 0) return;
    try {
      await reply({ data: { ticket_id: id, body: body.trim() || "(anexo)", internal, attachments } });
      setBody(""); setAttachments([]);
      qc.invalidateQueries({ queryKey: ["hd-ticket", id] });
      onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function change(patch: { ticket_id: string; status?: "open"|"pending"|"on_hold"|"solved"|"closed"; priority?: "low"|"normal"|"high"|"urgent"; assigned_to?: string | null; tags?: string[] }) {
    try { await update({ data: patch }); qc.invalidateQueries({ queryKey: ["hd-ticket", id] }); onChange(); toast.success("Atualizado"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="rounded-2xl border bg-card">
      <div className="p-4 border-b flex flex-wrap items-center gap-2 justify-between">
        <div>
          <div className="text-xs text-muted-foreground">#{ticket.number} · {ticket.requester_name ?? ticket.requester_email}</div>
          <h2 className="text-lg font-bold">{ticket.subject}</h2>
        </div>
        <div className="flex gap-2">
          <Select value={ticket.status} onValueChange={(v) => change({ ticket_id: id, status: v as "open"|"pending"|"on_hold"|"solved"|"closed" })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(statusLabel).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ticket.priority} onValueChange={(v) => change({ ticket_id: id, priority: v as "low"|"normal"|"high"|"urgent" })}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          {ticket.status !== "solved" && (
            <Button variant="outline" size="icon" aria-label="Marcar como resolvido" onClick={() => change({ ticket_id: id, status: "solved" })} title="Resolver">
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`p-3 rounded-xl border ${m.internal ? "bg-yellow-50 border-yellow-200" : m.author_type === "agent" ? "bg-primary-soft/30" : "bg-background"}`}>
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
              <span>{m.author_type === "agent" ? "Agente" : "Cliente"} · {new Date(m.created_at).toLocaleString("pt-BR")}</span>
              {m.internal && <Badge variant="secondary" className="text-[10px]"><Lock className="h-2.5 w-2.5 mr-1" />Interno</Badge>}
            </div>
            <div className="text-sm whitespace-pre-wrap">{m.body}</div>
            <AttachmentList items={((m as { attachments?: AttachmentRef[] | null }).attachments) ?? []} />
          </div>
        ))}
      </div>

      <div className="border-t p-3 space-y-2">
        <QuickReplies establishmentId={establishmentId} onPick={(t) => setBody((b) => b ? `${b}\n${t}` : t)} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={internal ? "Nota interna (não visível para o cliente)…" : "Escreva sua resposta…"} rows={3} />
        <AttachmentPicker value={attachments} onChange={setAttachments} upload={(args) => upload({ data: { ticket_id: id, ...args } })} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Nota interna
          </label>
          <Button onClick={send} disabled={!body.trim() && attachments.length === 0}><Send className="h-4 w-4 mr-2" />Enviar</Button>
        </div>
      </div>
    </div>
  );
}

function QuickReplies({ establishmentId, onPick }: { establishmentId: string; onPick: (body: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listQuickReplies);
  const saveFn = useServerFn(saveQuickReply);
  const delFn = useServerFn(deleteQuickReply);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [shortcut, setShortcut] = useState("");
  const { data: replies } = useQuery({
    queryKey: ["hd-quick", establishmentId],
    queryFn: () => listFn({ data: { establishment_id: establishmentId } }),
  });

  async function save() {
    if (!title.trim() || !body.trim()) { toast.error("Preencha título e mensagem"); return; }
    try {
      await saveFn({ data: { establishment_id: establishmentId, title: title.trim(), body: body.trim(), shortcut: shortcut.trim() || undefined } });
      setTitle(""); setBody(""); setShortcut("");
      qc.invalidateQueries({ queryKey: ["hd-quick", establishmentId] });
      toast.success("Resposta rápida salva");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta resposta rápida?")) return;
    await delFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["hd-quick", establishmentId] });
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
      {replies?.length ? replies.slice(0, 6).map(r => (
        <button key={r.id} type="button" onClick={() => onPick(r.body)} title={r.body}
          className="text-xs px-2 py-1 rounded-full border bg-muted hover:bg-primary-soft/50">
          {r.title}
        </button>
      )) : <span className="text-xs text-muted-foreground">Sem respostas rápidas</span>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"><Plus className="h-3 w-3 mr-1" />Gerenciar</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Respostas rápidas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {replies?.map(r => (
                <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg border p-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{r.body}</div>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Excluir resposta rápida" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {!replies?.length && <div className="text-xs text-muted-foreground">Nenhuma cadastrada ainda.</div>}
            </div>
            <div className="border-t pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Boas-vindas" /></div>
                <div><Label className="text-xs">Atalho (opcional)</Label><Input value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="/oi" /></div>
              </div>
              <div><Label className="text-xs">Mensagem</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Olá! Obrigado pelo contato…" /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
