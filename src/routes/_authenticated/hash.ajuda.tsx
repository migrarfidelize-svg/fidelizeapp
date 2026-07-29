import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { BookMarked as HeroIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, BookOpen, FolderTree, Eye, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  adminListAllCategories,
  adminUpsertCategory,
  adminDeleteCategory,
  adminListArticles,
  adminUpsertArticle,
  adminDeleteArticle,
  adminHelpStats,
} from "@/lib/help.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/hash/ajuda")({
  component: AdminHelp,
});

type Category = { id: string; slug: string; name: string; description: string | null; icon: string | null; sort_order: number; active: boolean };
type Article = { id: string; category_id: string; slug: string; title: string; excerpt: string | null; content: string; keywords: string | null; reading_time: number; sort_order: number; published: boolean; views: number; helpful_yes: number; helpful_no: number; category?: { slug: string; name: string } };

function AdminHelp() {
  const listCats = useServerFn(adminListAllCategories);
  const listArts = useServerFn(adminListArticles);
  const stats = useServerFn(adminHelpStats);
  const [catFilter, setCatFilter] = useState<string>("all");

  const { data: categories = [] } = useQuery({ queryKey: ["admin-help-cats"], queryFn: () => listCats() });
  const { data: articles = [] } = useQuery({
    queryKey: ["admin-help-arts", catFilter],
    queryFn: () => listArts({ data: catFilter === "all" ? {} : { categoryId: catFilter } }),
  });
  const { data: st } = useQuery({ queryKey: ["admin-help-stats"], queryFn: () => stats() });

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Ajuda"}
        title={"Ajuda interna"}
        subtitle={"Documentação operacional para o time Fidelize."}
      />
      <div>
        <h1 className="font-display text-2xl font-bold">Central de Ajuda</h1>
        <p className="text-sm text-muted-foreground">Gerencie categorias, artigos e acompanhe engajamento.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Categorias</div><div className="text-2xl font-bold mt-1">{st?.categories ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Artigos publicados</div><div className="text-2xl font-bold mt-1">{st?.articles ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Total de views</div><div className="text-2xl font-bold mt-1">{(st?.top ?? []).reduce((s: number, a: any) => s + (a.views ?? 0), 0)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="articles">
        <TabsList>
          <TabsTrigger value="articles"><BookOpen className="mr-2 h-4 w-4" />Artigos</TabsTrigger>
          <TabsTrigger value="categories"><FolderTree className="mr-2 h-4 w-4" />Categorias</TabsTrigger>
          <TabsTrigger value="top">Top artigos</TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c: Category) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <ArticleDialog categories={categories} />
          </div>
          <div className="grid gap-2">
            {articles.map((a: Article) => (
              <Card key={a.id}><CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase text-muted-foreground">{a.category?.name}</div>
                  <div className="font-medium truncate">{a.title} {!a.published && <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">rascunho</span>}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{a.views}</span>
                    <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp className="h-3 w-3" />{a.helpful_yes}</span>
                    <span className="flex items-center gap-1 text-red-600"><ThumbsDown className="h-3 w-3" />{a.helpful_no}</span>
                  </div>
                </div>
                <ArticleDialog categories={categories} article={a} />
                <DeleteArticle id={a.id} />
              </CardContent></Card>
            ))}
            {articles.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum artigo.</p>}
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-3">
          <div className="flex justify-end"><CategoryDialog /></div>
          <div className="grid gap-2">
            {categories.map((c: Category) => (
              <Card key={c.id}><CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="font-medium">{c.name} <span className="text-xs text-muted-foreground ml-2">/{c.slug}</span></div>
                  <div className="text-xs text-muted-foreground">{c.description}</div>
                </div>
                <CategoryDialog category={c} />
                <DeleteCategory id={c.id} />
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="top" className="space-y-2">
          {(st?.top ?? []).map((a: any) => (
            <Card key={a.slug}><CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">/{a.category?.slug}</div>
                <div className="font-medium">{a.title}</div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{a.views}</span>
                <span className="flex items-center gap-1 text-emerald-600"><ThumbsUp className="h-4 w-4" />{a.helpful_yes}</span>
                <span className="flex items-center gap-1 text-red-600"><ThumbsDown className="h-4 w-4" />{a.helpful_no}</span>
              </div>
            </CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CategoryDialog({ category }: { category?: Category }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: category?.slug ?? "",
    name: category?.name ?? "",
    description: category?.description ?? "",
    icon: category?.icon ?? "BookOpen",
    sort_order: category?.sort_order ?? 99,
    active: category?.active ?? true,
  });
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertCategory);
  const mut = useMutation({
    mutationFn: () => upsert({ data: { id: category?.id, ...form } }),
    onSuccess: () => { toast.success("Categoria salva"); qc.invalidateQueries({ queryKey: ["admin-help-cats"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <Button size="sm" variant={category ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {category ? <Pencil className="h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" />Nova categoria</>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{category ? "Editar" : "Nova"} categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ícone (Lucide)</Label><Input value={form.icon ?? ""} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Ex: Rocket" /></div>
              <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "0") })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteCategory({ id }: { id: string }) {
  const qc = useQueryClient();
  const del = useServerFn(adminDeleteCategory);
  const mut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => { toast.success("Excluída"); qc.invalidateQueries({ queryKey: ["admin-help-cats"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir categoria e todos os artigos dela?")) mut.mutate(); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>;
}

function ArticleDialog({ categories, article }: { categories: Category[]; article?: Article }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category_id: article?.category_id ?? (categories[0]?.id ?? ""),
    slug: article?.slug ?? "",
    title: article?.title ?? "",
    excerpt: article?.excerpt ?? "",
    content: article?.content ?? "",
    keywords: article?.keywords ?? "",
    reading_time: article?.reading_time ?? 3,
    sort_order: article?.sort_order ?? 99,
    published: article?.published ?? true,
  });
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertArticle);
  const mut = useMutation({
    mutationFn: () => upsert({ data: { id: article?.id, ...form } }),
    onSuccess: () => { toast.success("Artigo salvo"); qc.invalidateQueries({ queryKey: ["admin-help-arts"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <Button size="sm" variant={article ? "ghost" : "default"} onClick={() => setOpen(true)}>
        {article ? <Pencil className="h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" />Novo artigo</>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{article ? "Editar" : "Novo"} artigo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
            </div>
            <div><Label>Título</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Resumo</Label><Textarea rows={2} value={form.excerpt ?? ""} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
            <div><Label>Conteúdo (Markdown)</Label><Textarea rows={12} className="font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
            <div><Label>Palavras-chave</Label><Input value={form.keywords ?? ""} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="separadas, por, vírgula" /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Leitura (min)</Label><Input type="number" value={form.reading_time} onChange={(e) => setForm({ ...form, reading_time: parseInt(e.target.value || "3") })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value || "0") })} /></div>
              <div className="flex items-end gap-2"><Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} /><Label>Publicado</Label></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteArticle({ id }: { id: string }) {
  const qc = useQueryClient();
  const del = useServerFn(adminDeleteArticle);
  const mut = useMutation({
    mutationFn: () => del({ data: { id } }),
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["admin-help-arts"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir artigo?")) mut.mutate(); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>;
}
