import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { BookOpen as HeroIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listArticlesAdmin, saveArticle, deleteArticle, saveCategory } from "@/lib/helpdesk.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FolderPlus, Eye } from "lucide-react";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/app/kb")({
  head: () => ({ meta: [{ title: "Base de conhecimento — Fidelize" }] }),
  component: KbManager,
});

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

type Article = { id: string; title: string; slug: string; excerpt: string | null; body_html: string; tags: string[] | null; published: boolean; views: number; helpful_count: number; not_helpful_count: number; category_id: string | null };
type ArticleDraft = { id?: string; title: string; slug: string; excerpt: string; body_html: string; category_id: string | null; published: boolean; tags: string[] };

function KbManager() {
  const qc = useQueryClient();
  const getEsts = useServerFn(getMyEstablishments);
  const listFn = useServerFn(listArticlesAdmin);
  const saveFn = useServerFn(saveArticle);
  const delFn = useServerFn(deleteArticle);
  const saveCat = useServerFn(saveCategory);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; slug: string; name: string } | undefined;
  const { data } = useQuery({ queryKey: ["kb-admin", est?.id], queryFn: () => listFn({ data: { establishment_id: est!.id } }), enabled: !!est });
  const [editing, setEditing] = useState<ArticleDraft | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");

  if (!est) return <LoadingSkeleton variant="card-grid" rows={6} className="py-4" />;

  async function save() {
    if (!editing) return;
    try {
      await saveFn({ data: { ...editing, establishment_id: est!.id } });
      toast.success("Artigo salvo");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["kb-admin"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function remove(id: string) {
    if (!confirm("Excluir este artigo?")) return;
    try { await delFn({ data: { id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["kb-admin"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }
  async function addCat() {
    if (catName.trim().length < 2) return;
    try {
      await saveCat({ data: { establishment_id: est!.id, name: catName, slug: slugify(catName), sort_order: (data?.categories.length ?? 0) } });
      setCatName(""); setCatOpen(false); qc.invalidateQueries({ queryKey: ["kb-admin"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div>
      <PageHero
        icon={HeroIcon}
        eyebrow={"Ajuda · Base de conhecimento"}
        title={"Base de conhecimento"}
        subtitle={"74 artigos organizados por categoria com busca instantânea."}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Base de conhecimento</h1>
          <p className="text-sm text-muted-foreground">Público em <a href={`/suporte/${est.slug}`} target="_blank" className="text-primary hover:underline">/suporte/{est.slug}</a></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatOpen(true)}><FolderPlus className="h-4 w-4 mr-2" />Categoria</Button>
          <Button onClick={() => setEditing({ title: "", slug: "", excerpt: "", body_html: "<p></p>", category_id: null, published: false, tags: [] })}>
            <Plus className="h-4 w-4 mr-2" />Novo artigo
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Título</th>
              <th className="text-left p-3">Categoria</th>
              <th className="text-left p-3">Views</th>
              <th className="text-left p-3">Feedback</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {data?.articles.map(a => {
              const cat = data.categories.find(c => c.id === a.category_id);
              return (
                <tr key={a.id} className="border-t">
                  <td className="p-3 font-medium">{a.title}</td>
                  <td className="p-3 text-sm text-muted-foreground">{cat?.name ?? "—"}</td>
                  <td className="p-3 text-sm">{a.views}</td>
                  <td className="p-3 text-sm text-muted-foreground">👍 {a.helpful_count} · 👎 {a.not_helpful_count}</td>
                  <td className="p-3">{a.published ? <Badge>Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {a.published && <a href={`/suporte/${est.slug}/kb/${a.slug}`} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" aria-label="Ver artigo"><Eye className="h-4 w-4" /></Button></a>}
                      <Button size="icon" variant="ghost" aria-label="Editar artigo" onClick={() => openEdit(a as Article, setEditing)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Excluir artigo" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!data?.articles.length && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">Nenhum artigo ainda.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar artigo" : "Novo artigo"}</DialogTitle></DialogHeader>
          {editing && <ArticleForm draft={editing} setDraft={setEditing} categories={data?.categories ?? []} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova categoria</DialogTitle></DialogHeader>
          <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Nome (ex: Pagamentos)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
            <Button onClick={addCat}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function openEdit(a: Article, set: (d: ArticleDraft) => void) {
  set({ id: a.id, title: a.title, slug: a.slug, excerpt: a.excerpt ?? "", body_html: a.body_html, category_id: a.category_id, published: a.published, tags: a.tags ?? [] });
}

function ArticleForm({ draft, setDraft, categories }: { draft: ArticleDraft; setDraft: (d: ArticleDraft) => void; categories: Array<{ id: string; name: string }> }) {
  useEffect(() => {
    if (!draft.slug && draft.title) setDraft({ ...draft, slug: slugify(draft.title) });
     
  }, [draft.title]);
  return (
    <div className="space-y-4">
      <div>
        <Label>Título</Label>
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Slug</Label>
          <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })} />
        </div>
        <div>
          <Label>Categoria</Label>
          <Select value={draft.category_id ?? "none"} onValueChange={(v) => setDraft({ ...draft, category_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem categoria</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Resumo</Label>
        <Input value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} placeholder="Uma frase que descreve o artigo" maxLength={300} />
      </div>
      <div>
        <Label>Conteúdo (HTML permitido)</Label>
        <Textarea value={draft.body_html} onChange={(e) => setDraft({ ...draft, body_html: e.target.value })} rows={14} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground mt-1">Use tags como &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;&lt;li&gt;, &lt;strong&gt;.</p>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={draft.published} onCheckedChange={(v) => setDraft({ ...draft, published: v })} />
        <span className="text-sm">Publicado</span>
      </div>
    </div>
  );
}
