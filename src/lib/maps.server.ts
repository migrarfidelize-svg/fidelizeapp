/**
 * Acesso server-only ao Google Maps Platform.
 * A chave vive na tabela `integrations` (categoria "other", provider "google_maps")
 * ou, como fallback, na variável de ambiente GOOGLE_MAPS_SERVER_KEY.
 */
import { ROUTES_ENDPOINT, GOOGLE_MAPS_SERVER_KEY_ENV } from "./integrations/maps/google";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoadRoute {
  points: LatLng[];
  distance_m: number;
  duration_s: number;
  source: "google";
}

interface MapsSettings {
  key: string;
  region: string;
  travelMode: string;
  enabled: boolean;
}

let cache: { value: MapsSettings | null; at: number } | null = null;
const TTL_MS = 30_000;

export function invalidateGoogleMapsCache() {
  cache = null;
}

export async function getGoogleMapsSettings(): Promise<MapsSettings | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  let row: any = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const res = await (supabaseAdmin as any)
      .from("integrations")
      .select("enabled, config, credentials, credentials_ref")
      .eq("category", "other")
      .eq("provider", "google_maps")
      .maybeSingle();
    row = res.data ?? null;
  } catch {
    row = null;
  }

  const envName = (row?.credentials_ref?.api_key as string) || GOOGLE_MAPS_SERVER_KEY_ENV;
  const key = String(row?.credentials?.api_key ?? process.env[envName] ?? "").trim();
  const value: MapsSettings | null = key
    ? {
        key,
        region: String(row?.config?.region ?? "br").toUpperCase(),
        travelMode: String(row?.config?.travel_mode ?? "TWO_WHEELER"),
        enabled: row ? row.enabled !== false : true,
      }
    : null;

  cache = { value, at: Date.now() };
  return value;
}

/** Decodifica o formato "encoded polyline" do Google em coordenadas. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

function isCoord(p: Partial<LatLng> | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0);
}

/** Converte um endereço em coordenadas (Geocoding API). */
export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const settings = await getGoogleMapsSettings();
  if (!settings || !address.trim()) return null;

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}` +
    `&region=${encodeURIComponent(settings.region.toLowerCase())}&key=${encodeURIComponent(settings.key)}`;

  const res = await fetch(url);
  const json: any = await res.json().catch(() => null);
  const loc = json?.results?.[0]?.geometry?.location;
  if (!res.ok || !loc) return null;
  return { lat: Number(loc.lat), lng: Number(loc.lng) };
}

/**
 * Calcula a rota real por ruas entre dois pontos, respeitando sentido de via
 * e trânsito. `via` (posição atual do entregador) entra como waypoint intermediário.
 */
export async function computeRoadRoute(
  origin: LatLng,
  destination: LatLng,
  via?: LatLng | null,
): Promise<RoadRoute> {
  const settings = await getGoogleMapsSettings();
  if (!settings) throw new Error("Google Maps não configurado. Adicione a chave em Integrações → Mapas & Rotas.");
  if (!settings.enabled) throw new Error("A integração do Google Maps está desativada no painel.");
  if (!isCoord(origin) || !isCoord(destination)) throw new Error("Coordenadas de origem/destino inválidas.");

  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: settings.travelMode,
    polylineQuality: "HIGH_QUALITY",
    regionCode: settings.region,
    languageCode: "pt-BR",
  };
  // TRAFFIC_AWARE só é suportado em DRIVE e TWO_WHEELER.
  if (settings.travelMode === "DRIVE" || settings.travelMode === "TWO_WHEELER") {
    body.routingPreference = "TRAFFIC_AWARE";
  }
  if (isCoord(via)) {
    body.intermediates = [{ location: { latLng: { latitude: via.lat, longitude: via.lng } } }];
  }

  const res = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": settings.key,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch { /* noop */ }

  if (!res.ok) {
    const msg = parsed?.error?.message ?? raw.slice(0, 300);
    throw new Error(`Google Routes [${res.status}]: ${msg}`);
  }

  const route = parsed?.routes?.[0];
  const encoded = route?.polyline?.encodedPolyline;
  if (!encoded) throw new Error("O Google não retornou um trajeto para estes pontos.");

  return {
    points: decodePolyline(encoded),
    distance_m: Number(route.distanceMeters ?? 0),
    duration_s: Number(String(route.duration ?? "0s").replace(/[^0-9]/g, "")) || 0,
    source: "google",
  };
}
