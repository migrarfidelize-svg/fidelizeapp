import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Wand2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { improveItemDescription, applyItemDescription } from "@/lib/ai-menu.functions";
import type { ShowcaseKind } from "@/lib/showcase";

type Mode = "improve" | "create" | "fix" | "shorten" | "appetizing" | "premium" | "delivery";

const MODE_LABELS: Record<Mode, string> = {
  improve: "Melhorar",
  create: "Criar do zero",
  fix: "Corrigir gramática",
  shorten: "Encurtar",
  appetizing: "Apetitosa",
  premium: "Premium / sofisticada",
  delivery: "Otimizar para delivery",
};

export function ImproveWithAiButton({
  establishmentId,
  itemId,
  itemName,
  currentDescription,
  kind,
  compact,
}: {
  establishmentId: string;
  itemId: string;
  itemName: string;
  currentDescription: string | null;
  kind: ShowcaseKind;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(currentDescription ? "improve" : "create");
  const [before, setBefore] = useState<string>(currentDescription ?? "");
  const [after, setAfter] = useState<string>("");
  const [editable, setEditable] = useState<string>("");

  const improveFn = useServerFn(improveItemDescription);
  const applyFn = useServerFn(applyItemDescription);

  const gen = useMutation({
    mutationFn: (m: Mode) => improveFn({ data: { establishment_id: establishmentId, item_id: itemId, surface: kind, mode: m } }),
    onSuccess: (r) => {
      setBefore(r.before ?? currentDescription ?? "");
      setAfter(r.after ?? "");
      setEditable(r.after ?? "");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: (text: string) => applyFn({ data: { item_id: itemId, description: text } }),
    onSuccess: () => {
      toast.success("Descrição atualizada");
      qc.invalidateQueries({ queryKey: ["menu-items"] });
      qc.invalidateQueries({ queryKey: ["menu-overview"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDialog = () => {
    setOpen(true);
    setBefore(currentDescription ?? "");
    setAfter("");
    setEditable("");
    const initialMode: Mode = currentDescription ? "improve" : "create";
    setMode(initialMode);
    gen.mutate(initialMode);
  };

  return (
    <>
      {compact ? (
        <Button size="icon" variant="ghost" onClick={openDialog} title="Melhorar com IA">
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={openDialog}>
          <Sparkles className="mr-2 h-4 w-4 text-primary" /> Melhorar com IA
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" /> Melhorar descrição com IA
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{itemName}</p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label>Estilo da nova descrição</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODE_LABELS) as Mode[]).map(m => (
                      <SelectItem key={m} value={m}>{MODE_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => gen.mutate(mode)} disabled={gen.isPending}>
                {gen.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Gerar novamente
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Texto anterior</Label>
                <div className="min-h-[110px] whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                  {before || <span className="text-muted-foreground italic">Sem descrição atual</span>}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-primary">Nova sugestão da IA</Label>
                {gen.isPending && !after ? (
                  <div className="flex min-h-[110px] items-center justify-center rounded-xl border border-primary/40 bg-primary/5 p-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <Textarea
                    value={editable}
                    onChange={(e) => setEditable(e.target.value.slice(0, 240))}
                    rows={5}
                    maxLength={240}
                    placeholder="A sugestão aparecerá aqui..."
                    className="border-primary/30 bg-primary/5"
                  />
                )}
                <p className="text-right text-[11px] text-muted-foreground">{editable.length}/240</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setOpen(false)}>Ignorar</Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => apply.mutate(editable)}
                disabled={!editable.trim() || apply.isPending}
              >
                Editar e aplicar
              </Button>
              <Button
                onClick={() => apply.mutate(after)}
                disabled={!after.trim() || apply.isPending || editable !== after}
                title={editable !== after ? "Você editou o texto — use 'Editar e aplicar'" : "Aplicar sugestão original"}
              >
                {apply.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Aplicar sugestão
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
