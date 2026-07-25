import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";

import { MENU_TEMPLATES } from "@/lib/menu-templates";
import { templateCategoryImage, templateCoverImage } from "@/lib/menu-template-media";
import { seedMenuFromTemplate } from "@/lib/menu.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";

type Props = { establishmentId: string | undefined };

export function MenuTemplatePicker({ establishmentId }: Props) {
  const qc = useQueryClient();
  const seed = useServerFn(seedMenuFromTemplate);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "reset">("append");

  const mut = useMutation({
    mutationFn: () => seed({ data: { establishment_id: establishmentId!, template_key: selected!, mode } }),
    onSuccess: (r: any) => {
      toast.success(
        `Modelo aplicado: ${r.categories_created} categoria(s) e ${r.items_created} prato(s) criados${
          r.items_skipped_duplicated ? ` (${r.items_skipped_duplicated} duplicados ignorados)` : ""
        }.`
      );
      setOpen(false);
      setSelected(null);
      setMode("append");
      qc.invalidateQueries({ queryKey: ["menu-categories", establishmentId] });
      qc.invalidateQueries({ queryKey: ["menu-items", establishmentId] });
      qc.invalidateQueries({ queryKey: ["menu-overview", establishmentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = MENU_TEMPLATES.find((t) => t.key === selected) ?? null;

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
            <Sparkles className="h-5 w-5 text-primary" /> Comece com um modelo de cardápio
          </DialogTitle>
          <DialogDescription>
            Escolha um segmento e nós criamos categorias e pratos prontos (com nome, descrição, preço sugerido e etiquetas dietéticas). Você pode editar tudo depois.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {MENU_TEMPLATES.map((t) => {
            const active = selected === t.key;
            const itemCount = t.categories.reduce((acc, c) => acc + c.items.length, 0);
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
                {templateCoverImage(t.key) && (
                  <img
                    src={templateCoverImage(t.key)!}
                    alt={`Modelo de cardápio ${t.label}`}
                    loading="lazy"
                    className="h-20 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="p-3">
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="mt-1 font-semibold leading-tight">{t.label}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t.categories.length} categorias · {itemCount} pratos
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
              {current.categories.map((c) => (
                <div key={c.name} className="rounded-md border bg-muted/30 p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.name}</span>
                    {c.featured && <Badge className="h-4 px-1.5 text-[10px]">Destaque</Badge>}
                    <span className="ml-auto text-[11px] text-muted-foreground">{c.items.length} pratos</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.items.slice(0, 6).map((i) => (
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
                  <div className="text-sm font-medium">Adicionar ao cardápio atual</div>
                  <div className="text-[11px] text-muted-foreground">Mantém tudo que já existe. Duplicados são ignorados.</div>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 ${mode === "reset" ? "border-destructive bg-destructive/5" : ""}`}>
                <RadioGroupItem value="reset" className="mt-0.5" />
                <div>
                  <div className="text-sm font-medium">Substituir cardápio</div>
                  <div className="text-[11px] text-muted-foreground">Remove todas as categorias e pratos existentes antes de aplicar.</div>
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
