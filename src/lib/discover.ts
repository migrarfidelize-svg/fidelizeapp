/**
 * Descobrir (área do cliente) — tipos e utilitários browser-safe.
 * Banners promocionais são controlados pelo Super Admin; o raio de busca
 * define até onde o cliente enxerga estabelecimentos a partir da sua posição.
 */

export type DiscoverBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  bg_color: string | null;
  text_color: string | null;
  cta_label: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  city: string | null;
};

export type DiscoverSettings = {
  /** Raio padrão aplicado quando o cliente não escolheu nada (km). */
  defaultRadiusKm: number;
  /** Raio máximo permitido (km). */
  maxRadiusKm: number;
  /** Opções exibidas como chips no app do cliente. */
  radiusOptions: number[];
  /** Quando true, esconde estabelecimentos fora do raio (em vez de só ordenar). */
  enforceRadius: boolean;
  /** Rotação automática dos banners (ms). 0 desliga. */
  bannerIntervalMs: number;
};

export const DEFAULT_DISCOVER_SETTINGS: DiscoverSettings = {
  defaultRadiusKm: 30,
  maxRadiusKm: 100,
  radiusOptions: [5, 10, 20, 30, 50],
  enforceRadius: true,
  bannerIntervalMs: 6000,
};

export function normalizeDiscoverSettings(input: unknown): DiscoverSettings {
  const raw = (input ?? {}) as Partial<DiscoverSettings>;
  const clamp = (n: unknown, fallback: number, min = 1, max = 500) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
  };
  const maxRadiusKm = clamp(raw.maxRadiusKm, DEFAULT_DISCOVER_SETTINGS.maxRadiusKm);
  const options = Array.isArray(raw.radiusOptions) && raw.radiusOptions.length
    ? Array.from(new Set(raw.radiusOptions.map((n) => clamp(n, 30, 1, maxRadiusKm)))).sort((a, b) => a - b)
    : DEFAULT_DISCOVER_SETTINGS.radiusOptions;
  return {
    defaultRadiusKm: clamp(raw.defaultRadiusKm, DEFAULT_DISCOVER_SETTINGS.defaultRadiusKm, 1, maxRadiusKm),
    maxRadiusKm,
    radiusOptions: options,
    enforceRadius: raw.enforceRadius !== false,
    bannerIntervalMs: clamp(raw.bannerIntervalMs, DEFAULT_DISCOVER_SETTINGS.bannerIntervalMs, 0, 60000),
  };
}

/** Distância em km entre dois pontos (Haversine). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Formata distância de forma amigável (350 m / 2,4 km). */
export function formatDistance(km: number | null | undefined) {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}
