import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyTicket, replyToMyTicket, rateTicket, uploadTicketAttachment } from "@/lib/helpdesk.functions";
import { AttachmentPicker, type Attachment } from "@/components/AttachmentPicker";
import { AttachmentList, type AttachmentRef } from "@/components/AttachmentList";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/suporte/chamado/$id")({
  head: () => ({ meta: [{ title: "Chamado" }, { name: "robots", content: "noindex" }] }),
  component: CustomerTicket,
});

const statusLabel: Record<string, string> = { open: "Aberto", pending: "Aguardando você", on_hold: "Em análise", solved: "Resolvido", closed: "Fechado" };

function CustomerTicket() {
  const { id } = Route.useParams();
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const qc = useQueryClient();
  const fetchTicket = useServerFn(getMyTicket);
  const reply = useServerFn(replyToMyTicket);
  const rate = useServerFn(rateTicket);
  const upload = useServerFn(uploadTicketAttachment);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [rating, setRating] = useState<number>(0);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user)); }, []);
  const { data, isLoading } = useQuery({ queryKey: ["my-ticket", id], queryFn: () => fetchTicket({ data: { id } }), enabled: authed === true, refetchInterval: 15000 });

  if (authed === false) return <div className="p-8 text-center"><Link to="/auth"><Button>Entrar</Button></Link></div>;
  if (isLoading || authed === undefined) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="p-8 text-center">Chamado não encontrado</div>;
  const { ticket, messages } = data;

  async function send() {
    if (body.trim().length < 1 && attachments.length === 0) return;
    try {
      await reply({ data: { ticket_id: id, body: body.trim() || "(anexo)", attachments } });
      setBody(""); setAttachments([]);
      qc.invalidateQueries({ queryKey: ["my-ticket", id] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function submitRate(v: number) {
    setRating(v);
    try { await rate({ data: { ticket_id: id, csat: v } }); toast.success("Obrigado pela avaliação!"); } catch { /* */ }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/suporte/meus" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Meus chamados</Link>
          <Badge variant="secondary">{statusLabel[ticket.status] ?? ticket.status}</Badge>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="rounded-2xl bg-card border p-5">
          <div className="text-xs text-muted-foreground">Chamado #{ticket.number}</div>
          <h1 className="text-xl font-bold mt-1">{ticket.subject}</h1>
        </div>

        <div className="mt-4 space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`p-4 rounded-xl border ${m.author_type === "customer" ? "bg-primary-soft/40 ml-8" : "bg-card mr-8"}`}>
              <div className="text-xs text-muted-foreground mb-1">{m.author_type === "customer" ? "Você" : (m.author_name ?? "Suporte")} · {new Date(m.created_at).toLocaleString("pt-BR")}</div>
              <div className="text-sm whitespace-pre-wrap">{m.body}</div>
              <AttachmentList items={(m.attachments as AttachmentRef[] | null) ?? []} />
            </div>
          ))}
        </div>

        {ticket.status !== "closed" && (
          <div className="mt-6 rounded-2xl border bg-card p-4 space-y-3">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva sua resposta…" rows={4} />
            <AttachmentPicker value={attachments} onChange={setAttachments} upload={(args) => upload({ data: { ticket_id: id, ...args } })} />
            <div className="flex justify-end"><Button onClick={send} disabled={!body.trim() && attachments.length === 0}>Enviar</Button></div>
          </div>
        )}

        {(ticket.status === "solved" || ticket.status === "closed") && (
          <div className="mt-6 rounded-2xl border bg-card p-5 text-center">
            <div className="text-sm font-medium mb-3">Como você avalia esse atendimento?</div>
            <div className="flex justify-center gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => submitRate(n)} className="p-1">
                  <Star className={`h-7 w-7 ${(ticket.csat ?? rating) >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            {ticket.csat && <div className="text-xs text-muted-foreground mt-2">Obrigado!</div>}
          </div>
        )}
      </main>
    </div>
  );
}
