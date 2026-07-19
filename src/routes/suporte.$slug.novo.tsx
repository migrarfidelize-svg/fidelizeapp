import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { createTicket, getHelpCenter, uploadDraftAttachment } from "@/lib/helpdesk.functions";
import { AttachmentPicker, type Attachment } from "@/components/AttachmentPicker";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  subject: z.string().trim().min(4, "Descreva melhor o assunto"),
  body: z.string().trim().min(10, "Conte mais detalhes"),
  priority: z.enum(["low","normal","high","urgent"]),
});

export const Route = createFileRoute("/suporte/$slug/novo")({
  validateSearch: (s: Record<string, unknown>) => ({ assunto: (s.assunto as string) || "" }),
  loader: ({ params }) => getHelpCenter({ data: { slug: params.slug } }),
  head: () => ({ meta: [{ title: "Abrir chamado" }] }),
  component: NewTicket,
});

function NewTicket() {
  const data = Route.useLoaderData();
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const create = useServerFn(createTicket);
  const uploadDraft = useServerFn(uploadDraftAttachment);
  const [session, setSession] = useState<{ email: string } | null | undefined>(undefined);
  const [subject, setSubject] = useState(search.assunto);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<"low"|"normal"|"high"|"urgent">("normal");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSession(data.user ? { email: data.user.email ?? "" } : null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s?.user ? { email: s.user.email ?? "" } : null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    const parsed = schema.safeParse({ subject, body, priority });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    try {
      const t = await create({ data: { establishment_slug: params.slug, subject, body, priority, channel: "form", name: name || undefined, attachments } });
      toast.success(`Chamado #${t.number} aberto!`);
      navigate({ to: "/suporte/chamado/$id", params: { id: t.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir chamado");
    } finally { setSubmitting(false); }
  }

  if (session === undefined) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-4">
          <Link to="/suporte/$slug" params={params} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {data?.establishment.name}</Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold">Abrir chamado</h1>
        <p className="mt-2 text-muted-foreground">Nossa equipe responde no menor tempo possível.</p>

        {session === null ? (
          <div className="mt-8 rounded-2xl border p-6 bg-card text-center">
            <p className="text-sm text-muted-foreground mb-4">Entre com sua conta para abrir e acompanhar seus chamados.</p>
            <Link to="/auth"><Button>Entrar / Criar conta</Button></Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div>
              <Label>Seu nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como devemos te chamar?" />
            </div>
            <div>
              <Label>Assunto *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumo do problema" maxLength={150} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Conte com detalhes o que aconteceu…" rows={8} maxLength={5000} />
              <div className="text-xs text-muted-foreground mt-1">{body.length}/5000</div>
            </div>
            <div>
              <Label>Anexos</Label>
              <AttachmentPicker
                value={attachments}
                onChange={setAttachments}
                upload={(args) => uploadDraft({ data: args })}
              />
            </div>
            <Button onClick={submit} disabled={submitting} size="lg" className="w-full">{submitting ? "Enviando…" : "Enviar chamado"}</Button>
          </div>
        )}
      </main>
    </div>
  );
}
