import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  adminListPlans,
  adminUpdatePlan,
  adminToggleFeature,
  adminDeleteFeature,
  adminCreatePlan,
  adminArchivePlan,
} from "@/lib/plans.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Star, Plus, Trash2, Archive, ArchiveRestore, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/planos/")({
  component: AdminPlansPage,
});

// Curated catalog of features that admins can toggle per plan
const FEATURE_CATALOG: { key: string; name: string; group: string }[] = [
  { key: "loyalty_cards", name: "Cartões de fidelidade digitais", group: "Fidelidade" },
  { key: "custom_stamp_icons", name: "Ícones de carimbo personalizados", group: "Fidelidade" },
  { key: "custom_branding", name: "Marca e cores personalizadas", group: "Fidelidade" },
  { key: "multi_unit", name: "Multi-unidades / filiais", group: "Fidelidade" },
  { key: "campaigns", name: "Campanhas promocionais", group: "Marketing" },
  { key: "email_marketing", name: "E-mail marketing", group: "Marketing" },
  { key: "whatsapp_notifications", name: "Notificações via WhatsApp", group: "Marketing" },
  { key: "push_notifications", name: "Push notifications", group: "Marketing" },
  { key: "qr_generator", name: "Gerador de QR Code / material impresso", group: "Marketing" },
  { key: "customer_crm", name: "CRM de clientes", group: "Clientes" },
  { key: "customer_import", name: "Importação de clientes (CSV)", group: "Clientes" },
  { key: "customer_export", name: "Exportação de clientes", group: "Clientes" },
  { key: "customer_segments", name: "Segmentação avançada", group: "Clientes" },
  { key: "advanced_reports", name: "Relatórios avançados", group: "Analytics" },
  { key: "dashboard_realtime", name: "Dashboard em tempo real", group: "Analytics" },
  { key: "csv_pdf_export", name: "Exportação CSV / PDF", group: "Analytics" },
  { key: "api_access", name: "Acesso à API", group: "Integrações" },
  { key: "webhooks", name: "Webhooks", group: "Integrações" },
  { key: "zapier_integration", name: "Integração Zapier", group: "Integrações" },
  { key: "audit_log", name: "Log de auditoria", group: "Segurança" },
  { key: "sso", name: "SSO / Login corporativo", group: "Segurança" },
  { key: "role_permissions", name: "Perfis e permissões granulares", group: "Segurança" },
  { key: "support_email", name: "Suporte por e-mail", group: "Suporte" },
  { key: "support_priority", name: "Suporte prioritário", group: "Suporte" },
  { key: "support_dedicated", name: "Gerente de conta dedicado", group: "Suporte" },
  { key: "knowledge_base", name: "Base de conhecimento", group: "Suporte" },
];

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function AdminPlansPage() {
  const list = useServerFn(adminListPlans);
  const create = useServerFn(adminCreatePlan);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => list() });
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({ tier: "starter", slug: "", name: "", price_monthly: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Planos e Preços</h1>
          <p className="text-sm text-muted-foreground">Edite tudo de cada plano: preços, limites, recursos e visibilidade.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-2" /> Novo plano</Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {(data ?? []).map((p: any) => (
            <PlanEditor key={p.id} plan={p} />
          ))}
        </Accordion>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} />
              </div>
              <div>
                <Label>Slug (único)</Label>
                <Input value={newPlan.slug} placeholder="ex: pro-plus" onChange={(e) => setNewPlan({ ...newPlan, slug: e.target.value.toLowerCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tier base</Label>
                <Select value={newPlan.tier} onValueChange={(v) => setNewPlan({ ...newPlan, tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Preço mensal (R$)</Label>
                <Input type="number" step="0.01" value={newPlan.price_monthly} onChange={(e) => setNewPlan({ ...newPlan, price_monthly: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                await create({ data: newPlan as any });
                toast.success("Plano criado.");
                setCreating(false);
                setNewPlan({ tier: "starter", slug: "", name: "", price_monthly: 0 });
                qc.invalidateQueries({ queryKey: ["admin-plans"] });
              } catch (e: any) { toast.error(e.message); }
            }}>Criar plano</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanEditor({ plan }: { plan: any }) {
  const upd = useServerFn(adminUpdatePlan);
  const toggle = useServerFn(adminToggleFeature);
  const removeFeature = useServerFn(adminDeleteFeature);
  const archive = useServerFn(adminArchivePlan);
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(plan);
  const [saving, setSaving] = useState(false);

  const enabledFeatures = useMemo(() => {
    const m = new Map<string, any>();
    for (const f of plan.features ?? []) m.set(f.feature_key, f);
    return m;
  }, [plan.features]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof FEATURE_CATALOG> = {};
    for (const f of FEATURE_CATALOG) (g[f.group] ??= []).push(f);
    return g;
  }, []);

  const customFeatures = useMemo(
    () => (plan.features ?? []).filter((f: any) => !FEATURE_CATALOG.find((c) => c.key === f.feature_key)),
    [plan.features],
  );

  const [custom, setCustom] = useState({ key: "", name: "" });

  function set<K extends string>(key: K, value: any) { setForm((f: any) => ({ ...f, [key]: value })); }

  async function save() {
    setSaving(true);
    try {
      await upd({ data: {
        id: plan.id,
        slug: form.slug,
        name: form.name,
        description: form.description,
        currency: form.currency,
        price_monthly: Number(form.price_monthly ?? 0),
        price_yearly: form.price_yearly === "" || form.price_yearly == null ? null : Number(form.price_yearly),
        customer_limit: normLimit(form.customer_limit),
        employee_limit: normLimit(form.employee_limit),
        campaign_limit: normLimit(form.campaign_limit),
        unit_limit: normLimit(form.unit_limit),
        stamp_limit: normLimit(form.stamp_limit),
        email_limit: normLimit(form.email_limit),
        storage_limit_mb: normLimit(form.storage_limit_mb),
        ticket_limit: normLimit(form.ticket_limit),
        trial_days: Number(form.trial_days ?? 0),
        button_text: form.button_text || null,
        display_order: Number(form.display_order ?? 0),
        is_active: !!form.is_active,
        is_featured: !!form.is_featured,
      } });
      toast.success("Plano salvo.");
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <AccordionItem value={plan.id} className="border rounded-xl bg-card overflow-hidden">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{plan.name}</span>
              {plan.is_featured && <Badge variant="default" className="gap-1"><Star className="h-3 w-3" /> Destaque</Badge>}
              <Badge variant={plan.is_active ? "default" : "secondary"}>{plan.is_active ? "Ativo" : "Inativo"}</Badge>
              {plan.archived_at && <Badge variant="destructive">Arquivado</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">{plan.slug} · {plan.subscribers} empresas · {fmtBRL(Number(plan.price_monthly))}/mês</div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="pricing">Preço</TabsTrigger>
            <TabsTrigger value="limits">Limites</TabsTrigger>
            <TabsTrigger value="features">Recursos</TabsTrigger>
            <TabsTrigger value="visibility">Visibilidade</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="grid gap-3 md:grid-cols-2">
            <div><Label>Nome</Label><Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></div>
            <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value.toLowerCase())} /></div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
            <div><Label>Texto do botão</Label><Input value={form.button_text ?? ""} onChange={(e) => set("button_text", e.target.value)} placeholder="Assinar plano" /></div>
            <div><Label>Dias de trial</Label><Input type="number" value={form.trial_days ?? 0} onChange={(e) => set("trial_days", Number(e.target.value))} /></div>
          </TabsContent>

          <TabsContent value="pricing" className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>Moeda</Label>
              <Select value={form.currency ?? "BRL"} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL — Real</SelectItem>
                  <SelectItem value="USD">USD — Dólar</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Preço mensal</Label><Input type="number" step="0.01" value={form.price_monthly ?? 0} onChange={(e) => set("price_monthly", e.target.value)} /></div>
            <div><Label>Preço anual</Label><Input type="number" step="0.01" placeholder="opcional" value={form.price_yearly ?? ""} onChange={(e) => set("price_yearly", e.target.value)} /></div>
          </TabsContent>

          <TabsContent value="limits" className="grid gap-3 md:grid-cols-3">
            {LIMIT_FIELDS.map(([k, label]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Input
                  type="number"
                  placeholder="∞ (deixe vazio p/ ilimitado)"
                  value={form[k] ?? ""}
                  onChange={(e) => set(k, e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group} className="rounded-lg border p-3">
                <div className="text-sm font-semibold mb-2 text-muted-foreground">{group}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  {items.map((f) => {
                    const existing = enabledFeatures.get(f.key);
                    const enabled = !!existing?.enabled;
                    return (
                      <label key={f.key} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted text-sm">
                        <span className="truncate">{f.name}</span>
                        <Switch
                          checked={enabled}
                          onCheckedChange={async (v) => {
                            try {
                              await toggle({ data: { plan_id: plan.id, feature_key: f.key, feature_name: f.name, enabled: v } });
                              qc.invalidateQueries({ queryKey: ["admin-plans"] });
                            } catch (e: any) { toast.error(e.message); }
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="rounded-lg border p-3">
              <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Recursos personalizados</div>
              {customFeatures.length > 0 && (
                <div className="space-y-1 mb-3">
                  {customFeatures.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 text-sm rounded px-2 py-1.5 bg-muted/50">
                      <span className="truncate"><span className="text-muted-foreground text-xs mr-2">{f.feature_key}</span>{f.feature_name}</span>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={f.enabled}
                          onCheckedChange={async (v) => {
                            try {
                              await toggle({ data: { plan_id: plan.id, feature_key: f.feature_key, feature_name: f.feature_name, enabled: v } });
                              qc.invalidateQueries({ queryKey: ["admin-plans"] });
                            } catch (e: any) { toast.error(e.message); }
                          }}
                        />
                        <Button size="icon" variant="ghost" onClick={async () => {
                          try {
                            await removeFeature({ data: { id: f.id } });
                            qc.invalidateQueries({ queryKey: ["admin-plans"] });
                          } catch (e: any) { toast.error(e.message); }
                        }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                <Input placeholder="chave (ex: custom_x)" value={custom.key} onChange={(e) => setCustom({ ...custom, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                <Input placeholder="Nome exibido" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
                <Button onClick={async () => {
                  if (!custom.key || !custom.name) return;
                  try {
                    await toggle({ data: { plan_id: plan.id, feature_key: custom.key, feature_name: custom.name, enabled: true } });
                    setCustom({ key: "", name: "" });
                    qc.invalidateQueries({ queryKey: ["admin-plans"] });
                  } catch (e: any) { toast.error(e.message); }
                }}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="visibility" className="grid gap-3 md:grid-cols-2">
            <div><Label>Ordem de exibição</Label><Input type="number" value={form.display_order ?? 0} onChange={(e) => set("display_order", Number(e.target.value))} /></div>
            <div className="flex flex-col justify-end gap-3">
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!form.is_active} onCheckedChange={(v) => set("is_active", v)} /> Plano ativo (visível para empresas)</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!form.is_featured} onCheckedChange={(v) => set("is_featured", v)} /> Marcar como destaque</label>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await archive({ data: { id: plan.id, archived: !plan.archived_at } });
                toast.success(plan.archived_at ? "Plano reativado." : "Plano arquivado.");
                qc.invalidateQueries({ queryKey: ["admin-plans"] });
              } catch (e: any) { toast.error(e.message); }
            }}
          >
            {plan.archived_at ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Restaurar</> : <><Archive className="h-4 w-4 mr-2" /> Arquivar</>}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

const LIMIT_FIELDS: [string, string][] = [
  ["customer_limit", "Clientes"],
  ["employee_limit", "Funcionários"],
  ["campaign_limit", "Campanhas"],
  ["unit_limit", "Unidades / filiais"],
  ["stamp_limit", "Carimbos / mês"],
  ["email_limit", "E-mails / mês"],
  ["storage_limit_mb", "Armazenamento (MB)"],
  ["ticket_limit", "Tickets de suporte / mês"],
];

function normLimit(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  return Number(v);
}
