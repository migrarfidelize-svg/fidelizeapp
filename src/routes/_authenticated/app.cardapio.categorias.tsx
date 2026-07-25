import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FolderTree, Plus, Pencil, Trash2, ArrowUp, ArrowDown,
  Star, ImagePlus, X, EyeOff, Eye,
} from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import {
  listMenuCategories, upsertMenuCategory, deleteMenuCategory, moveMenuCategory,
} from "@/lib/menu.functions";
import { supabase } from "@/integrations/supabase/client";
import { MenuTemplatePicker } from "@/components/MenuTemplatePicker";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/cardapio/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias do Cardápio — Fidelize" },
      { name: "description", content: "Organize seu cardápio em seções com imagem de capa e destaques." },
    ],
  }),
  component: CategoriasPage,
});

type Category = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  featured: boolean;
  position: number;
};

function CategoriasPage() {
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchList = useServerFn(listMenuCategories);
  const mutUpsert = useServerFn(upsertMenuCategory);
  const mutDelete = useServerFn(deleteMenuCategory);
  const mutMove   = useServerFn(moveMenuCategory);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment;
  const estId = est?.id;

  const list = useQuery({
    queryKey: ["menu-categories", estId],
    queryFn: () => fetchList({ data: { establishment_id: estId! } }),
    enabled: !!estId,
  });

  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setOpen(true); };

  const upsert = useMutation({
    mutationFn: (payload: any) => mutUpsert({ data: { establishment_id: estId!, ...payload } }),
    onSuccess: () => {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setOpen(false); setEditing(null);
      qc.invalidateQueries({ queryKey: ["menu-categories", estId] });
      qc.invalidateQueries({ queryKey: ["menu-overview", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => mutDelete({ data: { establishment_id: estId!, id } }),
    onSuccess: () => {
      toast.success("Categoria removida");
      qc.invalidateQueries({ queryKey: ["menu-categories", estId] });
      qc.invalidateQueries({ queryKey: ["menu-overview", estId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: (p: { id: string; direction: "up" | "down" }) => mutMove({ data: { establishment_id: estId!, ...p } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu-categories", estId] }),
  });

  const cats = (list.data?.categories ?? []) as Category[];

  return (
    <div className="space-y-6">
      <PageHero
        icon={FolderTree}
        eyebrow="Cardápio Virtual"
        title="Categorias"
        subtitle="Organize seu cardápio em seções (Entradas, Pratos principais, Bebidas...). Cada uma pode ter imagem de capa e ser marcada como destaque."
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {cats.length === 0 ? "Nenhuma categoria ainda." : `${cats.length} ${cats.length === 1 ? "categoria" : "categorias"}`}
        </p>
        <Button onClick={openNew} disabled={!estId}>
          <Plus className="mr-2 h-4 w-4" /> Nova categoria
        </Button>
      </div>

      {list.isLoading ? (
        <Skeleton />
      ) : cats.length === 0 ? (
        <EmptyState onCreate={openNew} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {cats.map((c, idx) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-0">
                <div className="relative h-full min-h-[112px] bg-muted">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/50">
                      <FolderTree className="h-6 w-6" />
                    </div>
                  )}
                  {c.featured && (
                    <Badge className="absolute left-2 top-2 gap-1 bg-amber-500/90 text-amber-950 hover:bg-amber-500">
                      <Star className="h-3 w-3" /> Destaque
                    </Badge>
                  )}
                </div>
                <CardContent className="flex min-w-0 flex-col justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{c.name}</h3>
                      {!c.active && (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <EyeOff className="h-3 w-3" /> oculta
                        </Badge>
                      )}
                    </div>
                    {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={idx === 0 || move.isPending}
                      onClick={() => move.mutate({ id: c.id, direction: "up" })}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={idx === cats.length - 1 || move.isPending}
                      onClick={() => move.mutate({ id: c.id, direction: "down" })}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <div className="flex-1" />
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Os pratos desta categoria ficarão sem categoria, mas não serão apagados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(c.id)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CategoryDialog
        open={open}
        onOpenChange={setOpen}
        estId={estId}
        initial={editing}
        onSubmit={(v) => upsert.mutate(v)}
        loading={upsert.isPending}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="card-icon">
          <FolderTree className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Crie sua primeira categoria</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Comece por seções amplas como <b>Entradas</b>, <b>Pratos principais</b>, <b>Bebidas</b> e <b>Sobremesas</b>.
            Você pode reordenar e adicionar imagens depois.
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nova categoria
        </Button>
      </CardContent>
    </Card>
  );
}

function CategoryDialog({
  open, onOpenChange, estId, initial, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estId?: string;
  initial: Category | null;
  onSubmit: (v: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useMemo(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDescription(initial?.description ?? "");
      setImageUrl(initial?.image_url ?? null);
      setActive(initial?.active ?? true);
      setFeatured(initial?.featured ?? false);
    }
  }, [open, initial]);

  const upload = async (file: File) => {
    if (!estId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `est_${estId}/categories/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("menu-images").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    onSubmit({
      id: initial?.id,
      name: name.trim(),
      description: description.trim() || null,
      image_url: imageUrl,
      active,
      featured,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pratos principais" maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Nossas receitas de assinatura, servidas quentes." maxLength={400} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Imagem de capa</Label>
            <div className="flex items-center gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/50">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" hidden
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <ImagePlus className="mr-2 h-4 w-4" /> {uploading ? "Enviando..." : imageUrl ? "Trocar" : "Enviar imagem"}
                </Button>
                {imageUrl && (
                  <Button size="sm" variant="ghost" onClick={() => setImageUrl(null)}>
                    <X className="mr-2 h-3.5 w-3.5" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} />
              {active ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              Visível no cardápio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={featured} onCheckedChange={setFeatured} />
              <Star className={`h-4 w-4 ${featured ? "text-amber-500" : "text-muted-foreground"}`} />
              Marcar como destaque
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || uploading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
