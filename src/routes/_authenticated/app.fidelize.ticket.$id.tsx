import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMySupportTicket, replyMySupportTicket, uploadSupportAttachment, getSupportAttachmentUrl } from "@/lib/support.functions";
import { AttachmentPicker, type Attachment } from "@/components/AttachmentPicker";
import { AttachmentList, type AttachmentRef } from "@/components/AttachmentList";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Info, Lock } from "lucide-react";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/app/fidelize/ticket/$id")({
  head: () => ({ meta: [{ title: "Ticket — Suporte" }] }),
  component: Ticket,
});

const STATUS: Record<string, { label: string; color: string }> = {
  open:             { label: "Aberto", color: "bg-blue-100 text-blue-800" },
  in_progress:      { label: "Em atendimento", color: "bg-indigo-100 text-indigo-800" },
  waiting_customer: { label: "Aguardando sua resposta", color: "bg-amber-100 text-amber-800" },
  answered:         { label: "Respondido", color: "bg-emerald-100 text-emerald-800" },
  resolved:         { label: "Resolvido", color: "bg-green-100 text-green-800" },
  closed:           { label: "Fechado", color: "bg-gray-100 text-gray-700" },
};

function Ticket() {
  const { id } = useParams({ from: "/_authenticated/app/fidelize/ticket/$id" });
  const qc = useQueryClient();
  const getFn = useServerFn(getMySupportTicket);
  const replyFn = useServerFn(replyMySupportTicket);
  const uploadFn = useServerFn(uploadSupportAttachment);
  const signFn = useServerFn(getSupportAttachmentUrl);
  const [reply, setReply] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-support-ticket", id],
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase.channel(`support-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages", filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["my-support-ticket", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["my-support-ticket", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages.length]);

  if (isLoading) return <div className="p-8"><LoadingSkeleton variant="page" /></div>;
  if (!data) return <div className="p-8 text-center">Ticket não encontrado. <Link to="/app/fidelize" className="text-primary underline">Voltar</Link></div>;

  const { ticket, messages } = data;
  const status = STATUS[ticket.status] ?? STATUS.open;
  const canReply = ticket.status !== "closed";

  async function send() {
    if (reply.trim().length < 1) return;
    setBusy(true);
    try {
      await replyFn({ data: { ticket_id: id, message: reply, attachments: atts } });
      setReply(""); setAtts([]);
      qc.invalidateQueries({ queryKey: ["my-support-ticket", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Link to="/app/fidelize" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-muted-foreground">{ticket.protocol}</span>
                <Badge className={status.color} variant="secondary">{status.label}</Badge>
              </div>
              <h1 className="text-xl font-bold">{ticket.subject}</h1>
              <div className="text-xs text-muted-foreground mt-1">
                Aberto em {new Date(ticket.created_at).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {messages.map(m => {
            const mine = m.sender_type === "customer";
            const system = m.sender_type === "system";
            if (system) {
              return (
                <div key={m.id} className="text-center text-xs text-muted-foreground py-1">
                  <Info className="h-3 w-3 inline mr-1" />{m.message}
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${mine ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                  <div className={`text-xs mb-1 ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {mine ? "Você" : (m.sender_name ?? "Equipe de suporte")} · {new Date(m.created_at).toLocaleString("pt-BR")}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">{m.message}</div>
                  <AttachmentList items={(m.attachments as unknown as AttachmentRef[]) ?? []} signer={(a) => signFn({ data: a })} />
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="rounded-2xl border bg-card p-4 sticky bottom-4 shadow-lg">
          {canReply ? (
            <div className="space-y-3">
              <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
                placeholder="Escreva sua resposta…" maxLength={5000} />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <AttachmentPicker value={atts} onChange={setAtts} upload={(a) => uploadFn({ data: { ...a, ticket_id: id } })} />
                <Button onClick={send} disabled={busy || !reply.trim()}>
                  <Send className="h-4 w-4 mr-1" />{busy ? "Enviando…" : "Enviar resposta"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-2">
              <Lock className="h-4 w-4" /> Este ticket está fechado. Abra um novo ticket para uma nova solicitação.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
