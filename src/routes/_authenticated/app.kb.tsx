import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { BookOpen as HeroIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listArticlesAdmin, saveArticle, deleteArticle, saveCategory, importFidelizeArticles } from "@/lib/helpdesk.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, FolderPlus, Eye, DownloadCloud } from "lucide-react";
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
  const importFn = useServerFn(importFidelizeArticles);
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const est = memberships?.[0]?.establishment as { id: string; slug: string; name: string } | undefined;
  const { data } = useQuery({ queryKey: ["kb-admin", est?.id], queryFn: () => listFn({ data: { establishment_id: est!.id } }), enabled: !!est });
  const [editing, setEditing] = useState<ArticleDraft | null>(null);
  const [preview, setPreview] = useState<Article | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [importing, setImporting] = useState(false);


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
  async function importArticles() {
    setImporting(true);
    try {
      const r = await importFn({ data: { establishment_id: est!.id } });
      if (r.imported === 0) toast.info("Sua base já está com todos os artigos da Central Fidelize.");
      else toast.success(`${r.imported} artigos importados`);
      qc.invalidateQueries({ queryKey: ["kb-admin"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setImporting(false); }
  }

  const total = data?.articles.length ?? 0;

  return (
    <div>
      <PageHero
        icon={HeroIcon}
        eyebrow={"Ajuda · Base de conhecimento"}
        title={"Base de conhecimento"}
        subtitle={total > 0
          ? `${total} artigo${total > 1 ? "s" : ""} em ${data?.categories.length ?? 0} categoria${(data?.categories.length ?? 0) === 1 ? "" : "s"}, com busca instantânea na página pública.`
          : "Sua base começa vazia. Crie artigos próprios ou importe os artigos oficiais da Central Fidelize."}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Base de conhecimento</h1>
          <p className="text-sm text-muted-foreground">Público em <a href={`/suporte/${est.slug}`} target="_blank" className="text-primary hover:underline">/suporte/{est.slug}</a></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={importArticles} disabled={importing}>
            <DownloadCloud className="h-4 w-4 mr-2" />{importing ? "Importando…" : "Importar artigos Fidelize"}
          </Button>
          <Button variant="outline" onClick={() => setCatOpen(true)}><FolderPlus className="h-4 w-4 mr-2" />Categoria</Button>
          <Button onClick={() => setEditing({ title: "", slug: "", excerpt: "", body_html: "<p></p>", category_id: null, published: false, tags: [] })}>
            <Plus className="h-4 w-4 mr-2" />Novo artigo
          </Button>
        </div>
      </div>


      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.articles.map((a) => {
          const cat = data.categories.find((c) => c.id === a.category_id);
          return (
            <article
              key={a.id}
              className="group text-left rounded-2xl border bg-card p-5 flex flex-col gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <Badge variant="outline">{cat?.name ?? "Sem categoria"}</Badge>
                {a.published ? <Badge>Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>}
              </div>
              <button
                type="button"
                onClick={() => setPreview(a as Article)}
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
              >
                <h2 className="font-semibold leading-snug group-hover:text-primary transition-colors">{a.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                  {a.excerpt || (a.body_html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Sem resumo"}
                </p>
              </button>
              <Button type="button" variant="secondary" className="w-full h-11" onClick={() => setPreview(a as Article)}>
                <Eye className="h-4 w-4 mr-2" />Ler artigo
              </Button>
              <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">👁 {a.views} · 👍 {a.helpful_count} · 👎 {a.not_helpful_count}</span>
                <div className="flex gap-1">
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label="Editar artigo" onClick={() => openEdit(a as Article, setEditing)}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-11 w-11" aria-label="Excluir artigo" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </article>

          );
        })}
        {!data?.articles.length && (
          <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhum artigo ainda. Clique em <strong>Importar artigos Fidelize</strong> para trazer os artigos oficiais, ou crie o seu.
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          {preview && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{data?.categories.find((c) => c.id === preview.category_id)?.name ?? "Sem categoria"}</Badge>
                {preview.published ? <Badge>Publicado</Badge> : <Badge variant="secondary">Rascunho</Badge>}
                <span>👁 {preview.views}</span>
              </div>
              {preview.excerpt && <p className="text-sm text-muted-foreground">{preview.excerpt}</p>}
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: preview.body_html }}
              />
            </>
          )}
          <DialogFooter>
            {preview?.published && (
              <a href={`/suporte/${est.slug}/kb/${preview.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline">Abrir página pública</Button>
              </a>
            )}
            <Button onClick={() => { if (preview) { openEdit(preview, setEditing); setPreview(null); } }}>Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


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
