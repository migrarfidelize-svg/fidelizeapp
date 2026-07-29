import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2, FileText, ImageIcon, Trash2, Plus, Sparkles, ArrowLeft, Check } from "lucide-react";

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

type Step = "upload" | "loading" | "review" | "saving" | "done";

const MAX_MB = 8;

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
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; mime: string } | null>(null);
  const [categories, setCategories] = useState<ExtractedCategory[]>([]);
  const [result, setResult] = useState<{ categoriesCreated: number; itemsCreated: number } | null>(null);

  const importFn = useServerFn(importShowcaseFromFile);
  const confirmFn = useServerFn(confirmImport);

  const importMut = useMutation({
    mutationFn: (payload: { file_base64: string; mime: string }) =>
      importFn({ data: { establishment_id: establishmentId, surface, ...payload } }),
    onSuccess: (data: any) => {
      const cats: ExtractedCategory[] = Array.isArray(data?.categories) ? data.categories : [];
      if (cats.length === 0) {
        toast.error("Não conseguimos extrair itens. Tente uma imagem/PDF mais nítido.");
        setStep("upload");
        return;
      }
      setCategories(cats);
      setStep("review");
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStep("upload");
    },
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmFn({
      data: {
        establishment_id: establishmentId,
        surface,
        categories: categories
          .filter(c => c.name.trim() && c.items.length > 0)
          .map(c => ({
            name: c.name.trim(),
            items: c.items
              .filter(i => i.name.trim())
              .map(i => ({
                name: i.name.trim(),
                description: (i.description ?? "").trim() || null,
                price: typeof i.price === "number" && !Number.isNaN(i.price) ? i.price : null,
              })),
          })),
      },
    }),
    onSuccess: (r: any) => {
      setResult(r);
      setStep("done");
      onImported?.();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setStep("review");
    },
  });

  const reset = () => {
    setStep("upload");
    setFileMeta(null);
    setCategories([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo excede ${MAX_MB} MB. Reduza a resolução ou divida em partes.`);
      return;
    }
    const allowed = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
    if (!allowed.test(file.type)) {
      toast.error("Formato não suportado. Use JPG, PNG, WebP ou PDF.");
      return;
    }
    setFileMeta({ name: file.name, size: file.size, mime: file.type });
    setStep("loading");

    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    importMut.mutate({ file_base64: base64, mime: file.type });
  };

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importar {isCatalog ? "catálogo" : "cardápio"} com IA
          </DialogTitle>
          <DialogDescription>
            Envie uma foto ou PDF. A IA extrai categorias, produtos, preços e descrições.
            Nada é publicado sem sua revisão e confirmação.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 px-6 py-12 text-center transition hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="card-icon">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <div className="font-medium">Clique para escolher um arquivo</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  JPG, PNG, WebP ou PDF · até {MAX_MB} MB
                </p>
              </div>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
              💡 Dica: fotos bem iluminadas e páginas retas dão os melhores resultados.
              Cardápios de várias páginas podem ser enviados como um único PDF.
            </div>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="font-medium">Analisando {fileMeta?.mime.startsWith("image/") ? "imagem" : "PDF"}…</div>
            <p className="max-w-sm text-xs text-muted-foreground">
              Isso pode levar de 15 a 40 segundos dependendo do tamanho do arquivo.
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              {fileMeta?.mime.startsWith("image/") ? (
                <ImageIcon className="h-4 w-4 text-primary" />
              ) : (
                <FileText className="h-4 w-4 text-primary" />
              )}
              <span className="truncate">{fileMeta?.name}</span>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCategories(categories.filter((_, i) => i !== ci))}
                          aria-label="Remover categoria"
                        >
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
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  const copy = [...categories];
                                  copy[ci].items = copy[ci].items.filter((_, i) => i !== ii);
                                  setCategories(copy);
                                }}
                                aria-label="Remover item"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const copy = [...categories];
                            copy[ci].items = [...copy[ci].items, { name: "", description: null, price: null }];
                            setCategories(copy);
                          }}
                        >
                          <Plus className="mr-1 h-4 w-4" /> Adicionar item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setCategories([...categories, { name: "", items: [] }])}
                >
                  <Plus className="mr-2 h-4 w-4" /> Nova categoria
                </Button>
              </div>
            </ScrollArea>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠️ Revise cuidadosamente antes de confirmar. Ingredientes e alergênicos <b>não</b> são publicados automaticamente — se precisar, edite depois no editor.
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
              Você pode ajustar imagens e detalhes no editor.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "review" && (
            <>
              <Button variant="ghost" onClick={() => setStep("upload")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Trocar arquivo
              </Button>
              <Button
                onClick={() => { setStep("saving"); confirmMut.mutate(); }}
                disabled={totalItems === 0 || confirmMut.isPending}
              >
                <Check className="mr-2 h-4 w-4" />
                Confirmar e publicar ({totalItems} {totalItems === 1 ? "item" : "itens"})
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { onOpenChange(false); reset(); }}>Fechar</Button>
          )}
          {(step === "upload" || step === "loading") && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={step === "loading"}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
