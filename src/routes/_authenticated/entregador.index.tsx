import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bike,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  ShieldAlert,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  acceptDelivery,
  getMyCourier,
  listCourierOffers,
  pingCourierLocation,
  setCourierOnline,
  updateDeliveryProgress,
} from "@/lib/courier-app.functions";
import { CourierMiniMap } from "@/components/courier/CourierMiniMap";

export const Route = createFileRoute("/_authenticated/entregador/")({
  head: () => ({
    meta: [
      { title: "App do Entregador — Fidelize" },
      { name: "description", content: "Aceite corridas, acompanhe entregas e receba seus ganhos pelo Fidelize." },
      { property: "og:title", content: "App do Entregador — Fidelize" },
      { property: "og:description", content: "Corridas em tempo real, carteira e saques na palma da mão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CourierHome,
});

const money = (c?: number | null) => `R$ ${((c ?? 0) / 100).toFixed(2).replace(".", ",")}`;

function CourierHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: me, isLoading } = useQuery({
    queryKey: ["courier", "me"],
    queryFn: () => getMyCourier(),
    staleTime: 10_000,
  });
  const courier = me?.courier ?? null;
  const approved = courier?.status === "approved";

  const { data: feed } = useQuery({
    queryKey: ["courier", "offers"],
    queryFn: () => listCourierOffers(),
    enabled: !!approved,
    refetchInterval: courier?.is_online ? 8000 : false,
  });

  // Envia posição enquanto estiver online (usado no mapa do lojista).
  useEffect(() => {
    if (!approved || !courier?.is_online || typeof navigator === "undefined" || !navigator.geolocation) return;
    const send = () =>
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void pingCourierLocation({
            data: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy_m: pos.coords.accuracy ?? null,
              speed_kmh: pos.coords.speed != null ? Math.max(pos.coords.speed * 3.6, 0) : null,
            },
          }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      );
    send();
    const t = window.setInterval(send, 45_000);
    return () => window.clearInterval(t);
  }, [approved, courier?.is_online]);

  async function toggleOnline(next: boolean) {
    try {
      await setCourierOnline({ data: { online: next } });
      await qc.invalidateQueries({ queryKey: ["courier"] });
      toast.success(next ? "Você está online. Boas corridas!" : "Você ficou offline.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function run(id: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(id);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["courier"] });
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">Carregando…</p>;

  if (!courier) {
    return (
      <div className="rounded-3xl border border-border bg-card p-6 text-center">
        <div className="card-icon mx-auto grid h-14 w-14 place-items-center rounded-2xl">
          <Bike className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-black">Seja um entregador Fidelize</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre-se em poucos minutos, envie seus documentos e comece a receber corridas dos
          estabelecimentos da sua cidade.
        </p>
        <Button className="mt-5 w-full" onClick={() => navigate({ to: "/entregador/cadastro" })}>
          Começar cadastro
        </Button>
      </div>
    );
  }

  if (!approved) {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {courier.status === "pending" ? "Cadastro em análise" : courier.status === "rejected" ? "Cadastro recusado" : "Conta suspensa"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {courier.rejection_reason ??
                  "Nossa equipe está conferindo seus documentos. Você recebe um aviso assim que for liberado."}
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/entregador/cadastro" })}>
          Revisar dados e documentos
        </Button>
      </div>
    );
  }

  const mine = feed?.mine ?? [];
  const offers = feed?.offers ?? [];

  return (
    <div className="space-y-4">
      {/* Status */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Status</p>
            <p className="truncate text-lg font-black">{courier.is_online ? "Online" : "Offline"}</p>
            <p className="text-xs text-muted-foreground">
              {courier.is_online ? "Recebendo corridas em tempo real" : "Ative para aparecer nas buscas dos lojistas"}
            </p>
          </div>
          <Switch checked={!!courier.is_online} onCheckedChange={toggleOnline} aria-label="Ficar online" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="metric-number text-lg">{courier.deliveries_count ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Entregas</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="metric-number flex items-center justify-center gap-1 text-lg">
              <Star className="h-3.5 w-3.5 text-primary" />
              {Number(courier.rating_avg ?? 0).toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">{courier.rating_count ?? 0} avaliações</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="metric-number text-lg">{money(courier.balance_cents)}</p>
            <p className="text-[10px] text-muted-foreground">Saldo</p>
          </div>
        </div>
      </section>

      {/* Corrida atual */}
      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Corrida atual</h2>
          {mine.map((d: any) => (
            <article key={d.id} className="overflow-hidden rounded-3xl border border-primary/30 bg-card">
              <div className="p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{d.establishments?.name ?? "Estabelecimento"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.status === "accepted" ? "A caminho da coleta" : d.status === "picked_up" ? "Pedido coletado" : "Em rota de entrega"}
                    </p>
                  </div>
                  <span className="metric-number shrink-0 text-base text-primary">{money(d.courier_net_cents)}</span>
                </div>
                <CourierMiniMap
                  className="mt-3 h-40"
                  pickup={{ lat: d.pickup_lat, lng: d.pickup_lng }}
                  dropoff={{ lat: d.dropoff_lat, lng: d.dropoff_lng }}
                />
                <div className="mt-3 space-y-2 text-xs">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0">{d.pickup_address ?? "Endereço de coleta não informado"}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="min-w-0">{d.dropoff_address ?? "Endereço de entrega não informado"}</span>
                  </p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {d.customer_phone && (
                    <Button asChild variant="outline" className="min-h-[52px]">
                      <a href={`tel:${d.customer_phone}`}>
                        <Phone className="mr-2 h-4 w-4" /> Ligar para o cliente
                      </a>
                    </Button>
                  )}
                  {d.dropoff_address && (
                    <Button asChild variant="outline" className="min-h-[52px]">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(d.dropoff_address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Navigation className="mr-2 h-4 w-4" /> Abrir rota
                      </a>
                    </Button>
                  )}
                </div>
                <div className="mt-2 grid gap-2">
                  {d.status === "accepted" && (
                    <Button
                      className="min-h-[56px] text-base"
                      disabled={busy === d.id}
                      onClick={() => run(d.id, () => updateDeliveryProgress({ data: { delivery_id: d.id, status: "picked_up" } }), "Coleta confirmada!")}
                    >
                      <Package className="mr-2 h-5 w-5" /> Confirmar coleta
                    </Button>
                  )}
                  {d.status === "picked_up" && (
                    <Button
                      className="min-h-[56px] text-base"
                      disabled={busy === d.id}
                      onClick={() => run(d.id, () => updateDeliveryProgress({ data: { delivery_id: d.id, status: "in_transit" } }), "Boa viagem!")}
                    >
                      <Bike className="mr-2 h-5 w-5" /> Sair para entrega
                    </Button>
                  )}
                  {(d.status === "in_transit" || d.status === "picked_up") && (
                    <Button
                      variant="secondary"
                      className="min-h-[56px] text-base"
                      disabled={busy === d.id}
                      onClick={() => run(d.id, () => updateDeliveryProgress({ data: { delivery_id: d.id, status: "delivered" } }), "Entrega concluída! Saldo atualizado.")}
                    >
                      <CheckCircle2 className="mr-2 h-5 w-5" /> Finalizar entrega
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="min-h-[44px] text-xs text-muted-foreground"
                    disabled={busy === d.id}
                    onClick={() => run(d.id, () => updateDeliveryProgress({ data: { delivery_id: d.id, status: "cancelled" } }), "Corrida devolvida para a fila.")}
                  >
                    Não consigo fazer esta corrida
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Ofertas */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Corridas disponíveis</h2>
          {courier.is_online && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
              <Zap className="h-3 w-3" /> ao vivo
            </span>
          )}
        </div>

        {!courier.is_online && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Fique online para ver as corridas abertas na sua região.
          </p>
        )}

        {courier.is_online && offers.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Nenhuma corrida agora. Assim que um lojista chamar, ela aparece aqui em segundos.
          </p>
        )}

        {courier.is_online &&
          offers.map((d: any) => (
            <article key={d.id} className="rounded-3xl border border-border bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{d.establishments?.name ?? "Estabelecimento"}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(d.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {d.establishments?.city ? ` · ${d.establishments.city}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="metric-number text-lg text-primary">{money(d.courier_net_cents)}</p>
                  <p className="text-[10px] text-muted-foreground">líquido</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">{d.pickup_address ?? "Coleta no estabelecimento"}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0">{d.dropoff_address ?? "Endereço com o cliente"}</span>
                </p>
              </div>
              <Button
                className="mt-4 min-h-[56px] w-full text-base"
                disabled={busy === d.id}
                onClick={() => run(d.id, () => acceptDelivery({ data: { delivery_id: d.id } }), "Corrida aceita!")}
              >
                Aceitar corrida
              </Button>
            </article>
          ))}
      </section>
    </div>
  );
}
