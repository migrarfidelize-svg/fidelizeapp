import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  delivery_id: z.string().uuid(),
  courier_lat: z.number().min(-90).max(90).nullable().optional(),
  courier_lng: z.number().min(-180).max(180).nullable().optional(),
});

/**
 * Rota real (ruas, sentido de via e trânsito) de uma entrega.
 * A entrega é lida com o cliente do usuário, então a RLS garante que apenas
 * o entregador designado ou o lojista dono do pedido consigam calcular.
 */
export const getDeliveryRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ context, data }) => {
    const { data: delivery, error } = await (context.supabase as any)
      .from("deliveries")
      .select("id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_address, dropoff_address")
      .eq("id", data.delivery_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!delivery) throw new Error("Entrega não encontrada.");

    const { computeRoadRoute, geocodeAddress, getGoogleMapsSettings } = await import("@/lib/maps.server");

    const settings = await getGoogleMapsSettings();
    if (!settings || !settings.enabled) {
      return { available: false as const, reason: "Google Maps não configurado no painel." };
    }

    const valid = (lat: unknown, lng: unknown) =>
      Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && (Number(lat) !== 0 || Number(lng) !== 0);

    let origin = valid(delivery.pickup_lat, delivery.pickup_lng)
      ? { lat: Number(delivery.pickup_lat), lng: Number(delivery.pickup_lng) }
      : delivery.pickup_address
        ? await geocodeAddress(String(delivery.pickup_address))
        : null;

    let destination = valid(delivery.dropoff_lat, delivery.dropoff_lng)
      ? { lat: Number(delivery.dropoff_lat), lng: Number(delivery.dropoff_lng) }
      : delivery.dropoff_address
        ? await geocodeAddress(String(delivery.dropoff_address))
        : null;

    if (!origin || !destination) {
      return { available: false as const, reason: "Não foi possível localizar os endereços de coleta/entrega." };
    }

    const via =
      data.courier_lat != null && data.courier_lng != null
        ? { lat: data.courier_lat, lng: data.courier_lng }
        : null;

    try {
      const route = await computeRoadRoute(origin, destination, via);
      return { available: true as const, origin, destination, ...route };
    } catch (e) {
      return { available: false as const, reason: (e as Error).message };
    }
  });
