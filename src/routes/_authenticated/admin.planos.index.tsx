import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListPlans, adminUpdatePlan, adminToggleFeature, adminPlanFeatureImpact } from "@/lib/plans.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, Users, Sparkles, UserCog, CheckCircle2, XCircle, Pencil, Loader2, AlertTriangle, Sparkle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/planos/")({
  component: AdminPlansPage,
});

function formatCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtLimit(v: number | null | undefined) {
  return v == null ? "Ilimitado" : v.toString();
}

function AdminPlansPage() {
  const list = useServerFn(adminListPlans);
  const upd = useServerFn(adminUpdatePlan);
  const toggle = useServerFn(adminToggleFeature);
  const impactFn = useServerFn(adminPlanFeatureImpact);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => list() });
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<null | {
    plan_id: string; plan_name: string; feature_key: string; feature_name: string; next: boolean;
  }>(null);
  const impactQ = useQuery({
    queryKey: ["plan-feature-impact", confirmToggle?.plan_id, confirmToggle?.feature_key],
    queryFn: () => impactFn({ data: { plan_id: confirmToggle!.plan_id, feature_key: confirmToggle!.feature_key } }),
    enabled: !!confirmToggle,
  });
  const [saving, setSaving] = useState(false);
  // Features whose changes are business-critical → require confirmation
  const SENSITIVE_FEATURES = new Set(["public_reviews"]);

  async function applyToggle(v: boolean, p: any, f: any) {
    try {
      await toggle({ data: { plan_id: p.id, feature_key: f.feature_key, feature_name: f.feature_name, enabled: v } });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success(`Recurso "${f.feature_name}" ${v ? "ativado" : "desativado"} em ${p.name}.`);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Planos e Preços</h1>
        <p className="text-sm text-muted-foreground">Gerencie os planos disponíveis para as empresas da plataforma.</p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {(data ?? []).map((p: any) => (
            <Card key={p.id} className={`relative ${p.is_featured ? "border-primary shadow-lg" : ""}`}>
              {p.is_featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1"><Star className="h-3 w-3" /> Destaque</Badge>
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{p.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>
                    {p.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold">{formatCurrency(Number(p.price_monthly))}</div>
                  <div className="text-xs text-muted-foreground">/mês</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted p-2">
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{fmtLimit(p.customer_limit)}</div>
                    <div className="text-muted-foreground">clientes</div>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <Sparkles className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{fmtLimit(p.campaign_limit)}</div>
                    <div className="text-muted-foreground">campanhas</div>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <UserCog className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <div className="font-semibold">{fmtLimit(p.employee_limit)}</div>
                    <div className="text-muted-foreground">equipe</div>
                  </div>
                </div>

                <div className="space-y-1 max-h-40 overflow-auto pr-1">
                  {(p.features ?? []).map((f: any) => (
                    <label key={f.id} className="flex items-center justify-between gap-2 text-xs rounded px-2 py-1 hover:bg-muted">
                      <span className="flex items-center gap-2 truncate">
                        {f.enabled ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="truncate">{f.feature_name}</span>
                      </span>
                      <Switch
                        checked={f.enabled}
                        onCheckedChange={async (v) => {
                          try {
                            await toggle({ data: { plan_id: p.id, feature_key: f.feature_key, feature_name: f.feature_name, enabled: v } });
                            qc.invalidateQueries({ queryKey: ["admin-plans"] });
                          } catch (e: any) { toast.error(e.message); }
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                  <span>{p.subscribers} empresas</span>
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar plano</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Ordem</Label><Input type="number" value={editing.display_order} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Descrição</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço mensal (R$)</Label><Input type="number" step="0.01" value={editing.price_monthly ?? 0} onChange={(e) => setEditing({ ...editing, price_monthly: Number(e.target.value) })} /></div>
                <div><Label>Preço anual (R$)</Label><Input type="number" step="0.01" value={editing.price_yearly ?? ""} onChange={(e) => setEditing({ ...editing, price_yearly: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Clientes</Label><Input type="number" placeholder="∞" value={editing.customer_limit ?? ""} onChange={(e) => setEditing({ ...editing, customer_limit: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                <div><Label>Campanhas</Label><Input type="number" placeholder="∞" value={editing.campaign_limit ?? ""} onChange={(e) => setEditing({ ...editing, campaign_limit: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                <div><Label>Equipe</Label><Input type="number" placeholder="∞" value={editing.employee_limit ?? ""} onChange={(e) => setEditing({ ...editing, employee_limit: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              </div>
              <div><Label>Texto do botão</Label><Input value={editing.button_text ?? ""} onChange={(e) => setEditing({ ...editing, button_text: e.target.value })} /></div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Ativo</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_featured} onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })} /> Destaque</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                await upd({ data: {
                  id: editing.id,
                  name: editing.name,
                  description: editing.description,
                  price_monthly: Number(editing.price_monthly ?? 0),
                  price_yearly: editing.price_yearly,
                  customer_limit: editing.customer_limit,
                  campaign_limit: editing.campaign_limit,
                  employee_limit: editing.employee_limit,
                  is_active: editing.is_active,
                  is_featured: editing.is_featured,
                  display_order: editing.display_order,
                  button_text: editing.button_text,
                } });
                toast.success("Plano atualizado.");
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["admin-plans"] });
              } catch (e: any) { toast.error(e.message); }
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
