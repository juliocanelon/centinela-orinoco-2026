import type { SchedulerCache } from "./satelliteScheduler";
import { haversineKm } from "./ragSearch";
import { FIRMS_RELEVANT_FRP_MW } from "./ingestion/firms";
import { INITIAL_PROTECTED_AREAS, MONITORING_ZONES } from "../src/data/mockGeoJSON";

/**
 * Densidad de focos NASA FIRMS en una cuadrícula de hexágonos de lado fijo.
 * Todas las celdas tienen la misma superficie, así que la densidad es comparable en todo el mapa.
 */

/** Lado (= radio) de cada hexágono en km. Superficie ≈ 2,598 · 25² ≈ 1.624 km². */
export const HEX_SIDE_KM = 25;
export const DENSITY_PERIODS_DAYS = [1, 3, 7] as const;
/** Distancia a una zona minera de referencia para considerar un foco relevante como de prioridad alta. */
export const NEAR_REFERENCE_KM = 25;

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON_EQUATOR = 111.32;
/** Latitud de referencia de la proyección local (los estados monitoreados están entre 0,6° y 10°N). */
const REF_LAT = 5;
const COS_REF = Math.cos((REF_LAT * Math.PI) / 180);
const SQRT3 = Math.sqrt(3);
const HEX_AREA_PROJECTED_KM2 = ((3 * SQRT3) / 2) * HEX_SIDE_KM ** 2;

export type HotspotPriority = "ALTA" | "MEDIA" | "BAJA";

export interface DensityHotspot {
  id: string;
  latitude: number;
  longitude: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  frpMw: number | null;
  confidence: string;
  state: string;
  priority: HotspotPriority;
  persistent: boolean;
}

export interface DensityCell {
  id: string;
  center: [number, number]; // [lat, lon]
  polygon: [number, number][]; // [lat, lon]
  areaKm2: number;
  total: number;
  relevant: number;
  highConfidence: number;
  byPriority: Record<HotspotPriority, number>;
  /** 0 = solo prioridad baja; 1-4 = densidad creciente de focos relevantes por 1.000 km². */
  level: 0 | 1 | 2 | 3 | 4;
  relevantPer1000Km2: number;
  totalPer1000Km2: number;
  maxFrpMw: number | null;
  perDay: { date: string; total: number; relevant: number }[];
  persistentPoints: { latitude: number; longitude: number; days: number }[];
  states: string[];
  nearestReference: { name: string; kind: "ZONA_MINERA" | "AREA_PROTEGIDA"; distanceKm: number; inside: boolean } | null;
  nearestStation: { code: string; name: string; distanceKm: number; levelMsnm: number | null; readingDate: string | null; status: string | null; isStale: boolean } | null;
  latestUsefulS2: { productId: string; tileId: string; sensingTime: string; cloudPixelPct: number | null; stacItemUrl: string | null } | null;
  hotspots: DensityHotspot[];
}

export interface DensityResponse {
  days: number;
  hexSideKm: number;
  hexAreaKm2: number;
  generatedAt: string;
  dataLoadedAt: string | null;
  totals: {
    hotspots: number;
    cells: number;
    byPriority: Record<HotspotPriority, number>;
    byState: Record<string, number>;
  };
  levelThresholdsPer1000Km2: number[];
  cells: DensityCell[];
}

/** Umbrales de focos relevantes por 1.000 km² que separan los niveles 1-4. */
const LEVEL_THRESHOLDS = [1, 3, 6];

const project = (lat: number, lon: number) => ({ x: lon * KM_PER_DEG_LON_EQUATOR * COS_REF, y: lat * KM_PER_DEG_LAT });
const unproject = (x: number, y: number) => ({ lat: y / KM_PER_DEG_LAT, lon: x / (KM_PER_DEG_LON_EQUATOR * COS_REF) });

/** Hexágono (coordenadas axiales, orientación con vértice arriba) que contiene el punto proyectado. */
function pointToHex(x: number, y: number): { q: number; r: number } {
  const qf = ((SQRT3 / 3) * x - (1 / 3) * y) / HEX_SIDE_KM;
  const rf = ((2 / 3) * y) / HEX_SIDE_KM;
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

function hexCenter(q: number, r: number) {
  return { x: HEX_SIDE_KM * (SQRT3 * q + (SQRT3 / 2) * r), y: HEX_SIDE_KM * 1.5 * r };
}

function hexPolygon(cx: number, cy: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    const p = unproject(cx + HEX_SIDE_KM * Math.cos(angle), cy + HEX_SIDE_KM * Math.sin(angle));
    return [round(p.lat, 4), round(p.lon, 4)] as [number, number];
  });
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

function pointInRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonCentroid(ring: [number, number][]): { lat: number; lon: number } {
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { lat, lon };
}

/** Zona minera o área protegida más cercana a un punto (áreas protegidas: dentro del polígono o distancia al centroide). */
function nearestReference(lat: number, lon: number): DensityCell["nearestReference"] {
  let best: DensityCell["nearestReference"] = null;
  for (const zone of MONITORING_ZONES) {
    const d = haversineKm(lat, lon, zone.latitude, zone.longitude);
    if (!best || d < best.distanceKm) best = { name: zone.name, kind: "ZONA_MINERA", distanceKm: round(d, 1), inside: false };
  }
  for (const area of INITIAL_PROTECTED_AREAS) {
    const ring = area.coordinates as [number, number][];
    if (pointInRing(lon, lat, ring)) return { name: area.name, kind: "AREA_PROTEGIDA", distanceKm: 0, inside: true };
    const c = polygonCentroid(ring);
    const d = haversineKm(lat, lon, c.lat, c.lon);
    if (!best || d < best.distanceKm) best = { name: area.name, kind: "AREA_PROTEGIDA", distanceKm: round(d, 1), inside: false };
  }
  return best;
}

function acquiredAt(h: Record<string, any>): number {
  const time = String(h.acq_time || "00:00").slice(0, 5);
  return Date.parse(`${String(h.acq_date).slice(0, 10)}T${time}:00Z`);
}

const isRelevant = (h: Record<string, any>) => h.confidence === "high" || (Number(h.frp_mw) || 0) >= FIRMS_RELEVANT_FRP_MW;
/** Celda de ~1 km (0,01°) para detectar fuego persistente en el mismo lugar. */
const persistenceKey = (h: Record<string, any>) => `${Number(h.latitude).toFixed(2)}|${Number(h.longitude).toFixed(2)}`;

export function computeHotspotDensity(cache: SchedulerCache, days: number, now = new Date()): DensityResponse {
  const cutoff = now.getTime() - days * 86_400_000;

  // Persistencia sobre toda la ventana del caché (7 días): días distintos con fuego por celda de ~1 km.
  const daysByPoint = new Map<string, Set<string>>();
  for (const h of cache.hotspots) {
    const key = persistenceKey(h);
    if (!daysByPoint.has(key)) daysByPoint.set(key, new Set());
    daysByPoint.get(key)!.add(String(h.acq_date).slice(0, 10));
  }

  const referenceCache = new Map<string, DensityCell["nearestReference"]>();
  const cells = new Map<string, { q: number; r: number; hotspots: DensityHotspot[] }>();
  const totals = { hotspots: 0, cells: 0, byPriority: { ALTA: 0, MEDIA: 0, BAJA: 0 } as Record<HotspotPriority, number>, byState: {} as Record<string, number> };

  for (const h of cache.hotspots) {
    if (acquiredAt(h) < cutoff) continue;
    const lat = Number(h.latitude);
    const lon = Number(h.longitude);
    const persistent = (daysByPoint.get(persistenceKey(h))?.size || 0) >= 2;
    const relevant = isRelevant(h);

    let priority: HotspotPriority = "BAJA";
    if (persistent) priority = "ALTA";
    else if (relevant) {
      const refKey = `${lat.toFixed(1)}|${lon.toFixed(1)}`;
      if (!referenceCache.has(refKey)) referenceCache.set(refKey, nearestReference(lat, lon));
      const ref = referenceCache.get(refKey);
      priority = ref && (ref.inside || (ref.kind === "ZONA_MINERA" && ref.distanceKm <= NEAR_REFERENCE_KM)) ? "ALTA" : "MEDIA";
    }

    const { x, y } = project(lat, lon);
    const { q, r } = pointToHex(x, y);
    const id = `H${q}_${r}`;
    if (!cells.has(id)) cells.set(id, { q, r, hotspots: [] });
    cells.get(id)!.hotspots.push({
      id: h.firms_id,
      latitude: lat,
      longitude: lon,
      acqDate: String(h.acq_date).slice(0, 10),
      acqTime: h.acq_time,
      satellite: h.satellite,
      frpMw: h.frp_mw == null ? null : Number(h.frp_mw),
      confidence: h.confidence,
      state: h.state_name,
      priority,
      persistent,
    });
    totals.hotspots++;
    totals.byPriority[priority]++;
    totals.byState[h.state_name] = (totals.byState[h.state_name] || 0) + 1;
  }

  const periodDates = Array.from({ length: days }, (_, i) => new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10)).reverse();
  const priorityRank: Record<HotspotPriority, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

  const result: DensityCell[] = [...cells.entries()].map(([id, { q, r, hotspots }]) => {
    const c = hexCenter(q, r);
    const center = unproject(c.x, c.y);
    const areaKm2 = round(HEX_AREA_PROJECTED_KM2 * (Math.cos((center.lat * Math.PI) / 180) / COS_REF), 0);
    const relevantCount = hotspots.filter(h => h.priority !== "BAJA").length;
    const byPriority = { ALTA: 0, MEDIA: 0, BAJA: 0 } as Record<HotspotPriority, number>;
    hotspots.forEach(h => byPriority[h.priority]++);
    const relevantPer1000Km2 = round((relevantCount / areaKm2) * 1000, 2);

    let level: DensityCell["level"] = 0;
    if (relevantCount > 0) {
      level = 1;
      if (relevantPer1000Km2 >= LEVEL_THRESHOLDS[0]) level = 2;
      if (relevantPer1000Km2 >= LEVEL_THRESHOLDS[1]) level = 3;
      if (relevantPer1000Km2 >= LEVEL_THRESHOLDS[2]) level = 4;
    }

    const frps = hotspots.map(h => h.frpMw).filter((v): v is number => v !== null);
    const persistentPoints = [...new Set(hotspots.filter(h => h.persistent).map(h => persistenceKey({ latitude: h.latitude, longitude: h.longitude })))]
      .map(key => {
        const [la, lo] = key.split("|").map(Number);
        return { latitude: la, longitude: lo, days: daysByPoint.get(key)?.size || 0 };
      })
      .sort((a, b) => b.days - a.days);

    const stations = cache.hydroStations
      .map(s => ({ s, d: haversineKm(center.lat, center.lon, Number(s.latitude), Number(s.longitude)) }))
      .sort((a, b) => a.d - b.d);
    const station = stations[0];

    const s2 = cache.sentinel2Products
      .filter(p => p.center_lat != null && p.cloud_pixel_pct != null && Number(p.cloud_pixel_pct) < 20
        && haversineKm(center.lat, center.lon, Number(p.center_lat), Number(p.center_lon)) <= 60)
      .sort((a, b) => String(b.sensing_time).localeCompare(String(a.sensing_time)))[0];

    return {
      id,
      center: [round(center.lat, 4), round(center.lon, 4)],
      polygon: hexPolygon(c.x, c.y),
      areaKm2,
      total: hotspots.length,
      relevant: relevantCount,
      highConfidence: hotspots.filter(h => h.confidence === "high").length,
      byPriority,
      level,
      relevantPer1000Km2,
      totalPer1000Km2: round((hotspots.length / areaKm2) * 1000, 2),
      maxFrpMw: frps.length > 0 ? Math.max(...frps) : null,
      perDay: periodDates.map(date => ({
        date,
        total: hotspots.filter(h => h.acqDate === date).length,
        relevant: hotspots.filter(h => h.acqDate === date && h.priority !== "BAJA").length,
      })),
      persistentPoints,
      states: [...new Set(hotspots.map(h => h.state))],
      nearestReference: nearestReference(center.lat, center.lon),
      nearestStation: station ? {
        code: station.s.station_code,
        name: station.s.name,
        distanceKm: round(station.d, 0),
        levelMsnm: station.s.latest_level_msnm == null ? null : Number(station.s.latest_level_msnm),
        readingDate: station.s.latest_reading_date ? String(station.s.latest_reading_date).slice(0, 10) : null,
        status: station.s.latest_alert_status ?? null,
        isStale: Boolean(station.s.latest_is_stale),
      } : null,
      latestUsefulS2: s2 ? {
        productId: s2.product_id,
        tileId: s2.tile_id,
        sensingTime: s2.sensing_time,
        cloudPixelPct: s2.cloud_pixel_pct == null ? null : Number(s2.cloud_pixel_pct),
        stacItemUrl: s2.stac_item_url,
      } : null,
      hotspots: hotspots.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (b.frpMw ?? 0) - (a.frpMw ?? 0)),
    };
  });

  result.sort((a, b) => b.level - a.level || b.relevant - a.relevant);
  totals.cells = result.length;

  return {
    days,
    hexSideKm: HEX_SIDE_KM,
    hexAreaKm2: round(HEX_AREA_PROJECTED_KM2, 0),
    generatedAt: now.toISOString(),
    dataLoadedAt: cache.loadedAt,
    totals,
    levelThresholdsPer1000Km2: LEVEL_THRESHOLDS,
    cells: result,
  };
}
