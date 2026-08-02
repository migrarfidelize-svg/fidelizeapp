import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageHero } from "@/components/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, Bike, ShoppingBag, Wrench, Wallet, Loader2, Save } from "lucide-react";
import { listPlatformFees, upsertPlatformFee, upsertCourierPlan } from "@/lib/couriers.functions";

export const Route = createFileRoute("/_authenticated/hash/taxas")({
  head: () => ({
    meta: [
      { title: "Taxas da plataforma — Fidelize Admin" },
      { name: "description", content: "Central única de taxas: entregas, vendas, serviços, saques e assinaturas." },
    ],
  }),
  component: TaxasPage,
});

const CATEGORY_ICON: Record<string, any> = {
  delivery: Bike, product_sale: ShoppingBag, service: Wrench, withdrawal: Wallet, subscription: Percent, other: Percent,
};
const CATEGORY_LABEL: Record<string, string> = {
  delivery: "Entregas", product_sale: "Vendas de produtos", service: "Serviços",
  withdrawal: "Saques", subscription: "Assinaturas", other: "Outras",
};

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function TaxasPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlatformFees);
  const q = useQuery({ queryKey: ["platform-fees"], queryFn: () => listFn() });

  const fees = (q.data as any)?.fees ?? [];
  const plans = (q.data as any)?.plans ?? [];
  const active = fees.filter((f: any) => f.is_active).length;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHero
        icon={Percent}
        eyebrow="Financeiro"
        title="Central de Taxas"
        subtitle="Todas as taxas do sistema em um só lugar — entregas, vendas, serviços e saques. O que estiver aqui vale no servidor."
        ticker={[
          { label: "Taxas ativas", value: active, icon: Percent },
          { label: "Regras", value: fees.length, icon: Wrench },
          { label: "Planos de entregador", value: plans.length, icon: Bike },
        ]}
      />

      <Tabs defaultValue="taxas">
        <TabsList>
          <TabsTrigger value="taxas"><Percent className="mr-1 h-4 w-4" />Taxas</TabsTrigger>
          <TabsTrigger value="planos"><Bike className="mr-1 h-4 w-4" />Planos de entregador</TabsTrigger>
        </TabsList>

        <TabsContent value="taxas" className="mt-6">
          {q.isLoading ? (
            <div className="grid h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {fees.map((f: any) => (
                <FeeCard key={f.id ?? f.key} fee={f} onSaved={() => qc.invalidateQueries({ queryKey: ["platform-fees"] })} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="planos" className="mt-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((p: any) => (
              <PlanCard key={p.id ?? p.code} plan={p} onSaved={() => qc.invalidateQueries({ queryKey: ["platform-fees"] })} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeeCard({ fee, onSaved }: { fee: any; onSaved: () => void }) {
  const saveFn = useServerFn(upsertPlatformFee);
  const [form, setForm] = useState({
    percent: String(fee.percent ?? 0),
    fixed: String(fee.fixed_cents ?? 0),
    min: String(fee.min_cents ?? 0),
    active: !!fee.is_active,
  });
  const Icon = CATEGORY_ICON[fee.category] ?? Percent;

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: fee.id,
          key: fee.key,
          label: fee.label,
          description: fee.description ?? null,
          category: fee.category,
          percent: Number(form.percent.replace(",", ".")) || 0,
          fixed_cents: Math.round(Number(form.fixed) || 0),
          min_cents: Math.round(Number(form.min) || 0),
          max_cents: fee.max_cents ?? null,
          applies_to: fee.applies_to ?? "all",
          is_active: form.active,
          sort_order: fee.sort_order ?? 0,
        },
      }),
    onSuccess: () => { toast.success(`${fee.label} atualizada`); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="card-icon"><Icon className="h-4 w-4" /></span>
            {fee.label}
          </CardTitle>
          <Badge variant="outline">{CATEGORY_LABEL[fee.category] ?? fee.category}</Badge>
        </div>
        {fee.description && <p className="text-xs text-muted-foreground">{fee.description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Percentual (%)</Label>
            <Input value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} inputMode="decimal" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Fixo (centavos)</Label>
            <Input value={form.fixed} onChange={(e) => setForm({ ...form, fixed: e.target.value })} inputMode="numeric" className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Mínimo (centavos)</Label>
            <Input value={form.min} onChange={(e) => setForm({ ...form, min: e.target.value })} inputMode="numeric" className="h-9" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Exemplo em uma operação de R$ 10,00: {brl(Math.max(Math.round((1000 * (Number(form.percent.replace(",", ".")) || 0)) / 100) + (Number(form.fixed) || 0), Number(form.min) || 0))}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <span className="text-sm">{form.active ? "Ativa" : "Desativada"}</span>
          </div>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanCard({ plan, onSaved }: { plan: any; onSaved: () => void }) {
  const saveFn = useServerFn(upsertCourierPlan);
  const [form, setForm] = useState({
    price: String(plan.price_cents ?? 0),
    percent: String(plan.fee_percent ?? 0),
    min: String(plan.fee_min_cents ?? 0),
    daily: String(plan.daily_limit_cents ?? 0),
    weekly: String(plan.weekly_withdrawals ?? 2),
    free: String(plan.free_withdrawals_month ?? 0),
    active: !!plan.is_active,
  });

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description ?? null,
          price_cents: Math.round(Number(form.price) || 0),
          fee_percent: Number(form.percent.replace(",", ".")) || 0,
          fee_min_cents: Math.round(Number(form.min) || 0),
          daily_limit_cents: Math.round(Number(form.daily) || 0),
          weekly_withdrawals: Math.round(Number(form.weekly) || 0),
          free_withdrawals_month: Math.round(Number(form.free) || 0),
          sort_order: plan.sort_order ?? 0,
          is_active: form.active,
        },
      }),
    onSuccess: () => { toast.success(`Plano ${plan.name} atualizado`); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          {plan.name}
          <Badge variant="outline">{brl(Number(form.price) || 0)}/mês</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Row label="Preço (centavos)" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
        <Row label="Taxa por entrega (%)" value={form.percent} onChange={(v) => setForm({ ...form, percent: v })} />
        <Row label="Piso da taxa (centavos)" value={form.min} onChange={(v) => setForm({ ...form, min: v })} />
        <Row label="Limite diário (centavos)" value={form.daily} onChange={(v) => setForm({ ...form, daily: v })} />
        <Row label="Saques por semana" value={form.weekly} onChange={(v) => setForm({ ...form, weekly: v })} />
        <Row label="Saques grátis / mês" value={form.free} onChange={(v) => setForm({ ...form, free: v })} />
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <span className="text-sm">{form.active ? "Ativo" : "Inativo"}</span>
          </div>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="h-8 w-28 text-right" />
    </div>
  );
}
