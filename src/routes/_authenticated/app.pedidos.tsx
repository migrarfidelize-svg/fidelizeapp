import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ShoppingBag, Search, Phone, MapPin, Package, Clock, TrendingUp,
  CheckCircle2, XCircle, MessageCircle, Receipt,
} from "lucide-react";

import { getMyEstablishments } from "@/lib/loyalty.functions";
import { listMyOrders, getMyOrdersStats, updateOrderStatus } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/pedidos")({
  head: () => ({
    meta: [
      { title: "Pedidos do Catálogo — Fidelize" },
      { name: "description", content: "Acompanhe os pedidos recebidos pelo catálogo digital e atualize o status de cada um." },
    ],
  }),
  component: OrdersPage,
});

const STATUSES = [
  { id: "new", label: "Novo", tone: "bg-primary/15 text-primary" },
  { id: "confirmed", label: "Confirmado", tone: "bg-blue-500/15 text-blue-500" },
  { id: "preparing", label: "Em preparo", tone: "bg-amber-500/15 text-amber-600" },
  { id: "ready", label: "Pronto", tone: "bg-violet-500/15 text-violet-500" },
  { id: "completed", label: "Concluído", tone: "bg-emerald-500/15 text-emerald-600" },
  { id: "cancelled", label: "Cancelado", tone: "bg-destructive/15 text-destructive" },
];

function money(v: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `R$ ${Number(v).toFixed(2)}`;
  }
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function OrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const fetchEsts = useServerFn(getMyEstablishments);
  const fetchOrders = useServerFn(listMyOrders);
  const fetchStats = useServerFn(getMyOrdersStats);
  const setStatusFn = useServerFn(updateOrderStatus);

  const { data: ests } = useQuery({ queryKey: ["my-ests"], queryFn: () => fetchEsts({ data: {} } as any) });
  const est = (ests as any)?.[0];
  const estId = est?.id as string | undefined;

  const ordersQ = useQuery({
    queryKey: ["orders", estId, status, search],
    queryFn: () => fetchOrders({ data: { establishment_id: estId!, status, search } }),
    enabled: !!estId,
  });

  const statsQ = useQuery({
    queryKey: ["orders-stats", estId],
    queryFn: () => fetchStats({ data: { establishment_id: estId! } }),
    enabled: !!estId,
  });

  const mut = useMutation({
    mutationFn: (v: { order_id: string; status: any }) => setStatusFn({ data: v }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders-stats"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const orders = (ordersQ.data ?? []) as any[];
  const stats = statsQ.data as any;

  const kpis = useMemo(
    () => [
      { label: "Em aberto", value: stats?.open ?? 0, icon: Clock },
      { label: "Hoje", value: stats?.today ?? 0, icon: Receipt },
      { label: "Receita 30d", value: money(stats?.revenue30 ?? 0), icon: TrendingUp },
      { label: "Ticket médio", value: money(stats?.ticket ?? 0), icon: Package },
    ],
    [stats],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="card-icon">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Pedidos recebidos pelo catálogo digital.</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <k.icon className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="metric-number truncate text-lg font-bold">{k.value}</div>
                <div className="truncate text-xs text-muted-foreground">{k.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ordersQ.isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando pedidos...</p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-10 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Nenhum pedido por aqui ainda</p>
            <p className="text-sm text-muted-foreground">
              Quando um cliente montar o carrinho no seu catálogo e enviar pelo WhatsApp, o pedido aparece nesta lista.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = STATUSES.find((s) => s.id === o.status);
            const phone = String(o.customer_phone ?? "").replace(/\D/g, "");
            return (
              <Card key={o.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">#{o.order_number}</span>
                        <Badge className={st?.tone} variant="secondary">{st?.label ?? o.status}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {o.customer_name} · {when(o.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="metric-number text-lg font-bold">{money(Number(o.total), o.currency)}</div>
                      <div className="text-xs text-muted-foreground">
                        {o.fulfillment === "delivery" ? "Entrega" : "Retirada"}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-0.5 text-sm">
                    {(o.order_items ?? []).map((li: any) => (
                      <li key={li.id} className="flex justify-between gap-3">
                        <span className="truncate">{li.qty}x {li.name}</span>
                        <span className="shrink-0 text-muted-foreground">{money(Number(li.line_total), o.currency)}</span>
                      </li>
                    ))}
                  </ul>

                  {(o.address || o.note || o.customer_phone) && (
                    <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      {o.customer_phone && (
                        <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {o.customer_phone}</div>
                      )}
                      {o.address && (
                        <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {o.address}</div>
                      )}
                      {o.note && <div>Obs.: {o.note}</div>}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={o.status} onValueChange={(v) => mut.mutate({ order_id: o.id, status: v })}>
                      <SelectTrigger className="h-9 w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {phone && (
                      <Button asChild size="sm" variant="outline">
                        <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                        </a>
                      </Button>
                    )}
                    {o.status !== "completed" && (
                      <Button size="sm" variant="outline" onClick={() => mut.mutate({ order_id: o.id, status: "completed" })}>
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Concluir
                      </Button>
                    )}
                    {o.status !== "cancelled" && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => mut.mutate({ order_id: o.id, status: "cancelled" })}>
                        <XCircle className="mr-1.5 h-4 w-4" /> Cancelar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
