import { VENEZUELA_STATES_GEOJSON } from "../../src/data/venezuelaTerritorialData";

export const HTTP_TIMEOUT_MS = 30_000;

export async function fetchWithTimeout(url: string, timeoutMs = HTTP_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "CentinelaOrinoco/1.0" } });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} en ${new URL(url).host}`);
    }
    return res;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s) en ${new URL(url).host}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// --- Geometrías -------------------------------------------------------------

type Position = number[];

function ringToWkt(ring: Position[]): string {
  return `(${ring.map(([lon, lat]) => `${lon} ${lat}`).join(", ")})`;
}

/** Convierte una geometría GeoJSON (Polygon / MultiPolygon / Point) a EWKT con SRID 4326. */
export function geoJsonToEwkt(geometry: any): string | null {
  if (!geometry?.type || !geometry.coordinates) return null;
  switch (geometry.type) {
    case "Point":
      return `SRID=4326;POINT(${geometry.coordinates[0]} ${geometry.coordinates[1]})`;
    case "Polygon":
      return `SRID=4326;POLYGON(${(geometry.coordinates as Position[][]).map(ringToWkt).join(", ")})`;
    case "MultiPolygon":
      return `SRID=4326;MULTIPOLYGON(${(geometry.coordinates as Position[][][])
        .map(poly => `(${poly.map(ringToWkt).join(", ")})`)
        .join(", ")})`;
    default:
      return null;
  }
}

/** Centro del recuadro [oeste, sur, este, norte] de un ítem STAC o de una geometría. */
export function bboxCenter(bbox: number[] | undefined): { lat: number | null; lon: number | null } {
  if (!bbox || bbox.length < 4) return { lat: null, lon: null };
  return { lon: round((bbox[0] + bbox[2]) / 2, 5), lat: round((bbox[1] + bbox[3]) / 2, 5) };
}

export function geometryBbox(geometry: any): number[] | undefined {
  const coords: Position[] = [];
  const walk = (node: any) => {
    if (typeof node?.[0] === "number") coords.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
  };
  walk(geometry?.coordinates);
  if (coords.length === 0) return undefined;
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

// --- Asignación de estado (punto en polígono) --------------------------------

interface StatePolygonIndex {
  name: string;
  bbox: [number, number, number, number];
  polygons: Position[][][];
}

let stateIndex: StatePolygonIndex[] | null = null;

function buildStateIndex(): StatePolygonIndex[] {
  return (VENEZUELA_STATES_GEOJSON.features as any[]).map(feature => {
    const geom = feature.geometry;
    const polygons: Position[][][] = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
    const bbox = geometryBbox(geom) as [number, number, number, number];
    return { name: feature.properties.nombre || feature.properties.shapeName, bbox, polygons };
  });
}

function pointInRing(lon: number, lat: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Estado venezolano que contiene el punto, según los límites ADM1 cargados en la app
 * (Amazonas, Bolívar, Delta Amacuro, Guayana Esequiba y estados vecinos).
 * Devuelve null si el punto cae fuera de esos polígonos.
 */
export function findStateName(lat: number, lon: number): string | null {
  stateIndex ??= buildStateIndex();
  for (const state of stateIndex) {
    const [w, s, e, n] = state.bbox;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    for (const polygon of state.polygons) {
      const [outer, ...holes] = polygon;
      if (pointInRing(lon, lat, outer) && !holes.some(h => pointInRing(lon, lat, h))) {
        return state.name;
      }
    }
  }
  return null;
}
