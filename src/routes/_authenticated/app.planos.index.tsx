import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivePlans, changeEstablishmentPlan, getMyPlanUsage } from "@/lib/plans.functions";
import { getMyEstablishments } from "@/lib/loyalty.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, Check, Loader2, Users, Sparkles, UserCog } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/planos/")({
  component: MerchantPlansPage,
});

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtLimit(v: number | null | undefined) { return v == null ? "Ilimitado" : v.toString(); }

function MerchantPlansPage() {
  const list = useServerFn(listActivePlans);
  const change = useServerFn(changeEstablishmentPlan);
  const getEsts = useServerFn(getMyEstablishments);
  const getUsage = useServerFn(getMyPlanUsage);
  const qc = useQueryClient();
  const { data: memberships } = useQuery({ queryKey: ["memberships"], queryFn: () => getEsts() });
  const activeEst = memberships?.[0]?.establishment as { id: string; plan?: string } | undefined;
  const { data: plans, isLoading } = useQuery({ queryKey: ["active-plans"], queryFn: () => list() });
  const { data: usage } = useQuery({
    queryKey: ["plan-usage", activeEst?.id],
    queryFn: () => getUsage({ data: { establishment_id: activeEst!.id } }),
    enabled: !!activeEst?.id,
  });

  const currentTier = usage?.plan?.tier;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Planos e Preços</h1>
        <p className="text-sm text-muted-foreground">Escolha o plano ideal para o seu negócio.</p>
      </div>

      {usage?.plan && (
        <Card>
          <CardHeader><CardTitle className="text-base">Seu plano atual: {usage.plan.name}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <UsageBar label="Clientes" icon={Users} used={usage.usage.customers} limit={usage.plan.customer_limit} />
            <UsageBar label="Campanhas" icon={Sparkles} used={usage.usage.campaigns} limit={usage.plan.campaign_limit} />
            <UsageBar label="Equipe" icon={UserCog} used={usage.usage.employees} limit={usage.plan.employee_limit} />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          {(plans ?? []).map((p: any) => {
            const isCurrent = p.tier === currentTier;
            return (
              <Card key={p.id} className={`relative flex flex-col ${p.is_featured ? "border-primary shadow-xl md:scale-105" : ""}`}>
                {p.is_featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1"><Star className="h-3 w-3" /> Mais popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{p.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-3">
                    <span className="text-4xl font-bold">{fmtBRL(Number(p.price_monthly))}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-muted p-2"><div className="font-semibold">{fmtLimit(p.customer_limit)}</div><div className="text-muted-foreground">clientes</div></div>
                    <div className="rounded-lg bg-muted p-2"><div className="font-semibold">{fmtLimit(p.campaign_limit)}</div><div className="text-muted-foreground">campanhas</div></div>
                    <div className="rounded-lg bg-muted p-2"><div className="font-semibold">{fmtLimit(p.employee_limit)}</div><div className="text-muted-foreground">equipe</div></div>
                  </div>
                  <ul className="space-y-2 text-sm flex-1">
                    {(p.features ?? []).map((f: any) => (
                      <li key={f.id} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f.feature_name}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={p.is_featured ? "gradient-brand text-primary-foreground w-full" : "w-full"}
                    variant={p.is_featured ? "default" : "outline"}
                    disabled={isCurrent || !activeEst}
                    onClick={async () => {
                      try {
                        await change({ data: { establishment_id: activeEst!.id, plan_slug: p.slug } });
                        toast.success(`Plano alterado para ${p.name}.`);
                        qc.invalidateQueries();
                      } catch (e: any) { toast.error(e.message); }
                    }}
                  >
                    {isCurrent ? "Plano atual" : (p.button_text ?? `Assinar ${p.name}`)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UsageBar({ label, icon: Icon, used, limit }: { label: string; icon: any; used: number; limit: number | null }) {
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const near = pct >= 80 && limit != null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</span>
        <span className={`font-medium ${near ? "text-destructive" : ""}`}>
          {used} / {limit == null ? "∞" : limit}
        </span>
      </div>
      <Progress value={limit == null ? 0 : pct} />
    </div>
  );
}
