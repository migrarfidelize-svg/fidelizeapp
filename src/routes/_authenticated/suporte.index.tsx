import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMySupportTickets, createSupportTicket } from "@/lib/support.functions";
import { uploadTicketAttachment } from "@/lib/helpdesk.functions";
import { AttachmentPicker, type Attachment } from "@/components/AttachmentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { LifeBuoy, Plus, ArrowRight, Circle, CheckCircle2, Clock, MessageCircle, MailQuestion } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suporte/")({
  head: () => ({ meta: [{ title: "Central de Suporte — Fidelize" }] }),
  component: SupportInbox,
});

const CATEGORY_LABEL: Record<string, string> = {
  duvidas: "Dúvidas sobre a plataforma", tecnico: "Problema técnico", carimbos: "Carimbos e cartões",
  clientes: "Clientes", qrcode: "QR Code", campanhas: "Campanhas",
  pagamentos: "Pagamentos e assinatura", conta: "Conta e acesso", sugestao: "Sugestão", outro: "Outro",
};

const STATUS: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  open:             { label: "Aberto",                 color: "bg-blue-100 text-blue-800",   icon: Circle },
  in_progress:      { label: "Em atendimento",         color: "bg-indigo-100 text-indigo-800", icon: Clock },
  waiting_customer: { label: "Aguardando sua resposta",color: "bg-amber-100 text-amber-800", icon: MailQuestion },
  answered:         { label: "Respondido",             color: "bg-emerald-100 text-emerald-800", icon: MessageCircle },
  resolved:         { label: "Resolvido",              color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  closed:           { label: "Fechado",                color: "bg-gray-100 text-gray-700",   icon: CheckCircle2 },
};

function SupportInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMySupportTickets);
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["my-support-tickets"],
    queryFn: () => listFn(),
    refetchInterval: 20000,
  });

  useEffect(() => {
    const ch = supabase.channel("my-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <header className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-white/20 p-3"><LifeBuoy className="h-7 w-7" /></div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Central de Suporte</h1>
              <p className="text-primary-foreground/90 text-sm mt-1">
                Precisa de ajuda? Abra um chamado e acompanhe todas as respostas da nossa equipe.
              </p>
            </div>
            <NewTicketDialog />
          </div>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-3">Meus tickets</h2>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
          ) : !tickets?.length ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Você ainda não abriu nenhum ticket. Clique em <strong>Abrir novo ticket</strong> para começar.
            </div>
          ) : (
            <ul className="space-y-2">
              {tickets.map(t => {
                const s = STATUS[t.status] ?? STATUS.open;
                const Icon = s.icon;
                return (
                  <li key={t.id}>
                    <Link to="/suporte/$id" params={{ id: t.id }}
                      className="block rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">{t.protocol}</span>
                            {t.has_unread_customer && (
                              <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" aria-label="Nova resposta" />
                            )}
                            <Badge className={s.color} variant="secondary">
                              <Icon className="h-3 w-3 mr-1" />{s.label}
                            </Badge>
                          </div>
                          <div className="font-medium mt-1 truncate">{t.subject}</div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>{CATEGORY_LABEL[t.category] ?? t.category}</span>
                            <span>· Aberto {new Date(t.created_at).toLocaleDateString("pt-BR")}</span>
                            <span>· Atualizado {new Date(t.updated_at).toLocaleString("pt-BR")}</span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function NewTicketDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createSupportTicket);
  const uploadFn = useServerFn(uploadTicketAttachment);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("duvidas");
  const [priority, setPriority] = useState<"low"|"normal"|"high">("normal");
  const [body, setBody] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (subject.trim().length < 4) { toast.error("Descreva o assunto (mín. 4 caracteres)"); return; }
    if (body.trim().length < 4) { toast.error("Descreva o problema (mín. 4 caracteres)"); return; }
    setBusy(true);
    try {
      await createFn({ data: { subject, category: category as "outro", priority, body, attachments: atts } });
      toast.success("Ticket aberto com sucesso. Nossa equipe responderá por aqui.");
      qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
      setOpen(false); setSubject(""); setBody(""); setAtts([]); setCategory("duvidas"); setPriority("normal");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar ticket");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="shrink-0 bg-white text-primary hover:bg-white/90">
          <Plus className="h-4 w-4 mr-1" />Abrir novo ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Abrir novo ticket</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="Descreva brevemente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low"|"normal"|"high")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição detalhada</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={6}
              placeholder="Conte o que aconteceu, quando começou e passos que reproduzem o problema…" />
          </div>
          <div>
            <Label>Anexos (opcional, máx. 5)</Label>
            <AttachmentPicker value={atts} onChange={setAtts} upload={(a) => uploadFn({ data: a })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Abrindo…" : "Abrir ticket"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
