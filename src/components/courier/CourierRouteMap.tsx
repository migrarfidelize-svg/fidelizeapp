import { useQuery } from "@tanstack/react-query";
import { Loader2, Route as RouteIcon } from "lucide-react";
import { CourierMiniMap } from "./CourierMiniMap";
import { getDeliveryRoute } from "@/lib/maps.functions";

interface Props {
  deliveryId: string;
  pickup?: { lat?: number | null; lng?: number | null } | null;
  dropoff?: { lat?: number | null; lng?: number | null } | null;
  courier?: { lat?: number | null; lng?: number | null } | null;
  className?: string;
}

const fmtDur = (s: number) => (s < 60 ? "menos de 1 min" : `${Math.round(s / 60)} min`);

/**
 * Mapa da corrida com o trajeto real por ruas quando o Google Maps está
 * configurado no painel. Sem chave, degrada para o mapa vetorial de custo zero.
 */
export function CourierRouteMap({ deliveryId, pickup, dropoff, courier, className }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["delivery-route", deliveryId],
    queryFn: () =>
      getDeliveryRoute({
        data: {
          delivery_id: deliveryId,
          courier_lat: courier?.lat ?? null,
          courier_lng: courier?.lng ?? null,
        },
      }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const route = data?.available ? data.points : null;

  return (
    <div className="space-y-1.5">
      <CourierMiniMap
        className={className}
        pickup={pickup}
        dropoff={dropoff}
        courier={courier}
        route={route}
      />
      {isLoading && (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Calculando o melhor trajeto pelas ruas…
        </p>
      )}
      {data?.available && (
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-primary">
          <RouteIcon className="h-3 w-3" />
          {(data.distance_m / 1000).toFixed(1)} km por ruas · {fmtDur(data.duration_s)} com trânsito
        </p>
      )}
      {data && !data.available && (
        <p className="text-[10px] text-muted-foreground">{data.reason}</p>
      )}
    </div>
  );
}

export default CourierRouteMap;
