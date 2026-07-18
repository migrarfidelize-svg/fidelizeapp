import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminGetSupportTicket, adminReplySupportTicket, adminUpdateSupportTicket, listSupportQuickReplies, uploadSupportAttachment, getSupportAttachmentUrl } from "@/lib/support.functions";
import { AttachmentPicker, type Attachment } from "@/components/AttachmentPicker";
import { AttachmentList, type AttachmentRef } from "@/components/AttachmentList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Send, Zap, Lock, EyeOff, Building2, User, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/suporte/$id")({
  head: () => ({ meta: [{ title: "Ticket — Admin" }] }),
  component: AdminTicket,
});

const STATUS = ["open","in_progress","waiting_customer","answered","resolved","closed"] as const;
const PRIORITIES = ["low","normal","high","urgent"] as const;
const STATUS_LABEL: Record<string,string> = {
  open: "Aberto", in_progress: "Em atendimento", waiting_customer: "Aguardando cliente",
  answered: "Respondido", resolved: "Resolvido", closed: "Fechado",
};

function AdminTicket() {
  const { id } = useParams({ from: "/_authenticated/admin/suporte/$id" });
  const qc = useQueryClient();
  const getFn = useServerFn(adminGetSupportTicket);
  const replyFn = useServerFn(adminReplySupportTicket);
  const updFn = useServerFn(adminUpdateSupportTicket);
  const uploadFn = useServerFn(uploadSupportAttachment);
  const signFn = useServerFn(getSupportAttachmentUrl);
  const qrFn = useServerFn(listSupportQuickReplies);

  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["adm-support-ticket", id],
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: 15000,
  });
  const { data: quickReplies } = useQuery({ queryKey: ["support-qr"], queryFn: () => qrFn() });

  useEffect(() => {
    const ch = supabase.channel(`adm-support-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["adm-support-ticket", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["adm-support-ticket", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages.length]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="p-8 text-center">Ticket não encontrado. <Link to="/admin/suporte" className="text-primary underline">Voltar</Link></div>;

  const { ticket, messages, history, establishment } = data;

  async function send() {
    if (reply.trim().length < 1) return;
    setBusy(true);
    try {
      await replyFn({ data: { ticket_id: id, message: reply, internal, attachments: atts } });
      setReply(""); setAtts([]); setInternal(false);
      qc.invalidateQueries({ queryKey: ["adm-support-ticket", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally { setBusy(false); }
  }

  async function update(patch: { status?: string; priority?: string; }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updFn({ data: { ticket_id: id, ...(patch as any) } });
      qc.invalidateQueries({ queryKey: ["adm-support-ticket", id] });
      qc.invalidateQueries({ queryKey: ["adm-support"] });
      toast.success("Atualizado");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha"); }
  }

  function applyTemplate(body: string) {
    setReply(prev => prev ? `${prev}\n${body}` : body);
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-4">
        <Link to="/admin/suporte" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{ticket.protocol}</span>
            <Badge variant="secondary">{STATUS_LABEL[ticket.status]}</Badge>
            <Badge variant="outline">{ticket.priority}</Badge>
            <Badge variant="outline">{ticket.category}</Badge>
          </div>
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <div className="text-xs text-muted-foreground mt-1">Aberto em {new Date(ticket.created_at).toLocaleString("pt-BR")}</div>
        </div>

        <div className="space-y-3">
          {messages.map(m => {
            const admin = m.sender_type === "admin";
            const system = m.sender_type === "system";
            if (system) {
              return <div key={m.id} className="text-center text-xs text-muted-foreground py-1">{m.message}</div>;
            }
            return (
              <div key={m.id} className={`flex ${admin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  m.is_internal ? "bg-yellow-50 border border-yellow-300" :
                  admin ? "bg-primary text-primary-foreground" : "bg-card border"
                }`}>
                  <div className={`text-xs mb-1 flex items-center gap-1 ${admin && !m.is_internal ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {m.is_internal && <EyeOff className="h-3 w-3" />}
                    {m.sender_name ?? (admin ? "Equipe" : "Cliente")} · {new Date(m.created_at).toLocaleString("pt-BR")}
                    {m.is_internal && <span className="text-yellow-800 font-medium">· Nota interna</span>}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{m.message}</div>
                  <AttachmentList items={(m.attachments as unknown as AttachmentRef[]) ?? []} signer={(a) => signFn({ data: a })} />
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-3">
          {ticket.status === "closed" ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Lock className="h-4 w-4" /> Ticket fechado.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Select onValueChange={(v) => { const item = (quickReplies ?? []).find(q => q.id === v); if (item) applyTemplate(item.body); }}>
                  <SelectTrigger className="w-64"><SelectValue placeholder={<span className="inline-flex items-center gap-1"><Zap className="h-3 w-3" />Inserir modelo…</span>} /></SelectTrigger>
                  <SelectContent>
                    {(quickReplies ?? []).map(q => <SelectItem key={q.id} value={q.id}>{q.shortcut} — {q.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                  <EyeOff className="h-4 w-4" /> Nota interna (não visível ao cliente)
                </label>
              </div>
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4}
                placeholder={internal ? "Anotação interna para a equipe…" : "Escreva a resposta ao cliente…"} maxLength={10000} />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <AttachmentPicker value={atts} onChange={setAtts} upload={(a) => uploadFn({ data: a })} />
                <Button onClick={send} disabled={busy || !reply.trim()}>
                  <Send className="h-4 w-4 mr-1" />{busy ? "Enviando…" : internal ? "Salvar nota" : "Responder cliente"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="space-y-3">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm">Gerenciar</h3>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={ticket.status} onValueChange={(v) => update({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridade</Label>
            <Select value={ticket.priority} onValueChange={(v) => update({ priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <h3 className="font-semibold text-sm">Solicitante</h3>
          <div className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{ticket.requester_name ?? "—"}</div>
          <div className="text-sm flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{ticket.requester_email}</div>
          {establishment && (
            <div className="text-sm flex items-center gap-2 pt-2 border-t">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Link to="/admin/empresa/$id" params={{ id: establishment.id }} className="text-primary hover:underline">
                {establishment.name}
              </Link>
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-semibold text-sm mb-2">Histórico</h3>
            <ul className="space-y-2 text-xs text-muted-foreground max-h-64 overflow-auto">
              {history.map(h => (
                <li key={h.id}>
                  <div className="text-foreground">{STATUS_LABEL[h.from_status ?? ""] ?? h.from_status ?? "—"} → {STATUS_LABEL[h.to_status] ?? h.to_status}</div>
                  <div>{new Date(h.created_at).toLocaleString("pt-BR")}{h.reason ? ` · ${h.reason}` : ""}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
