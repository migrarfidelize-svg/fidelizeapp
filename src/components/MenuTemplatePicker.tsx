import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";

import { MENU_TEMPLATES } from "@/lib/menu-templates";
import { CATALOG_TEMPLATES } from "@/lib/catalog-templates";
import { templateCategoryImage, templateCoverImage } from "@/lib/menu-template-media";
import { catalogCategoryImage, catalogCoverImage } from "@/lib/catalog-template-media";
import { seedMenuFromTemplate } from "@/lib/menu.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

type Props = { establishmentId: string | undefined; kind?: "menu" | "catalog" };

export function MenuTemplatePicker({ establishmentId, kind = "menu" }: Props) {
  const qc = useQueryClient();
  const seed = useServerFn(seedMenuFromTemplate);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "reset">("append");

  const mut = useMutation({
    mutationFn: () => seed({ data: { establishment_id: establishmentId!, template_key: selected!, mode, kind } }),
    onSuccess: (r: any) => {
      toast.success(
        `Modelo aplicado: ${r.categories_created} ${kind === "catalog" ? "coleção(ões)" : "categoria(s)"} e ${r.items_created} ${kind === "catalog" ? "produto(s)" : "prato(s)"} criados${
          r.items_skipped_duplicated ? ` (${r.items_skipped_duplicated} duplicados ignorados)` : ""
        }.`
      );
      setOpen(false);
      setSelected(null);
      setMode("append");
      qc.invalidateQueries({ queryKey: ["menu-categories", establishmentId, kind] });
      qc.invalidateQueries({ queryKey: ["menu-items", establishmentId, kind] });
      qc.invalidateQueries({ queryKey: ["menu-overview", establishmentId, kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isCatalog = kind === "catalog";
  const coverImage = (k: string) => (isCatalog ? catalogCoverImage(k) : templateCoverImage(k));
  const categoryImage = (k: string, name: string) =>
    isCatalog ? catalogCategoryImage(k, name) : templateCategoryImage(k, name);
  const TEMPLATES: any[] = isCatalog ? CATALOG_TEMPLATES : MENU_TEMPLATES;
  const current = TEMPLATES.find((t) => t.key === selected) ?? null;
  const L = isCatalog
    ? { unit: "produto", units: "produtos", groups: "coleções", title: "Comece com um modelo de catálogo", target: "catálogo" }
    : { unit: "prato", units: "pratos", groups: "categorias", title: "Comece com um modelo de cardápio", target: "cardápio" };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!establishmentId}>
          <Sparkles className="mr-2 h-4 w-4" /> Modelos prontos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {L.title}
          </DialogTitle>
          <DialogDescription>
            {isCatalog
              ? "Escolha um segmento e nós criamos as coleções e produtos prontos (nome, descrição, preço sugerido e código). Você pode editar tudo depois."
              : "Escolha um segmento e nós criamos categorias e pratos prontos (com nome, descrição, preço sugerido e etiquetas dietéticas). Você pode editar tudo depois."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {TEMPLATES.map((t: any) => {
            const active = selected === t.key;
            const itemCount = t.categories.reduce((acc: number, c: any) => acc + c.items.length, 0);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelected(t.key)}
                className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary))]"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                {coverImage(t.key) && (
                  <img
                    src={coverImage(t.key)!}
                    alt={`Modelo de ${isCatalog ? "catálogo" : "cardápio"} ${t.label}`}
                    loading="lazy"
                    className="h-20 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="p-3">
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="mt-1 font-semibold leading-tight">{t.label}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t.categories.length} {L.groups} · {itemCount} {L.units}
                  </div>
                </div>
                {active && (
                  <CheckCircle2 className="absolute right-2 top-2 h-4 w-4 text-primary drop-shadow" />
                )}
              </button>

            );
          })}
        </div>

        {current && (
          <Card className="mt-2 max-h-64 overflow-auto p-3">
            <p className="mb-2 text-sm text-muted-foreground">{current.tagline}</p>
            <div className="space-y-2">
              {current.categories.map((c: any) => (
                <div key={c.name} className="rounded-md border bg-muted/30 p-2">
                  <div className="flex items-center gap-2">
                    {categoryImage(current.key, c.name) && (
                      <img
                        src={categoryImage(current.key, c.name)!}
                        alt={c.name}
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="text-sm font-semibold">{c.name}</span>
                    {c.featured && <Badge className="h-4 px-1.5 text-[10px]">Destaque</Badge>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{c.items.length} {L.units}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.items.slice(0, 6).map((i: any) => (
                      <span key={i.name} className="rounded bg-background px-1.5 py-0.5 text-[11px]">
                        {i.name}
                      </span>
                    ))}
                    {c.items.length > 6 && (
                      <span className="text-[11px] text-muted-foreground">+{c.items.length - 6}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {current && (
          <div className="mt-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Como aplicar</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-1 grid gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 ${mode === "append" ? "border-primary bg-primary/5" : ""}`}>
                <RadioGroupItem value="append" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Adicionar ao {L.target} atual</div>
                  <div className="text-[11px] text-muted-foreground">Mantém tudo que já existe. Duplicados são ignorados.</div>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 ${mode === "reset" ? "border-destructive bg-destructive/5" : ""}`}>
                <RadioGroupItem value="reset" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Substituir {L.target}</div>
                  <div className="text-[11px] text-muted-foreground">Remove todas as {L.groups} e {L.units} existentes antes de aplicar.</div>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!selected || mut.isPending || !establishmentId}
          >
            {mut.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aplicando...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Aplicar modelo</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
