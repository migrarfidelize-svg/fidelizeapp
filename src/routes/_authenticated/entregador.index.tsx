import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bike,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  ShieldAlert,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  acceptDelivery,
  getCourierWallet,
  getMyCourier,
  listCourierOffers,
  pingCourierLocation,
  setCourierOnline,
  updateDeliveryProgress,
} from "@/lib/courier-app.functions";
import { CourierRouteMap } from "@/components/courier/CourierRouteMap";
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

const WITHDRAW_STATUS: Record<string, string> = {
  requested: "Solicitado",
  processing: "Processando",
  paid: "Pago",
  rejected: "Recusado",
};

function CourierHome() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

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

  const { data: wallet } = useQuery({
    queryKey: ["courier", "wallet"],
    queryFn: () => getCourierWallet(),
    enabled: !!approved,
    staleTime: 60_000,
  });

  // Envia posição enquanto estiver online (usado no mapa do lojista).
  useEffect(() => {
    if (!approved || !courier?.is_online || typeof navigator === "undefined" || !navigator.geolocation) return;
    const send = () =>
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          void pingCourierLocation({
            data: {
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracy_m: p.coords.accuracy ?? null,
              speed_kmh: p.coords.speed != null ? Math.max(p.coords.speed * 3.6, 0) : null,
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
  const active = mine[0] ?? null;
  const withdrawals = (wallet?.withdrawals ?? []).slice(0, 3);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Mapa em tela cheia */}
      <div className="absolute inset-0">
        {active ? (
          <CourierRouteMap
            bare
            className="h-full w-full"
            deliveryId={active.id}
            pickup={{ lat: active.pickup_lat, lng: active.pickup_lng }}
            dropoff={{ lat: active.dropoff_lat, lng: active.dropoff_lng }}
            courier={pos}
          />
        ) : (
          <CourierMiniMap bare className="h-full w-full" width={360} height={640} courier={pos} />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background/90 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Cabeçalho flutuante */}
      <header className="absolute inset-x-0 top-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-3xl border border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-tight">{courier.full_name}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={
                  "inline-block h-2 w-2 rounded-full " + (courier.is_online ? "bg-primary" : "bg-muted-foreground/50")
                }
              />
              {courier.is_online ? "Online — recebendo corridas" : "Offline"}
            </p>
          </div>
          <Switch checked={!!courier.is_online} onCheckedChange={toggleOnline} aria-label="Ficar online" />
        </div>
      </header>

      {/* Painel inferior deslizante */}
      <section
        className={
          "absolute inset-x-0 bottom-[60px] z-20 mx-auto flex max-w-3xl flex-col rounded-t-3xl border-t border-border/70 bg-background/95 backdrop-blur-xl transition-[max-height] duration-300 " +
          (expanded ? "max-h-[62dvh]" : "max-h-[168px]")
        }
      >
        <button
          className="flex w-full items-center justify-center py-2"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Recolher painel" : "Expandir painel"}
        >
          <span className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
          {expanded ? (
            <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="ml-2 h-4 w-4 text-muted-foreground" />
          )}
        </button>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-16">
          {/* Resumo financeiro */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Link to="/entregador/carteira" className="rounded-2xl bg-muted/50 p-3">
              <p className="metric-number text-base">{money(courier.balance_cents)}</p>
              <p className="text-[10px] text-muted-foreground">Saldo</p>
            </Link>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="metric-number text-base">{courier.deliveries_count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Entregas</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="metric-number flex items-center justify-center gap-1 text-base">
                <Star className="h-3.5 w-3.5 text-primary" />
                {Number(courier.rating_avg ?? 0).toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">{courier.rating_count ?? 0} avaliações</p>
            </div>
          </div>

          {/* Corrida atual */}
          {active && (
            <article className="rounded-3xl border border-primary/30 bg-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{active.establishments?.name ?? "Estabelecimento"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {active.status === "accepted"
                      ? "A caminho da coleta"
                      : active.status === "picked_up"
                        ? "Pedido coletado"
                        : "Em rota de entrega"}
                  </p>
                </div>
                <span className="metric-number shrink-0 text-base text-primary">{money(active.courier_net_cents)}</span>
              </div>
              <div className="mt-3 space-y-2 text-xs">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">{active.pickup_address ?? "Endereço de coleta não informado"}</span>
                </p>
                <p className="flex items-start gap-2">
                  <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span className="min-w-0">{active.dropoff_address ?? "Endereço de entrega não informado"}</span>
                </p>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {active.customer_phone && (
                  <Button asChild variant="outline" className="min-h-[52px]">
                    <a href={`tel:${active.customer_phone}`}>
                      <Phone className="mr-2 h-4 w-4" /> Ligar
                    </a>
                  </Button>
                )}
                {active.dropoff_address && (
                  <Button asChild variant="outline" className="min-h-[52px]">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(active.dropoff_address)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="mr-2 h-4 w-4" /> Abrir rota
                    </a>
                  </Button>
                )}
              </div>
              <div className="mt-2 grid gap-2">
                {active.status === "accepted" && (
                  <Button
                    className="min-h-[56px] text-base"
                    disabled={busy === active.id}
                    onClick={() =>
                      run(active.id, () => updateDeliveryProgress({ data: { delivery_id: active.id, status: "picked_up" } }), "Coleta confirmada!")
                    }
                  >
                    <Package className="mr-2 h-5 w-5" /> Confirmar coleta
                  </Button>
                )}
                {active.status === "picked_up" && (
                  <Button
                    className="min-h-[56px] text-base"
                    disabled={busy === active.id}
                    onClick={() =>
                      run(active.id, () => updateDeliveryProgress({ data: { delivery_id: active.id, status: "in_transit" } }), "Boa viagem!")
                    }
                  >
                    <Bike className="mr-2 h-5 w-5" /> Sair para entrega
                  </Button>
                )}
                {(active.status === "in_transit" || active.status === "picked_up") && (
                  <Button
                    variant="secondary"
                    className="min-h-[56px] text-base"
                    disabled={busy === active.id}
                    onClick={() =>
                      run(active.id, () => updateDeliveryProgress({ data: { delivery_id: active.id, status: "delivered" } }), "Entrega concluída! Saldo atualizado.")
                    }
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" /> Finalizar entrega
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="min-h-[44px] text-xs text-muted-foreground"
                  disabled={busy === active.id}
                  onClick={() =>
                    run(active.id, () => updateDeliveryProgress({ data: { delivery_id: active.id, status: "cancelled" } }), "Corrida devolvida para a fila.")
                  }
                >
                  Não consigo fazer esta corrida
                </Button>
              </div>
            </article>
          )}

          {/* Ofertas */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Corridas disponíveis
            </h2>
            {courier.is_online && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-primary">
                <Zap className="h-3 w-3" /> ao vivo
              </span>
            )}
          </div>

          {!courier.is_online && (
            <p className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              Fique online para ver as corridas abertas na sua região.
            </p>
          )}

          {courier.is_online && offers.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
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

          {/* Financeiro rápido: últimos saques */}
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-black">
                  <Wallet className="h-4 w-4 text-primary" /> Últimos saques
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {wallet ? `${wallet.week_count}/${wallet.week_limit} saques nesta semana` : "Carregando…"}
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-[40px] shrink-0 text-xs">
                <Link to="/entregador/carteira">Carteira</Link>
              </Button>
            </div>
            <div className="mt-3 space-y-1.5">
              {withdrawals.length === 0 && (
                <p className="text-[11px] text-muted-foreground">Nenhum saque solicitado ainda.</p>
              )}
              {withdrawals.map((w: any) => (
                <div key={w.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {new Date(w.created_at).toLocaleDateString("pt-BR")} · líquido {money(w.net_cents)}
                  </span>
                  <span className="shrink-0 font-bold">{money(w.amount_cents)} · {WITHDRAW_STATUS[w.status] ?? w.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
