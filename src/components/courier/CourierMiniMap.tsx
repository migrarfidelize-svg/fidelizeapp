interface Point {
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  pickup?: Point | null;
  dropoff?: Point | null;
  courier?: Point | null;
  /** Trajeto real por ruas (Google Routes API). Quando ausente, cai na linha reta. */
  route?: { lat: number; lng: number }[] | null;
  className?: string;
  /** Proporção do canvas. Use retrato (ex.: 320x640) no modo mapa imersivo. */
  width?: number;
  height?: number;
  /** Remove bordas/arredondamento para o mapa ocupar a tela toda. */
  bare?: boolean;
}

const R = 6371;
export function haversineKm(a: Point, b: Point) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Mapa vetorial de custo zero: projeta os pontos disponíveis em um SVG,
 * sem depender de nenhuma API paga de mapas.
 */
export function CourierMiniMap({ pickup, dropoff, courier, route, className }: Props) {
  const line = route && route.length > 1 ? route : null;
  const pts = [pickup, dropoff, courier, ...(line ?? [])].filter(
    (p): p is Required<Point> => !!p && p.lat != null && p.lng != null,
  ) as { lat: number; lng: number }[];

  const W = 320;
  const H = 170;
  const pad = 26;

  let project = (_p: { lat: number; lng: number }) => ({ x: W / 2, y: H / 2 });
  if (pts.length > 0) {
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.002);
    const spanLng = Math.max(maxLng - minLng, 0.002);
    project = (p) => ({
      x: pad + ((p.lng - minLng) / spanLng) * (W - pad * 2),
      y: H - pad - ((p.lat - minLat) / spanLat) * (H - pad * 2),
    });
  }

  const a = pickup?.lat != null ? project({ lat: pickup.lat, lng: pickup.lng as number }) : null;
  const b = dropoff?.lat != null ? project({ lat: dropoff.lat, lng: dropoff.lng as number }) : null;
  const c = courier?.lat != null ? project({ lat: courier.lat, lng: courier.lng as number }) : null;
  const km = pickup && dropoff ? haversineKm(pickup, dropoff) : null;
  const routePath = line
    ? line
        .map((p, i) => {
          const q = project(p);
          return `${i === 0 ? "M" : "L"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(" ")
    : null;

  return (
    <div className={"relative overflow-hidden rounded-2xl border border-border bg-muted/40 " + (className ?? "")}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Mapa da corrida">
        <defs>
          <pattern id="cm-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#cm-grid)" className="text-primary" />
        {routePath && (
          <path
            d={routePath}
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {!routePath && a && b && (
          <path
            d={`M${a.x},${a.y} Q${(a.x + b.x) / 2},${Math.min(a.y, b.y) - 28} ${b.x},${b.y}`}
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="2.5"
            strokeDasharray="6 6"
          />
        )}
        {a && (
          <g>
            <circle cx={a.x} cy={a.y} r="9" className="fill-primary/25" />
            <circle cx={a.x} cy={a.y} r="4.5" className="fill-primary" />
          </g>
        )}
        {b && (
          <g>
            <circle cx={b.x} cy={b.y} r="9" className="fill-accent/25" />
            <circle cx={b.x} cy={b.y} r="4.5" className="fill-accent" />
          </g>
        )}
        {c && (
          <g>
            <circle cx={c.x} cy={c.y} r="12" className="fill-foreground/10">
              <animate attributeName="r" values="9;14;9" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={c.x} cy={c.y} r="5" className="fill-foreground" />
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-2 text-[10px] font-semibold">
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-primary">Coleta</span>
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-accent">Entrega</span>
        {routePath && (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">rota real</span>
        )}
        {km != null && (
          <span className="rounded-full bg-background/80 px-2 py-0.5 text-muted-foreground">
            {km.toFixed(1)} km
          </span>
        )}
      </div>
      {pts.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Sem coordenadas — use o endereço abaixo
        </div>
      )}
    </div>
  );
}

export default CourierMiniMap;
