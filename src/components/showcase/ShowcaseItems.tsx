import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LayoutList, Plus, Pencil, Trash2, ArrowUp, ArrowDown, Copy as CopyIcon,
  ImagePlus, Video, X, Eye, EyeOff, Search, Sparkles,
} from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import {
  listMenuItems, upsertMenuItem, deleteMenuItem, toggleMenuItemActive,
  duplicateMenuItem, moveMenuItem, listMenuCategories,
} from "@/lib/menu.functions";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { showcase, STOCK_STATUS, type ShowcaseKind } from "@/lib/showcase";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BADGE_PRESETS = ["Novidade", "Vegetariano", "Vegano", "Sem glúten", "Sem lactose", "Picante", "Chef recomenda", "Best-seller"];

type Item = {
  id: string;
  category_id: string | null;
  name: string;
  short_desc: string | null;
  long_desc: string | null;
  price: number | null;
  promo_price: number | null;
  image_url: string | null;
  video_url: string | null;
  active: boolean;
  badges: any;
  ingredients: string[];
  allergens: string[];
  variants?: { label: string; price: number | null }[] | null;
  sku?: string | null;
  brand?: string | null;
  stock_status?: string | null;
  track_stock?: boolean | null;
  stock_qty?: number | null;
  external_url?: string | null;
  position: number;
};


type Category = { id: string; name: string; position: number };

export function ShowcaseItems({ kind }: { kind: ShowcaseKind }) {
  const L = showcase(kind);
  const isCatalog = kind === "catalog";
  const qc = useQueryClient();
  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchList = useServerFn(listMenuItems);
  const fetchCats = useServerFn(listMenuCategories);
  const mutUpsert = useServerFn(upsertMenuItem);
  const mutDelete = useServerFn(deleteMenuItem);
  const mutToggle = useServerFn(toggleMenuItemActive);
  const mutDup    = useServerFn(duplicateMenuItem);
  const mutMove   = useServerFn(moveMenuItem);

  const ests = useQuery({ queryKey: ["my-establishments"], queryFn: () => fetchEsts() });
  const est = ests.data?.[0]?.establishment;
  const estId = est?.id;

  const [catFilter, setCatFilter] = useState<string>("all"); // 'all' | 'none' | uuid
  const [search, setSearch] = useState("");

  const cats = useQuery({
    queryKey: ["menu-categories", estId, kind],
    queryFn: () => fetchCats({ data: { establishment_id: estId!, kind } }),
    enabled: !!estId,
  });

  const list = useQuery({
    queryKey: ["menu-items", estId, kind, catFilter],
    queryFn: () => fetchList({
      data: {
        establishment_id: estId!,
        kind,
        category_id: catFilter === "all" ? undefined : catFilter === "none" ? null : catFilter,
      },
    }),
    enabled: !!estId,
  });

  const [editing, setEditing] = useState<Item | null>(null);
  const [open, setOpen] = useState(false);
  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (it: Item) => { setEditing(it); setOpen(true); };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["menu-items", estId, kind] });
    qc.invalidateQueries({ queryKey: ["menu-overview", estId, kind] });
  };

  const upsert = useMutation({
    mutationFn: (payload: any) => mutUpsert({ data: { establishment_id: estId!, kind, ...payload } }),
    onSuccess: () => { toast.success(`${L.item} ${editing ? "atualizado" : "criado"}`); setOpen(false); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => mutDelete({ data: { establishment_id: estId!, kind, id } }),
    onSuccess: () => { toast.success(`${L.item} removido`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (p: { id: string; active: boolean }) => mutToggle({ data: { establishment_id: estId!, kind, ...p } }),
    onSuccess: () => invalidate(),
  });
  const dup = useMutation({
    mutationFn: (id: string) => mutDup({ data: { establishment_id: estId!, kind, id } }),
    onSuccess: () => { toast.success(`${L.item} duplicado`); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const move = useMutation({
    mutationFn: (p: { id: string; direction: "up" | "down" }) =>
      mutMove({
        data: {
          establishment_id: estId!,
          kind,
          category_id: catFilter === "all" ? undefined : catFilter === "none" ? null : catFilter,
          ...p,
        },
      }),
    onSuccess: () => invalidate(),
  });

  const allItems = (list.data?.items ?? []) as Item[];
  const filtered = search.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.short_desc ?? "").toLowerCase().includes(search.toLowerCase()))
    : allItems;

  const categories = (cats.data?.categories ?? []) as Category[];

  return (
    <div className="space-y-6">
      <PageHero
        icon={LayoutList}
        eyebrow={L.module}
        title={L.items}
        subtitle={isCatalog
          ? "Cadastre cada produto com foto, preço, SKU, marca, disponibilidade e link direto de compra ou WhatsApp."
          : "Cadastre cada item com foto, vídeo vertical estilo Stories, preço, ingredientes, badges dietéticos e tempo de preparo."}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar ${L.itemLower}...`}
              className="w-full pl-9 sm:w-56"
            />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder={`Filtrar por ${L.category.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as {L.categories.toLowerCase()}</SelectItem>
              <SelectItem value="none">Sem {L.category.toLowerCase()}</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew} disabled={!estId} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Novo {L.itemLower}
        </Button>
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyItems onCreate={openNew} hasCats={categories.length > 0} kind={kind} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((it, idx) => (
            <Card key={it.id} className="overflow-hidden">
              <div className="relative aspect-[4/3] w-full bg-muted">
                {it.video_url ? (
                  <video src={it.video_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground/50">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                )}
                {it.video_url && (
                  <Badge className="absolute right-2 top-2 gap-1 bg-black/70 text-white hover:bg-black/70">
                    <Video className="h-3 w-3" /> vídeo
                  </Badge>
                )}
                {!it.active && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <Badge variant="outline" className="gap-1">
                      <EyeOff className="h-3 w-3" /> oculto
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="space-y-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-base font-semibold">{it.name}</h3>
                    <PriceTag price={it.price} promo={it.promo_price} />
                  </div>
                  {it.short_desc && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{it.short_desc}</p>}
                </div>
                {Array.isArray(it.badges) && it.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(it.badges as string[]).slice(0, 3).map(b => (
                      <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 pt-1">
                  <Button size="icon" variant="ghost" disabled={idx === 0 || move.isPending}
                    onClick={() => move.mutate({ id: it.id, direction: "up" })}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={idx === filtered.length - 1 || move.isPending}
                    onClick={() => move.mutate({ id: it.id, direction: "down" })}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <div className="flex-1" />
                  <Switch
                    checked={it.active}
                    onCheckedChange={(v) => toggle.mutate({ id: it.id, active: v })}
                    aria-label={`Ativar ${L.itemLower}`}
                  />
                  <Button size="icon" variant="ghost" onClick={() => dup.mutate(it.id)} title="Duplicar">
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(it)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive" title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover {L.itemLower}?</AlertDialogTitle>
                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(it.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ItemDialog
        open={open}
        onOpenChange={setOpen}
        estId={estId}
        categories={categories}
        initial={editing}
        showKind={kind}
        onSubmit={(v) => upsert.mutate(v)}
        loading={upsert.isPending}
      />
    </div>
  );
}

function PriceTag({ price, promo }: { price: number | null; promo: number | null }) {
  if (price == null && promo == null) return null;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (promo != null && price != null && promo < price) {
    return (
      <div className="flex shrink-0 flex-col items-end leading-tight">
        <span className="text-[11px] text-muted-foreground line-through">{fmt(price)}</span>
        <span className="text-sm font-bold text-primary">{fmt(promo)}</span>
      </div>
    );
  }
  return <span className="shrink-0 text-sm font-bold text-primary">{fmt((promo ?? price)!)}</span>;
}

function EmptyItems({ onCreate, hasCats, kind }: { onCreate: () => void; hasCats: boolean; kind: ShowcaseKind }) {
  const L = showcase(kind);
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="card-icon"><LayoutList className="h-6 w-6" /></div>
        <div>
          <h3 className="text-lg font-semibold">Nenhum {L.itemLower} ainda</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasCats
              ? `Cadastre seu primeiro ${L.itemLower} — foto, descrição curta e preço.`
              : `Dica: crie primeiro as ${L.categories.toLowerCase()} para organizar melhor. Você também pode cadastrar ${L.itemsLower} sem ${L.category.toLowerCase()}.`}
          </p>
        </div>
        <Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" /> Novo {L.itemLower}</Button>
      </CardContent>
    </Card>
  );
}

function ItemDialog({
  open, onOpenChange, estId, categories, initial, onSubmit, loading, showKind,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  estId?: string;
  showKind: ShowcaseKind;
  categories: Category[];
  initial: Item | null;
  onSubmit: (v: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [shortDesc, setShortDesc] = useState("");
  const [longDesc, setLongDesc] = useState("");
  const [price, setPrice] = useState<string>("");
  const [promo, setPromo] = useState<string>("");
  const [prep, setPrep] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [badges, setBadges] = useState<string[]>([]);
  const [ingredientsText, setIngredientsText] = useState("");
  const [allergensText, setAllergensText] = useState("");
  const [variants, setVariants] = useState<{ label: string; price: string }[]>([]);
  const [active, setActive] = useState(true);
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [stockStatus, setStockStatus] = useState("in_stock");
  const [trackStock, setTrackStock] = useState(false);
  const [stockQty, setStockQty] = useState<string>("");

  const [externalUrl, setExternalUrl] = useState("");
  const L = showcase(showKind);
  const isCatalog = showKind === "catalog";

  const [uploading, setUploading] = useState<"img" | "vid" | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  useMemo(() => {
    if (open) {
      setName(initial?.name ?? "");
      setCategoryId(initial?.category_id ?? "none");
      setShortDesc(initial?.short_desc ?? "");
      setLongDesc(initial?.long_desc ?? "");
      setPrice(initial?.price != null ? String(initial.price) : "");
      setPromo(initial?.promo_price != null ? String(initial.promo_price) : "");
      setPrep("");
      setImageUrl(initial?.image_url ?? null);
      setVideoUrl(initial?.video_url ?? null);
      setBadges(Array.isArray(initial?.badges) ? (initial!.badges as string[]) : []);
      setIngredientsText((initial?.ingredients ?? []).join(", "));
      setAllergensText((initial?.allergens ?? []).join(", "));
      setVariants(
        (Array.isArray(initial?.variants) ? initial!.variants! : []).map((v) => ({
          label: v?.label ?? "",
          price: v?.price != null ? String(v.price) : "",
        }))
      );
      setActive(initial?.active ?? true);
      setSku(initial?.sku ?? "");
      setBrand(initial?.brand ?? "");
      setStockStatus(initial?.stock_status ?? "in_stock");
      setTrackStock(!!initial?.track_stock);
      setStockQty(initial?.stock_qty != null ? String(initial.stock_qty) : "");
      setExternalUrl(initial?.external_url ?? "");

    }
  }, [open, initial]);

  const upload = async (file: File, kind: "img" | "vid") => {
    if (!estId) return;
    setUploading(kind);
    try {
      const bucket = kind === "img" ? "menu-images" : "menu-videos";
      const ext = file.name.split(".").pop() || (kind === "img" ? "jpg" : "mp4");
      const path = `est_${estId}/items/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (kind === "img") setImageUrl(data.publicUrl);
      else setVideoUrl(data.publicUrl);
      toast.success(kind === "img" ? "Imagem enviada" : "Vídeo enviado");
    } catch (e: any) {
      toast.error(e.message || "Falha no upload");
    } finally {
      setUploading(null);
    }
  };

  const toggleBadge = (b: string) => setBadges(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const submit = () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    const parseNum = (s: string) => { const n = parseFloat(s.replace(",", ".")); return isNaN(n) ? null : n; };
    const parseInt2 = (s: string) => { const n = parseInt(s, 10); return isNaN(n) ? null : n; };
    onSubmit({
      id: initial?.id,
      category_id: categoryId === "none" ? null : categoryId,
      name: name.trim(),
      short_desc: shortDesc.trim() || null,
      long_desc: longDesc.trim() || null,
      price: parseNum(price),
      promo_price: parseNum(promo),
      prep_minutes: parseInt2(prep),
      image_url: imageUrl,
      video_url: videoUrl,
      badges,
      ingredients: ingredientsText.split(",").map(s => s.trim()).filter(Boolean),
      allergens: allergensText.split(",").map(s => s.trim()).filter(Boolean),
      variants: variants
        .filter(v => v.label.trim())
        .map(v => ({ label: v.label.trim(), price: parseNum(v.price) })),
      active,
      sku: sku.trim() || null,
      brand: brand.trim() || null,
      stock_status: stockStatus as any,
      track_stock: isCatalog ? trackStock : false,
      stock_qty: isCatalog && trackStock ? Math.max(0, parseInt2(stockQty) ?? 0) : null,
      external_url: externalUrl.trim() || null,
    });

  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? `Editar ${L.itemLower}` : `Novo ${L.itemLower}`}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={isCatalog ? "Ex.: Fone Bluetooth XZ" : "Ex.: Burger Trufado"} maxLength={120} />
          </div>

          <div className="space-y-2">
            <Label>{L.category}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem {L.category.toLowerCase()}</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={active} onCheckedChange={setActive} />
              {active ? <Eye className="h-4 w-4 text-emerald-500" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              Visível na vitrine
            </label>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição curta</Label>
            <Textarea value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} rows={2} maxLength={200}
              placeholder={isCatalog ? "Uma linha que resume o produto (aparece no card)." : "Uma linha que abre o apetite (aparece no card do cardápio)."} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Descrição completa</Label>
            <Textarea value={longDesc} onChange={(e) => setLongDesc(e.target.value)} rows={3} maxLength={2000}
              placeholder="Detalhes, modo de preparo, sugestões de acompanhamento..." />
          </div>

          <div className="space-y-2">
            <Label>Preço (R$)</Label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0,00" />
          </div>
          <div className="space-y-2">
            <Label>Preço promocional (R$)</Label>
            <Input value={promo} onChange={(e) => setPromo(e.target.value)} inputMode="decimal" placeholder="opcional" />
          </div>

          {!isCatalog && (
            <div className="space-y-2">
              <Label>Tempo de preparo (min)</Label>
              <Input value={prep} onChange={(e) => setPrep(e.target.value)} inputMode="numeric" placeholder="opcional" />
            </div>
          )}

          {isCatalog && (
            <>
              <div className="space-y-2">
                <Label>SKU / Código</Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} maxLength={60} placeholder="opcional" />
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} placeholder="opcional" />
              </div>
              <div className="space-y-2">
                <Label>Disponibilidade</Label>
                <Select value={trackStock ? (Math.max(0, parseInt(stockQty || "0", 10) || 0) > 0 ? "in_stock" : "out_of_stock") : stockStatus} onValueChange={setStockStatus} disabled={trackStock}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STOCK_STATUS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {trackStock && (
                  <p className="text-[11px] text-muted-foreground">Definida automaticamente pelo estoque.</p>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 p-3 md:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Switch checked={trackStock} onCheckedChange={setTrackStock} />
                  Controlar estoque deste produto
                </label>
                {trackStock ? (
                  <div className="flex flex-wrap items-end gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Quantidade em estoque</Label>
                      <Input
                        className="w-32"
                        value={stockQty}
                        onChange={(e) => setStockQty(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        placeholder="0"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Quando chegar a <strong>0</strong>, o produto fica marcado como <strong>Esgotado</strong> e não pode ser adicionado ao carrinho do catálogo.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Ative para informar a quantidade disponível e esgotar o produto automaticamente.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Link de compra / WhatsApp</Label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://wa.me/55..."
                  inputMode="url"
                />
              </div>
            </>
          )}

          <div className="space-y-2 md:col-span-2">
            <Label>{isCatalog ? "Variações (opcional)" : "Tamanhos / pesos (opcional)"}</Label>
            <p className="text-[11px] text-muted-foreground">
              {isCatalog
                ? "Use para o mesmo produto em opções diferentes (ex.: 64GB / 128GB, P / M / G). Cada opção pode ter seu próprio preço."
                : "Use para vender o mesmo prato em opções diferentes (ex.: 300g / 500g, Pequena / Grande). Cada opção pode ter seu próprio preço."}
            </p>
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={v.label}
                    maxLength={40}
                    placeholder="Ex.: 500g ou Grande"
                    onChange={(e) => setVariants(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                  />
                  <Input
                    value={v.price}
                    inputMode="decimal"
                    placeholder="Preço (R$)"
                    className="w-36"
                    onChange={(e) => setVariants(prev => prev.map((x, i) => i === idx ? { ...x, price: e.target.value } : x))}
                  />
                  <Button type="button" variant="ghost" size="icon"
                    onClick={() => setVariants(prev => prev.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {variants.length < 10 && (
              <Button type="button" variant="outline" size="sm"
                onClick={() => setVariants(prev => [...prev, { label: "", price: "" }])}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar {isCatalog ? "variação" : "tamanho"}
              </Button>
            )}
          </div>



          <div className="space-y-2 md:col-span-2">
            <Label>Mídia</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MediaSlot
                kind="img"
                url={imageUrl}
                uploading={uploading === "img"}
                onPick={() => imgRef.current?.click()}
                onClear={() => setImageUrl(null)}
              />
              <MediaSlot
                kind="vid"
                url={videoUrl}
                uploading={uploading === "vid"}
                onPick={() => vidRef.current?.click()}
                onClear={() => setVideoUrl(null)}
              />
              <input ref={imgRef} type="file" accept="image/*" hidden
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "img")} />
              <input ref={vidRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden
                onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "vid")} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isCatalog
                ? "Fotos quadradas ou 4:3 ficam melhores na grade do catálogo. Vídeo é opcional."
                : "Vídeos verticais 9:16 ficam melhores no modo Stories. Máx. recomendado: 30s / 20MB."}
            </p>
          </div>

          {!isCatalog && (
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /> Badges</Label>
              <div className="flex flex-wrap gap-2">
                {BADGE_PRESETS.map(b => {
                  const on = badges.includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBadge(b)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          {!isCatalog && (
            <>
              <div className="space-y-2">
                <Label>Ingredientes</Label>
                <Input value={ingredientsText} onChange={(e) => setIngredientsText(e.target.value)}
                  placeholder="Separe por vírgula" />
              </div>
              <div className="space-y-2">
                <Label>Alérgenos</Label>
                <Input value={allergensText} onChange={(e) => setAllergensText(e.target.value)}
                  placeholder="Ex.: leite, glúten, amendoim" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || uploading !== null}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaSlot({
  kind, url, uploading, onPick, onClear,
}: {
  kind: "img" | "vid";
  url: string | null;
  uploading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const label = kind === "img" ? "Imagem" : "Vídeo vertical";
  const Icon = kind === "img" ? ImagePlus : Video;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted">
      <div className="relative aspect-video w-full">
        {url ? (
          kind === "img" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <video src={url} className="h-full w-full object-cover" muted playsInline controls />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/60">
            <Icon className="h-8 w-8" />
            <span className="text-xs">{label}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-background/80 p-2 backdrop-blur">
        <Button size="sm" variant="outline" onClick={onPick} disabled={uploading}>
          <Icon className="mr-2 h-4 w-4" /> {uploading ? "Enviando..." : url ? "Trocar" : `Enviar ${label.toLowerCase()}`}
        </Button>
        {url && (
          <Button size="icon" variant="ghost" onClick={onClear} title="Remover">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
