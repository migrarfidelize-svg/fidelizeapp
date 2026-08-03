import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Bike, CheckCheck, ChefHat, Clock, PackageCheck, RefreshCw, Loader2, Star, ShoppingBag, Radio,
} from "lucide-react";
import { listMyOrders, updateOrderStatus } from "@/lib/orders.functions";
import { listAvailableCouriers, requestCourier, listEstablishmentDeliveries } from "@/lib/couriers.functions";

const STATUS: Record<string, { label: string; tone: string }> = {
  new: { label: "Novo", tone: "bg-primary/15 text-primary border-primary/30" },
  confirmed: { label: "Aprovado", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  preparing: { label: "Preparando", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  ready: { label: "Pronto", tone: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
  completed: { label: "Concluído", tone: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelado", tone: "bg-destructive/15 text-destructive border-destructive/30" },
};

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OrdersDock({
  establishmentId,
  variant = "dock",
}: { establishmentId: string; variant?: "dock" | "board" }) {
  const board = variant === "board";
  const qc = useQueryClient();
  const ordersFn = useServerFn(listMyOrders);
  const statusFn = useServerFn(updateOrderStatus);
  const deliveriesFn = useServerFn(listEstablishmentDeliveries);

  const [courierFor, setCourierFor] = useState<any | null>(null);

  const orders = useQuery({
    queryKey: ["dock-orders", establishmentId],
    queryFn: () => ordersFn({ data: { establishment_id: establishmentId, limit: 20 } }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });

  const deliveries = useQuery({
    queryKey: ["dock-deliveries", establishmentId],
    queryFn: () => deliveriesFn({ data: { establishment_id: establishmentId } }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });

  // Tempo real 24h: pedidos e entregas.
  useEffect(() => {
    const ch = supabase
      .channel(`dock-${establishmentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `establishment_id=eq.${establishmentId}` }, () => {
        qc.invalidateQueries({ queryKey: ["dock-orders", establishmentId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries", filter: `establishment_id=eq.${establishmentId}` }, () => {
        qc.invalidateQueries({ queryKey: ["dock-deliveries", establishmentId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [establishmentId, qc]);

  const setStatus = useMutation({
    mutationFn: (v: { order_id: string; status: any }) => statusFn({ data: v }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["dock-orders", establishmentId] });
      const map: Record<string, string> = {
        confirmed: "Pedido aprovado — cliente notificado.",
        preparing: "Pedido em preparo.",
        ready: "Pedido pronto — já pode chamar o entregador.",
        completed: "Pedido concluído.",
        cancelled: "Pedido cancelado — cliente notificado.",
      };
      toast.success(map[v.status] ?? "Status atualizado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível atualizar"),
  });

  const live = useMemo(() => {
    const list = (orders.data as any[]) ?? [];
    const open = list.filter((o) => ["new", "confirmed", "preparing", "ready"].includes(o.status));
    return board ? open : open.slice(0, 12);
  }, [orders.data, board]);

  const deliveryByOrder = useMemo(() => {
    const m = new Map<string, any>();
    for (const d of ((deliveries.data as any[]) ?? [])) if (d.order_id) m.set(d.order_id, d);
    return m;
  }, [deliveries.data]);

  const pendingCount = live.filter((o) => o.status === "new").length;

  return (
    <>
      <div
        className={
          board
            ? "rounded-2xl border bg-card/40 p-4"
            : "sticky top-0 z-30 -mx-4 mb-4 border-b bg-background/85 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8"
        }
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold">
            <ShoppingBag className="h-4 w-4 text-primary" />
            {board ? "Pedidos em aberto" : "Últimos pedidos"}
          </span>
          {pendingCount > 0 && (
            <Badge className="bg-primary/15 text-primary border-primary/30">{pendingCount} aguardando aprovação</Badge>
          )}
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Radio className="h-3 w-3 text-emerald-500 animate-pulse" /> ao vivo
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8"
            onClick={() => { orders.refetch(); deliveries.refetch(); }}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${orders.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {live.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">Nenhum pedido em aberto agora. Novos pedidos aparecem aqui automaticamente.</p>
        ) : (
          <div className={board ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "flex gap-3 overflow-x-auto pb-1"}>
            {live.map((o) => {
              const st = STATUS[o.status] ?? STATUS.new;
              const dl = deliveryByOrder.get(o.id);
              const isDelivery = o.fulfillment === "delivery";
              return (
                <div
                  key={o.id}
                  className={`rounded-xl border bg-card p-3 shadow-sm ${board ? "" : "min-w-[260px] shrink-0"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">#{o.order_number} · {o.customer_name ?? "Cliente"}</span>
                    <Badge variant="outline" className={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {isDelivery ? "Entrega" : "Retirada"} · {Number(o.total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.status === "new" && (
                      <>
                        <Button size="sm" className="h-7 text-xs" disabled={setStatus.isPending}
                          onClick={() => setStatus.mutate({ order_id: o.id, status: "confirmed" })}>
                          <CheckCheck className="mr-1 h-3.5 w-3.5" /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                          onClick={() => setStatus.mutate({ order_id: o.id, status: "cancelled" })}>
                          Recusar
                        </Button>
                      </>
                    )}
                    {o.status === "confirmed" && (
                      <Button size="sm" variant="secondary" className="h-7 text-xs"
                        onClick={() => setStatus.mutate({ order_id: o.id, status: "preparing" })}>
                        <ChefHat className="mr-1 h-3.5 w-3.5" /> Em preparo
                      </Button>
                    )}
                    {o.status === "preparing" && (
                      <Button size="sm" variant="secondary" className="h-7 text-xs"
                        onClick={() => setStatus.mutate({ order_id: o.id, status: "ready" })}>
                        <PackageCheck className="mr-1 h-3.5 w-3.5" /> Marcar pronto
                      </Button>
                    )}
                    {o.status === "ready" && isDelivery && !dl && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => setCourierFor(o)}>
                        <Bike className="mr-1 h-3.5 w-3.5" /> Chamar entregador
                      </Button>
                    )}
                    {o.status === "ready" && !isDelivery && (
                      <Button size="sm" variant="secondary" className="h-7 text-xs"
                        onClick={() => setStatus.mutate({ order_id: o.id, status: "completed" })}>
                        <CheckCheck className="mr-1 h-3.5 w-3.5" /> Entregue ao cliente
                      </Button>
                    )}
                    {dl && (
                      <Badge variant="outline" className="h-7 gap-1 border-primary/30 bg-primary/10 text-primary">
                        <Bike className="h-3.5 w-3.5" />
                        {dl.couriers?.full_name ? dl.couriers.full_name.split(" ")[0] : "Aguardando entregador"}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CourierPicker
        establishmentId={establishmentId}
        order={courierFor}
        onClose={() => setCourierFor(null)}
        onDone={() => {
          setCourierFor(null);
          qc.invalidateQueries({ queryKey: ["dock-deliveries", establishmentId] });
        }}
      />
    </>
  );
}

function CourierPicker({
  establishmentId, order, onClose, onDone,
}: { establishmentId: string; order: any | null; onClose: () => void; onDone: () => void }) {
  const availFn = useServerFn(listAvailableCouriers);
  const requestFn = useServerFn(requestCourier);
  const [fee, setFee] = useState("8,00");
  const [selected, setSelected] = useState<string | null>(null);

  const open = !!order;

  const avail = useQuery({
    queryKey: ["available-couriers", establishmentId],
    queryFn: () => availFn({ data: { establishment_id: establishmentId } }),
    enabled: open,
    // Pop-up atualizado sem parar enquanto estiver aberto.
    refetchInterval: open ? 8_000 : false,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const call = useMutation({
    mutationFn: () =>
      requestFn({
        data: {
          establishment_id: establishmentId,
          order_id: order?.id ?? null,
          courier_id: selected,
          fee_cents: Math.round(Number(fee.replace(/\./g, "").replace(",", ".")) * 100) || 0,
          dropoff_address: order?.address ?? null,
        },
      }),
    onSuccess: (r: any) => {
      toast.success(
        selected
          ? "Entregador chamado — ele recebeu a notificação."
          : "Chamado aberto para todos os entregadores disponíveis.",
        { description: `Taxa da plataforma: ${brl(r?.platform_fee_cents ?? 0)}` },
      );
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível chamar o entregador"),
  });

  const list = (avail.data as any)?.couriers ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bike className="h-5 w-5 text-primary" />
            Entregadores disponíveis
          </DialogTitle>
          <DialogDescription>
            {avail.isLoading
              ? "Procurando entregadores online…"
              : `${list.length} entregador${list.length === 1 ? "" : "es"} online agora. A lista se atualiza sozinha a cada 8 segundos.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <Label htmlFor="dock-fee" className="text-xs">Valor da corrida (R$)</Label>
            <Input id="dock-fee" value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" className="h-9" />
          </div>
          <Button variant="outline" size="sm" className="mt-5" onClick={() => avail.refetch()}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${avail.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="max-h-[46vh] space-y-2 overflow-y-auto">
          {list.length === 0 && !avail.isLoading && (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <Clock className="mx-auto mb-2 h-5 w-5" />
              Nenhum entregador online neste momento. Você pode abrir o chamado mesmo assim — o primeiro que ficar
              disponível recebe.
            </div>
          )}
          {list.map((c: any) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(selected === c.id ? null : c.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                selected === c.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-sm font-semibold">
                {String(c.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.full_name}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {Number(c.rating_avg ?? 0).toFixed(1)} ({c.rating_count ?? 0}) · {c.deliveries_count ?? 0} entregas
                </p>
              </div>
              <Badge variant="outline" className="capitalize">{c.level_code}</Badge>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => call.mutate()} disabled={call.isPending}>
            {call.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bike className="mr-1 h-4 w-4" />}
            {selected ? "Chamar este entregador" : "Abrir chamado para todos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
