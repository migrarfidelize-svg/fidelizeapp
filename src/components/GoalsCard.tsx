import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { upsertGoals } from "@/lib/goals.functions";

type Goals = { stamps_goal: number; customers_goal: number; rewards_goal: number; revenue_goal: number };

export function GoalsCard({
  establishmentId,
  month,
  goals,
  current,
}: {
  establishmentId: string;
  month: string;
  goals: Goals;
  current: { stamps: number; customers: number; rewards: number };
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Goals>(goals);
  const save = useServerFn(upsertGoals);
  const m = useMutation({
    mutationFn: () => save({ data: { establishment_id: establishmentId, month, ...form } }),
    onSuccess: () => {
      toast.success("Metas atualizadas!");
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar metas"),
  });

  const rows = [
    { label: "Novos clientes", now: current.customers, goal: goals.customers_goal },
    { label: "Carimbos", now: current.stamps, goal: goals.stamps_goal },
    { label: "Recompensas resgatadas", now: current.rewards, goal: goals.rewards_goal },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold">Metas do mês</h3>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setForm(goals); }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">Editar metas</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Metas de {new Date(month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-2">
                {(["customers_goal","stamps_goal","rewards_goal","revenue_goal"] as const).map((k) => (
                  <div key={k} className="grid gap-1.5">
                    <Label htmlFor={k}>{{
                      customers_goal: "Novos clientes",
                      stamps_goal: "Carimbos",
                      rewards_goal: "Recompensas resgatadas",
                      revenue_goal: "Receita estimada (R$)",
                    }[k]}</Label>
                    <Input id={k} type="number" min={0} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) || 0 })} />
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => m.mutate()} disabled={m.isPending} className="gradient-brand text-primary-foreground">
                  {m.isPending ? "Salvando…" : "Salvar metas"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="mt-4 space-y-4">
          {rows.map((r) => {
            const pct = r.goal > 0 ? Math.min(100, (r.now / r.goal) * 100) : 0;
            return (
              <div key={r.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">
                    {r.now.toLocaleString("pt-BR")}
                    {r.goal > 0 && <> / {r.goal.toLocaleString("pt-BR")} · <b className={pct >= 100 ? "text-success" : ""}>{Math.round(pct)}%</b></>}
                    {r.goal === 0 && <> · sem meta</>}
                  </span>
                </div>
                {r.goal > 0 && <Progress value={pct} className="mt-1.5 h-2" />}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
