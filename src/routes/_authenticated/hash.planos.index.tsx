import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { Layers as HeroIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListPlans, adminUpdatePlan, adminToggleFeature, adminPlanFeatureImpact, adminReconcileFeatureAccess, adminUpdateFeatureLimit } from "@/lib/plans.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Star, Users, Sparkles, UserCog, CheckCircle2, XCircle, Pencil, Loader2, AlertTriangle, Sparkle, Wrench, RefreshCw } from "lucide-react";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hash/planos/")({
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
  const updateLimit = useServerFn(adminUpdateFeatureLimit);
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
  // Features with a numeric daily/monthly limit editable inline
  const LIMIT_FEATURES = new Set(["push_notifications"]);
  // Features whose changes are business-critical → require confirmation
  const SENSITIVE_FEATURES = new Set(["public_reviews", "digital_menu"]);

  // Reconcile / repair feature-access modal
  const reconcileFn = useServerFn(adminReconcileFeatureAccess);
  const [reconcileFeature, setReconcileFeature] = useState<string | null>(null);
  const [reconcileDryRun, setReconcileDryRun] = useState(true);
  const [reconcileResult, setReconcileResult] = useState<any | null>(null);
  const [reconciling, setReconciling] = useState(false);
  async function runReconcile() {
    if (!reconcileFeature) return;
    setReconciling(true);
    try {
      const res = await reconcileFn({ data: { feature_key: reconcileFeature, dry_run: reconcileDryRun } });
      setReconcileResult(res);
      toast.success(reconcileDryRun ? "Diagnóstico concluído." : `Repair aplicado: ${res.repaired_rows} plano(s) sincronizado(s).`);
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setReconciling(false); }
  }

  async function applyToggle(v: boolean, p: any, f: any) {
    try {
      await toggle({ data: { plan_id: p.id, feature_key: f.feature_key, feature_name: f.feature_name, enabled: v } });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success(`Recurso "${f.feature_name}" ${v ? "ativado" : "desativado"} em ${p.name}.`);
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Planos"}
        title={"Planos & preços"}
        subtitle={"Tiers, limites por recurso e regras de upgrade da plataforma."}
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Planos e Preços</h1>
          <p className="text-sm text-muted-foreground">Gerencie os planos disponíveis para as empresas da plataforma.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setReconcileFeature("public_reviews"); setReconcileDryRun(true); setReconcileResult(null); }}>
          <Wrench className="h-4 w-4 mr-1.5" /> Reconciliar caches de features
        </Button>
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
                    <div key={f.id} className="flex items-center justify-between gap-2 text-xs rounded px-2 py-1 hover:bg-muted">
                      <span className="flex items-center gap-2 truncate">
                        {f.enabled ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="truncate">{f.feature_name}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {LIMIT_FEATURES.has(f.feature_key) && f.enabled && (
                          <Input
                            type="number"
                            min={0}
                            className="h-7 w-20 text-xs"
                            placeholder="∞"
                            defaultValue={f.limit_value ?? ""}
                            title="Limite diário (vazio = ilimitado)"
                            onBlur={async (e) => {
                              const raw = e.target.value;
                              const next = raw === "" ? null : Math.max(0, Number(raw));
                              if ((f.limit_value ?? null) === next) return;
                              try {
                                await updateLimit({ data: { plan_id: p.id, feature_key: f.feature_key, feature_name: f.feature_name, limit_value: next } });
                                qc.invalidateQueries({ queryKey: ["admin-plans"] });
                                toast.success(`Limite de "${f.feature_name}" em ${p.name}: ${next == null ? "ilimitado" : `${next}/dia`}.`);
                              } catch (err: any) { toast.error(err.message); }
                            }}
                          />
                        )}
                        <Switch
                          checked={f.enabled}
                          onCheckedChange={(v) => {
                            if (SENSITIVE_FEATURES.has(f.feature_key)) {
                              setConfirmToggle({ plan_id: p.id, plan_name: p.name, feature_key: f.feature_key, feature_name: f.feature_name, next: v });
                            } else {
                              applyToggle(v, p, f);
                            }
                          }}
                        />
                      </div>
                    </div>
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

      <AlertDialog open={!!confirmToggle} onOpenChange={(o) => !o && setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {confirmToggle?.next ? <Sparkle className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
              {confirmToggle?.next ? "Ativar recurso no plano" : "Desativar recurso do plano"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div>
                  Você está prestes a <strong>{confirmToggle?.next ? "ATIVAR" : "DESATIVAR"}</strong> o recurso{" "}
                  <strong>"{confirmToggle?.feature_name}"</strong> no plano <strong>{confirmToggle?.plan_name}</strong>.
                </div>
                {impactQ.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando impacto…</div>
                ) : impactQ.data ? (
                  <div className="rounded-lg border p-3 bg-muted/40 space-y-1.5">
                    <div className="flex justify-between"><span className="text-muted-foreground">Empresas afetadas</span><span className="font-semibold">{impactQ.data.establishments_count}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Plano (tier)</span><span className="font-mono text-xs">{impactQ.data.plan_tier}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Estado atual</span><span>{impactQ.data.currently_enabled ? "Ativo" : "Inativo"}</span></div>
                  </div>
                ) : null}
                {confirmToggle?.next ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                    Todos os lojistas neste plano ganharão acesso imediato ao recurso (o cache do painel dos lojistas expira em até 15s ou ao trocar de aba). Um e-mail automático é enviado quando isso desbloqueia "Avaliações públicas".
                  </div>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    Os lojistas neste plano perderão o acesso ao recurso. QRs de avaliação já criados continuam existindo, mas a geração de novos QRs e o backend serão bloqueados — cada tentativa aparecerá em <strong>/hash/avaliações → Bloqueios de plano</strong>.
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground">Esta ação é registrada em auditoria com data, responsável e diferença antes/depois.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={async () => {
                if (!confirmToggle) return;
                setSaving(true);
                try {
                  await toggle({ data: { plan_id: confirmToggle.plan_id, feature_key: confirmToggle.feature_key, feature_name: confirmToggle.feature_name, enabled: confirmToggle.next } });
                  qc.invalidateQueries({ queryKey: ["admin-plans"] });
                  toast.success(`Recurso "${confirmToggle.feature_name}" ${confirmToggle.next ? "ativado" : "desativado"} em ${confirmToggle.plan_name}.`);
                  setConfirmToggle(null);
                } catch (e: any) { toast.error(e.message); }
                finally { setSaving(false); }
              }}
            >
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aplicando…</> : (confirmToggle?.next ? "Ativar recurso" : "Desativar recurso")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!reconcileFeature} onOpenChange={(o) => { if (!o) { setReconcileFeature(null); setReconcileResult(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Reconciliar caches de features</DialogTitle>
            <DialogDescription>
              Cruza planos × plan_features × estabelecimentos para verificar divergências entre o toggle desta tela, o gate no gerador de QR e o <code>assertFeature</code> do backend. Emite broadcast que força o cliente do lojista a recarregar o gate imediatamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Label className="w-24">Recurso</Label>
              <Input value={reconcileFeature ?? ""} onChange={(e) => setReconcileFeature(e.target.value)} className="flex-1 font-mono text-xs" />
            </div>
            <label className="flex items-center gap-2">
              <Switch checked={reconcileDryRun} onCheckedChange={setReconcileDryRun} />
              <span>Modo diagnóstico (dry-run) — não altera nenhuma linha, apenas retorna o mapa autoritativo.</span>
            </label>
            {!reconcileDryRun && (
              <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                Repair ativo: irá reescrever (upsert idempotente, mantendo o valor atual) cada linha de plan_features do recurso, disparando postgres_changes para todos os lojistas online — sem alterar quem tem ou não acesso.
              </div>
            )}

            {reconcileResult && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex gap-4 text-xs flex-wrap">
                  <span><strong>{reconcileResult.total_allowed}</strong> com acesso</span>
                  <span><strong>{reconcileResult.total_blocked}</strong> bloqueados</span>
                  <span className={reconcileResult.divergence_count > 0 ? "text-destructive font-semibold" : ""}>
                    <strong>{reconcileResult.divergence_count}</strong> divergências
                  </span>
                  {!reconcileResult.dry_run && <span><strong>{reconcileResult.repaired_rows}</strong> linhas sincronizadas</span>}
                </div>
                <div>
                  <div className="text-xs font-semibold mb-1">Habilitação por tier</div>
                  <div className="flex gap-2 flex-wrap">
                    {reconcileResult.plans_summary.map((p: any) => (
                      <Badge key={p.tier} variant={p.enabled ? "default" : "outline"}>{p.tier}: {p.enabled ? "on" : "off"}</Badge>
                    ))}
                  </div>
                </div>

                {reconcileResult.divergence_count > 0 && (
                  <div className="rounded border border-destructive/40 bg-destructive/5 p-2">
                    <div className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> {reconcileResult.divergence_count} empresa(s) afetada(s) por divergência
                    </div>
                    <ul className="text-xs space-y-0.5">
                      {reconcileResult.divergences.slice(0, 10).map((d: any) => (
                        <li key={d.id}>
                          <strong>{d.name}</strong> <span className="text-muted-foreground">/{d.slug}</span> — tier <code>{d.plan_tier}</code> — <em>{d.divergence === "orphan_tier" ? "tier órfão (plano não existe em plans)" : "sem linha em plan_features (fail-closed)"}</em>
                        </li>
                      ))}
                      {reconcileResult.divergences.length > 10 && <li className="text-muted-foreground">…e mais {reconcileResult.divergences.length - 10}</li>}
                    </ul>
                    <div className="text-xs mt-1 text-muted-foreground">
                      {reconcileResult.dry_run ? "Aplicar repair vai inserir as linhas faltantes de plan_features e disparar refresh nos clientes online." : "Repair aplicado — verifique novamente rodando um novo diagnóstico."}
                    </div>
                  </div>
                )}

                <div className="max-h-64 overflow-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-1">Empresa</th>
                        <th className="px-2 py-1">Plano</th>
                        <th className="px-2 py-1">Ativa</th>
                        <th className="px-2 py-1">Feature</th>
                        <th className="px-2 py-1">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconcileResult.establishments.map((e: any) => (
                        <tr key={e.id} className={`border-t ${e.divergence ? "bg-destructive/5" : ""}`}>
                          <td className="px-2 py-1">{e.name} <span className="text-muted-foreground">/{e.slug}</span></td>
                          <td className="px-2 py-1"><Badge variant="outline">{e.plan_tier}</Badge></td>
                          <td className="px-2 py-1">{e.active ? "sim" : "não"}</td>
                          <td className="px-2 py-1">{e.feature_allowed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}</td>
                          <td className="px-2 py-1 text-[10px] uppercase text-destructive">{e.divergence ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReconcileFeature(null); setReconcileResult(null); }}>Fechar</Button>
            <Button onClick={runReconcile} disabled={reconciling || !reconcileFeature}>
              {reconciling ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Executando…</> : <><RefreshCw className="h-4 w-4 mr-1.5" />{reconcileDryRun ? "Rodar diagnóstico" : "Aplicar repair"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
