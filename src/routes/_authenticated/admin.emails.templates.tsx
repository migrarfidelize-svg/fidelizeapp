import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  listEmailTemplates, getEmailTemplate, createEmailTemplate,
  updateEmailTemplate, deleteEmailTemplate, previewEmailTemplate, sendTemplatePreview,
} from "@/lib/email.functions";
import { getAdminStatus } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Eye, Send, Save, Code2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/emails/templates")({
  head: () => ({ meta: [{ title: "Templates de e-mail — Fidelize" }] }),
  component: TemplatesPage,
});

interface TemplateRow {
  id: string; slug: string; name: string; description: string | null;
  subject: string; variables: string[]; is_system: boolean; active: boolean; updated_at: string;
}

function TemplatesPage() {
  const qc = useQueryClient();
  const getStatus = useServerFn(getAdminStatus);
  const listFn = useServerFn(listEmailTemplates);

  const { data: admin, isLoading: adminLoading } = useQuery({ queryKey: ["admin-status"], queryFn: () => getStatus() });
  const enabled = !!admin?.isAdmin;
  const { data, isLoading } = useQuery({ queryKey: ["email-templates"], queryFn: () => listFn(), enabled });

  const [editing, setEditing] = useState<{ id?: string; open: boolean }>({ open: false });

  if (adminLoading) return <div className="text-muted-foreground">Verificando permissões…</div>;
  if (!admin?.isAdmin) return <div className="max-w-md mx-auto mt-16 p-6 rounded-xl border bg-card text-center"><h2 className="text-lg font-semibold">Acesso restrito</h2></div>;

  const templates = (data?.templates ?? []) as TemplateRow[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2"><FileText className="h-5 w-5" /> Templates de e-mail</h1>
          <p className="text-sm text-muted-foreground">Assunto, HTML, texto simples e variáveis dinâmicas <code>{"{{variavel}}"}</code>.</p>
        </div>
        <Button className="gap-2 gradient-brand text-primary-foreground" onClick={() => setEditing({ open: true })}>
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum template cadastrado.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition" onClick={() => setEditing({ id: t.id, open: true })}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      {t.name}
                      {t.is_system && <Badge variant="secondary">Sistema</Badge>}
                      {!t.active && <Badge variant="outline">Inativo</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{t.description || t.subject}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5">
                  <code className="px-1.5 py-0.5 rounded bg-muted">{t.slug}</code>
                  {(t.variables ?? []).map((v) => <code key={v} className="px-1.5 py-0.5 rounded bg-muted">{`{{${v}}}`}</code>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing.open && (
        <TemplateEditor
          id={editing.id}
          onClose={() => { setEditing({ open: false }); qc.invalidateQueries({ queryKey: ["email-templates"] }); }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ id, onClose }: { id?: string; onClose: () => void }) {
  const isEdit = !!id;
  const getFn = useServerFn(getEmailTemplate);
  const createFn = useServerFn(createEmailTemplate);
  const updateFn = useServerFn(updateEmailTemplate);
  const deleteFn = useServerFn(deleteEmailTemplate);
  const previewFn = useServerFn(previewEmailTemplate);
  const sendPreviewFn = useServerFn(sendTemplatePreview);

  const [loaded, setLoaded] = useState(!isEdit);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState('<div style="font-family:Arial;padding:24px">Olá {{name}}</div>');
  const [text, setText] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [isSystem, setIsSystem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isEdit) return;
    getFn({ data: { id: id! } }).then((row: any) => {
      setSlug(row.slug); setName(row.name); setDescription(row.description ?? "");
      setSubject(row.subject); setHtml(row.html); setText(row.text ?? "");
      setVariables(row.variables ?? []); setActive(row.active); setIsSystem(row.is_system);
      const pv: Record<string, string> = {};
      (row.variables ?? []).forEach((v: string) => { pv[v] = `[${v}]`; });
      setPreviewVars(pv);
      setLoaded(true);
    }).catch((e) => { toast.error(e?.message ?? "Falha ao carregar"); onClose(); });
  }, [id]);

  // auto-detecta variáveis usadas
  const detected = useMemo(() => {
    const set = new Set<string>();
    const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    for (const src of [subject, html, text]) {
      let m; while ((m = re.exec(src ?? ""))) set.add(m[1]);
    }
    return Array.from(set);
  }, [subject, html, text]);

  async function onSave() {
    setSaving(true);
    try {
      const payload = { slug, name, description, subject, html, text, variables: detected, active };
      if (isEdit) await updateFn({ data: { ...payload, id: id! } });
      else await createFn({ data: payload });
      toast.success("Template salvo!");
      onClose();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao salvar"); }
    finally { setSaving(false); }
  }

  async function onDelete() {
    if (!confirm("Excluir este template?")) return;
    try { await deleteFn({ data: { id: id! } }); toast.success("Excluído"); onClose(); }
    catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  async function onPreview() {
    try {
      const r = await previewFn({ data: { subject, html, text, variables: previewVars } });
      setPreviewHtml(r.html); setPreviewSubject(r.subject);
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  async function onSendTest() {
    if (!testTo) return;
    try {
      await sendPreviewFn({ data: { to: testTo, subject, html, text, variables: previewVars, template: slug } });
      toast.success("Prévia enviada!");
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>
        {!loaded ? <div className="text-muted-foreground">Carregando…</div> : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Slug (chave)</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={isSystem} placeholder="ex: welcome_email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quando é usado?" />
              </div>
              <div className="space-y-1.5">
                <Label>Assunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>

              <Tabs defaultValue="html">
                <TabsList>
                  <TabsTrigger value="html" className="gap-1"><Code2 className="h-3 w-3" />HTML</TabsTrigger>
                  <TabsTrigger value="text">Texto simples</TabsTrigger>
                </TabsList>
                <TabsContent value="html">
                  <Textarea value={html} onChange={(e) => setHtml(e.target.value)} className="font-mono text-xs min-h-[280px]" />
                </TabsContent>
                <TabsContent value="text">
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs min-h-[280px]" placeholder="(opcional) Versão em texto puro" />
                </TabsContent>
              </Tabs>

              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="text-xs font-semibold">Variáveis detectadas</div>
                <div className="flex flex-wrap gap-1">
                  {detected.length === 0 ? <span className="text-xs text-muted-foreground">Use {"{{nome}}"} no conteúdo</span>
                    : detected.map((v) => <Badge key={v} variant="secondary">{`{{${v}}}`}</Badge>)}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Ativo</div>
                  <div className="text-xs text-muted-foreground">Templates inativos não podem ser enviados.</div>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold flex items-center gap-1"><Eye className="h-3 w-3" /> Pré-visualização</div>
                {detected.length > 0 && (
                  <div className="space-y-2">
                    {detected.map((v) => (
                      <div key={v} className="grid grid-cols-[100px_1fr] gap-2 items-center">
                        <Label className="text-xs">{`{{${v}}}`}</Label>
                        <Input className="h-8 text-xs" value={previewVars[v] ?? ""} onChange={(e) => setPreviewVars((p) => ({ ...p, [v]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                )}
                <Button size="sm" variant="secondary" onClick={onPreview} className="gap-1"><Eye className="h-3 w-3" />Atualizar prévia</Button>
                {previewSubject && <div className="text-xs bg-muted rounded px-2 py-1"><strong>Assunto:</strong> {previewSubject}</div>}
                <div className="rounded border bg-white overflow-hidden">
                  <iframe title="preview" className="w-full h-[360px] bg-white" srcDoc={previewHtml || `<div style="padding:20px;color:#94a3b8;font-family:sans-serif">Clique em "Atualizar prévia"</div>`} />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-xs font-semibold flex items-center gap-1"><Send className="h-3 w-3" /> Enviar prévia por e-mail</div>
                <div className="flex gap-2">
                  <Input type="email" placeholder="voce@empresa.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                  <Button size="sm" onClick={onSendTest} disabled={!testTo}>Enviar</Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          {isEdit && !isSystem && <Button variant="destructive" onClick={onDelete} className="gap-1"><Trash2 className="h-4 w-4" />Excluir</Button>}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving} className="gap-1 gradient-brand text-primary-foreground"><Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
