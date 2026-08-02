import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Award, LogOut, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { changeCourierPlan, getCourierWallet, getMyCourier } from "@/lib/courier-app.functions";

export const Route = createFileRoute("/_authenticated/entregador/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil do Entregador — Fidelize" },
      { name: "description", content: "Seu nível, avaliações e plano de entregador dentro do Fidelize." },
      { property: "og:title", content: "Perfil do Entregador — Fidelize" },
      { property: "og:description", content: "Nível, reputação e plano de taxas do entregador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CourierProfile,
});

const money = (c?: number | null) => `R$ ${((c ?? 0) / 100).toFixed(2).replace(".", ",")}`;

function CourierProfile() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const { data: me } = useQuery({ queryKey: ["courier", "me"], queryFn: () => getMyCourier() });
  const { data: wallet } = useQuery({ queryKey: ["courier", "wallet"], queryFn: () => getCourierWallet() });
  const courier = me?.courier ?? null;

  async function pickPlan(code: string) {
    setBusy(true);
    try {
      const r = await changeCourierPlan({ data: { plan_code: code } });
      if (!r.ok && r.requires_payment) {
        toast.info("Plano pago: finalize a assinatura para ativar as taxas reduzidas.");
      } else {
        toast.success("Plano atualizado!");
      }
      await qc.invalidateQueries({ queryKey: ["courier"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!courier) return <p className="py-16 text-center text-sm text-muted-foreground">Complete seu cadastro.</p>;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <div className="card-icon grid h-14 w-14 shrink-0 place-items-center rounded-2xl">
            <Trophy className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black">{courier.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {courier.vehicle_type} {courier.vehicle_plate ? `· ${courier.vehicle_plate}` : ""}
              {courier.city ? ` · ${courier.city}` : ""}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-muted-foreground">
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="metric-number flex items-center justify-center gap-1 text-base text-foreground">
              <Star className="h-3.5 w-3.5 text-primary" />
              {Number(courier.rating_avg ?? 0).toFixed(1)}
            </p>
            <p>Reputação</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="metric-number text-base text-foreground">{courier.deliveries_count ?? 0}</p>
            <p>Entregas</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-base font-black uppercase text-foreground">{courier.level_code}</p>
            <p>Nível</p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Planos de taxa</h2>
        {(wallet?.plans ?? []).map((p: any) => {
          const current = p.code === courier.plan_code;
          return (
            <div
              key={p.code}
              className={
                "rounded-2xl border p-4 " + (current ? "border-primary/40 bg-primary/5" : "border-border bg-card")
              }
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Taxa {Number(p.fee_percent)}% (mín. {money(p.fee_min_cents)}) · {p.weekly_withdrawals} saque(s)/semana
                    {p.free_withdrawals_month > 0 ? ` · ${p.free_withdrawals_month} sem taxa/mês` : ""}
                  </p>
                </div>
                <span className="metric-number shrink-0 text-sm">
                  {p.price_cents > 0 ? `${money(p.price_cents)}/mês` : "Grátis"}
                </span>
              </div>
              <Button
                variant={current ? "secondary" : "outline"}
                className="mt-3 min-h-[44px] w-full text-xs"
                disabled={current || busy}
                onClick={() => pickPlan(p.code)}
              >
                {current ? "Plano atual" : "Escolher este plano"}
              </Button>
            </div>
          );
        })}
      </section>

      <CourierInstallCard />

      <Button variant="outline" className="min-h-[48px] w-full" onClick={() => navigate({ to: "/entregador/cadastro" })}>
        <Award className="mr-2 h-4 w-4" /> Editar dados e documentos
      </Button>
      <Button variant="ghost" className="min-h-[48px] w-full text-muted-foreground" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
