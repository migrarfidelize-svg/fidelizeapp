import { useState, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2, FileText, ImageIcon, Trash2, Plus, Sparkles, ArrowLeft, Check, X, CheckCircle2, AlertCircle } from "lucide-react";

import { importShowcaseFromFile, confirmImport } from "@/lib/ai-menu.functions";
import type { ShowcaseKind } from "@/lib/showcase";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

type ExtractedItem = {
  name: string;
  description: string | null;
  price: number | null;
  sizes?: string[] | null;
  addons?: string[] | null;
};
type ExtractedCategory = {
  name: string;
  items: ExtractedItem[];
};

type BatchFile = {
  id: string;
  name: string;
  size: number;
  mime: string;
  base64: string;
  status: "pending" | "processing" | "done" | "error";
  error?: string;
  categoriesFound: number;
  itemsFound: number;
};

type Step = "upload" | "processing" | "review" | "saving" | "done";

const MAX_MB = 8;
const MAX_FILES = 15;

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mergeCategories(existing: ExtractedCategory[], incoming: ExtractedCategory[]): ExtractedCategory[] {
  const map = new Map<string, ExtractedCategory>();
  for (const c of existing) map.set(c.name.trim().toLowerCase(), { ...c, items: [...c.items] });
  for (const c of incoming) {
    const key = c.name.trim().toLowerCase();
    const found = map.get(key);
    if (found) {
      const seen = new Set(found.items.map((i) => i.name.trim().toLowerCase()));
      for (const it of c.items) {
        if (!seen.has(it.name.trim().toLowerCase())) {
          found.items.push(it);
          seen.add(it.name.trim().toLowerCase());
        }
      }
    } else {
      map.set(key, { ...c, items: [...c.items] });
    }
  }
  return Array.from(map.values());
}

export function AiImportDialog({
  open, onOpenChange, establishmentId, kind, onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  establishmentId: string;
  kind: ShowcaseKind;
  onImported?: () => void;
}) {
  const surface = kind;
  const isCatalog = kind === "catalog";
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [categories, setCategories] = useState<ExtractedCategory[]>([]);
  const [result, setResult] = useState<{ categoriesCreated: number; itemsCreated: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const importFn = useServerFn(importShowcaseFromFile);
  const confirmFn = useServerFn(confirmImport);

  const reset = () => {
    setStep("upload");
    setFiles([]);
    setCategories([]);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    setSaving(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const addFiles = async (list: FileList | File[]) => {
    const allowed = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
    const incoming = Array.from(list);
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_FILES} arquivos por lote.`);
      return;
    }
    const accepted: BatchFile[] = [];
    for (const f of incoming.slice(0, remaining)) {
      if (!allowed.test(f.type)) {
        toast.error(`${f.name}: formato não suportado.`);
        continue;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`${f.name}: excede ${MAX_MB} MB.`);
        continue;
      }
      const base64 = await fileToBase64(f);
      accepted.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name, size: f.size, mime: f.type, base64,
        status: "pending", categoriesFound: 0, itemsFound: 0,
      });
    }
    setFiles((prev) => [...prev, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const startBatch = async () => {
    if (files.length === 0) return;
    setStep("processing");
    setProgress({ done: 0, total: files.length });
    let merged: ExtractedCategory[] = [];
    let done = 0;

    // Process sequentially to be gentle with AI rate limits
    for (const f of files) {
      setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "processing" } : x));
      try {
        const data: any = await importFn({
          data: { establishment_id: establishmentId, surface, file_base64: f.base64, mime: f.mime },
        });
        const cats: ExtractedCategory[] = Array.isArray(data?.categories) ? data.categories : [];
        const itemsCount = cats.reduce((s, c) => s + c.items.length, 0);
        merged = mergeCategories(merged, cats);
        setFiles((prev) => prev.map((x) => x.id === f.id
          ? { ...x, status: "done", categoriesFound: cats.length, itemsFound: itemsCount }
          : x));
      } catch (e: any) {
        setFiles((prev) => prev.map((x) => x.id === f.id
          ? { ...x, status: "error", error: e?.message ?? "Falha na extração" }
          : x));
      }
      done += 1;
      setProgress({ done, total: files.length });
      setCategories([...merged]);
    }

    const anyOk = merged.length > 0;
    if (!anyOk) {
      toast.error("Nenhum item foi extraído. Verifique a nitidez dos arquivos.");
      setStep("upload");
      return;
    }
    setStep("review");
  };

  const confirmAll = async () => {
    setSaving(true);
    setStep("saving");
    try {
      const r: any = await confirmFn({
        data: {
          establishment_id: establishmentId,
          surface,
          categories: categories
            .filter((c) => c.name.trim() && c.items.length > 0)
            .map((c) => ({
              name: c.name.trim(),
              items: c.items.filter((i) => i.name.trim()).map((i) => ({
                name: i.name.trim(),
                description: (i.description ?? "").trim() || null,
                price: typeof i.price === "number" && !Number.isNaN(i.price) ? i.price : null,
              })),
            })),
        },
      });
      setResult(r);
      setStep("done");
      onImported?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao publicar");
      setStep("review");
    } finally {
      setSaving(false);
    }
  };

  const totalItems = categories.reduce((s, c) => s + c.items.length, 0);
  const okCount = files.filter((f) => f.status === "done").length;
  const errCount = files.filter((f) => f.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar {isCatalog ? "catálogo" : "cardápio"} com IA — Lote
          </DialogTitle>
          <DialogDescription>
            Envie até {MAX_FILES} arquivos (fotos ou PDFs). A IA processa um por um, mescla categorias iguais
            e você revisa tudo antes de publicar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
        {step === "upload" && (
          <div className="space-y-3 py-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center transition hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="card-icon"><Upload className="h-6 w-6" /></div>
              <div>
                <div className="font-medium">Clique para escolher arquivos</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WebP ou PDF · até {MAX_MB} MB cada · máx. {MAX_FILES} arquivos
                </p>
              </div>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
            />

            {files.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-border/60 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{files.length} arquivo{files.length > 1 ? "s" : ""} na fila</span>
                  <Button variant="ghost" size="sm" onClick={() => setFiles([])}>Limpar</Button>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {files.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      {f.mime.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-primary shrink-0" /> : <FileText className="h-4 w-4 text-primary shrink-0" />}
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(f.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              💡 Dica: envie um PDF por página, ou várias fotos do mesmo cardápio. Categorias com o mesmo nome são mescladas automaticamente.
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">Processando {progress.done + 1} de {progress.total}…</div>
                <Progress value={(progress.done / progress.total) * 100} className="mt-2 h-2" />
              </div>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto rounded-2xl border border-border/60 p-3">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                  {f.status === "processing" && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                  {f.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                  {f.status === "error" && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                  {f.status === "pending" && <div className="h-4 w-4 rounded-full border border-border shrink-0" />}
                  <span className="truncate flex-1">{f.name}</span>
                  {f.status === "done" && (
                    <span className="text-xs text-muted-foreground">{f.categoriesFound} cat · {f.itemsFound} itens</span>
                  )}
                  {f.status === "error" && (
                    <span className="text-xs text-destructive truncate max-w-[180px]">{f.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span>{okCount} arquivo{okCount !== 1 ? "s" : ""} processado{okCount !== 1 ? "s" : ""}{errCount > 0 && ` · ${errCount} com erro`}</span>
              <Badge variant="secondary" className="ml-auto">
                {categories.length} {categories.length === 1 ? "categoria" : "categorias"} · {totalItems} {totalItems === 1 ? "item" : "itens"}
              </Badge>
            </div>

            <ScrollArea className="h-[420px] rounded-2xl border border-border/60 pr-3">
              <div className="space-y-4 p-3">
                {categories.map((cat, ci) => (
                  <Card key={ci} className="border-border/60">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2">
                        <Input
                          value={cat.name}
                          onChange={(e) => {
                            const copy = [...categories];
                            copy[ci] = { ...copy[ci], name: e.target.value };
                            setCategories(copy);
                          }}
                          placeholder="Nome da categoria"
                          className="font-semibold"
                        />
                        <Button variant="ghost" size="icon" onClick={() => setCategories(categories.filter((_, i) => i !== ci))} aria-label="Remover categoria">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {cat.items.map((it, ii) => (
                          <div key={ii} className="grid grid-cols-1 gap-2 rounded-xl border border-border/50 bg-muted/20 p-3 sm:grid-cols-[1fr_120px_auto]">
                            <div className="space-y-1">
                              <Label className="text-xs">Nome</Label>
                              <Input
                                value={it.name}
                                onChange={(e) => {
                                  const copy = [...categories];
                                  copy[ci].items = [...copy[ci].items];
                                  copy[ci].items[ii] = { ...it, name: e.target.value };
                                  setCategories(copy);
                                }}
                                placeholder="Nome do item"
                              />
                              <Textarea
                                value={it.description ?? ""}
                                onChange={(e) => {
                                  const copy = [...categories];
                                  copy[ci].items = [...copy[ci].items];
                                  copy[ci].items[ii] = { ...it, description: e.target.value };
                                  setCategories(copy);
                                }}
                                placeholder="Descrição (opcional)"
                                rows={2}
                                className="text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Preço (R$)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={it.price ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value === "" ? null : Number(e.target.value);
                                  const copy = [...categories];
                                  copy[ci].items = [...copy[ci].items];
                                  copy[ci].items[ii] = { ...it, price: v };
                                  setCategories(copy);
                                }}
                                placeholder="0,00"
                              />
                            </div>
                            <div className="flex items-end justify-end">
                              <Button variant="ghost" size="icon" onClick={() => {
                                const copy = [...categories];
                                copy[ci].items = copy[ci].items.filter((_, i) => i !== ii);
                                setCategories(copy);
                              }} aria-label="Remover item">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" onClick={() => {
                          const copy = [...categories];
                          copy[ci].items = [...copy[ci].items, { name: "", description: null, price: null }];
                          setCategories(copy);
                        }}>
                          <Plus className="mr-1 h-4 w-4" /> Adicionar item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" className="w-full" onClick={() => setCategories([...categories, { name: "", items: [] }])}>
                  <Plus className="mr-2 h-4 w-4" /> Nova categoria
                </Button>
              </div>
            </ScrollArea>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Revise antes de confirmar. Categorias duplicadas foram mescladas automaticamente.
            </div>
          </div>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="font-medium">Publicando categorias e itens…</div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="rounded-full bg-emerald-500/15 p-3">
              <Check className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="font-medium">Importação concluída</div>
            <p className="text-sm text-muted-foreground">
              {result.categoriesCreated} {result.categoriesCreated === 1 ? "categoria" : "categorias"} · {result.itemsCreated} {result.itemsCreated === 1 ? "item" : "itens"} criados.
            </p>
          </div>
        )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/40">
          {step === "upload" && (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={startBatch} disabled={files.length === 0}>
                <Sparkles className="mr-2 h-4 w-4" />
                Analisar {files.length > 0 ? `${files.length} arquivo${files.length > 1 ? "s" : ""}` : ""}
              </Button>
            </>
          )}
          {step === "review" && (
            <>
              <Button variant="ghost" onClick={() => { setStep("upload"); }}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Adicionar mais
              </Button>
              <Button onClick={confirmAll} disabled={totalItems === 0 || saving}>
                <Check className="mr-2 h-4 w-4" />
                Confirmar e publicar ({totalItems} {totalItems === 1 ? "item" : "itens"})
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { onOpenChange(false); reset(); }}>Fechar</Button>
          )}
          {step === "processing" && (
            <Button variant="ghost" disabled>Processando…</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
