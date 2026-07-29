import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/PageHero";
import { AlertTriangle as HeroIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { adminListSubscriptionEvents, adminAckSubscriptionEvent } from "@/lib/admin.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, Bell } from "lucide-react";
import { toast } from "sonner";
import { LoadingSkeleton } from "@/components/states";

export const Route = createFileRoute("/_authenticated/hash/alertas")({
  component: AdminAlertas,
});

const EVENT_LABEL: Record<string, string> = { upgrade: "Upgrade", downgrade: "Downgrade", cancel: "Cancelamento", reactivate: "Reativação", payment_failed: "Falha de pagamento", plan_change: "Mudança de plano" };
const EVENT_STYLE: Record<string, string> = { upgrade: "bg-success/10 text-success", downgrade: "bg-warning/10 text-warning", cancel: "bg-destructive/10 text-destructive", reactivate: "bg-success/10 text-success", payment_failed: "bg-destructive/10 text-destructive", plan_change: "bg-primary-soft text-primary" };

function AdminAlertas() {
  const qc = useQueryClient();
  const [onlyUnack, setOnlyUnack] = useState(true);
  const listFn = useServerFn(adminListSubscriptionEvents);
  const ackFn = useServerFn(adminAckSubscriptionEvent);
  const { data, isLoading } = useQuery({ queryKey: ["admin-alerts", onlyUnack], queryFn: () => listFn({ data: { onlyUnack, limit: 100 } }) });

  const ack = useMutation({
    mutationFn: (event_id: string) => ackFn({ data: { event_id } }),
    onSuccess: () => { toast.success("Marcado como visto"); qc.invalidateQueries({ queryKey: ["admin-alerts"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha"),
  });

  return (
    <div className="space-y-6">
      <PageHero
        icon={HeroIcon}
        eyebrow={"Super Admin · Monitoramento"}
        title={"Alertas críticos"}
        subtitle={"Mudanças de assinatura, falhas de gateway e eventos de risco."}
      />
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Administração</div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Alertas de assinatura</h1>
          <p className="text-sm text-muted-foreground mt-1">Mudanças relevantes: upgrades, downgrades, cancelamentos e falhas de pagamento.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={onlyUnack ? "default" : "outline"} size="sm" onClick={() => setOnlyUnack(true)}>Não vistos</Button>
          <Button variant={!onlyUnack ? "default" : "outline"} size="sm" onClick={() => setOnlyUnack(false)}>Todos</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="p-6"><LoadingSkeleton variant="table" rows={5} /></div>}
          {!isLoading && (data?.length ?? 0) === 0 && <div className="p-8 text-sm text-muted-foreground text-center">Sem alertas {onlyUnack ? "pendentes" : "registrados"}.</div>}
          <div className="divide-y">
            {(data ?? []).map((ev) => (
              <div key={ev.id} className="flex items-start gap-4 p-4">
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded ${EVENT_STYLE[ev.event_type] ?? "bg-muted"}`}>{EVENT_LABEL[ev.event_type] ?? ev.event_type}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="font-semibold">{ev.establishment?.name ?? "—"}</span>
                    {ev.from_plan && ev.to_plan && ev.from_plan !== ev.to_plan && (
                      <span className="text-muted-foreground"> · {ev.from_plan} → {ev.to_plan}</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{ev.message ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(ev.created_at).toLocaleString("pt-BR")}{ev.acknowledged_at && " · visto"}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {ev.establishment && <Button asChild variant="ghost" size="sm"><Link to="/hash/empresa/$id" params={{ id: ev.establishment_id }}><ExternalLink className="h-4 w-4" /></Link></Button>}
                  {!ev.acknowledged_at && <Button variant="outline" size="sm" onClick={() => ack.mutate(ev.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Marcar visto</Button>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
