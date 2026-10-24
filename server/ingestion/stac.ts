import {
  MONITORING_BBOX,
  fillUrlTemplate,
  getApiConnectionForTask,
} from "../../src/data/satelliteApiDirectory";
import { bboxCenter, fetchWithTimeout, geoJsonToEwkt, round } from "./common";

/** Ventana de búsqueda hacia atrás. Mayor que la cadencia de la tarea para no perder escenas publicadas con retraso. */
export const STAC_LOOKBACK_DAYS = 4;
const STAC_PAGE_SIZE = 100;
const STAC_MAX_PAGES = 15;

function stacSearchUrl(taskKey: "SENTINEL_1_SAR" | "SENTINEL_2_MSI", collection: string, now: Date): string {
  const connection = getApiConnectionForTask(taskKey);
  if (!connection) throw new Error(`Conexión ${taskKey} ausente del directorio.`);
  const start = new Date(now.getTime() - STAC_LOOKBACK_DAYS * 86_400_000);
  return fillUrlTemplate(connection.baseUrlTemplate, {
    BBOX: MONITORING_BBOX.bboxString,
    COLLECTION: collection,
    START_DATE: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
    END_DATE: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    LIMIT: STAC_PAGE_SIZE,
  });
}

/** Recorre las páginas de una búsqueda STAC siguiendo el enlace "next". */
async function fetchAllStacItems(firstUrl: string): Promise<{ items: any[]; truncated: boolean }> {
  const items: any[] = [];
  let url: string | undefined = firstUrl;
  let pages = 0;
  while (url && pages < STAC_MAX_PAGES) {
    const res = await fetchWithTimeout(url);
    const body: any = await res.json();
    items.push(...(body.features || []));
    const next = (body.links || []).find((l: any) => l.rel === "next" && (!l.method || l.method === "GET"));
    url = next?.href;
    pages++;
  }
  return { items, truncated: Boolean(url) };
}

function selfLink(item: any): string | null {
  return (item.links || []).find((l: any) => l.rel === "self")?.href || null;
}

export interface Sentinel1SceneRow {
  scene_id: string;
  platform: string;
  acquired_at: string;
  instrument_mode: string | null;
  product_type: string | null;
  polarizations: string[] | null;
  orbit_state: string | null;
  relative_orbit: number | null;
  absolute_orbit: number | null;
  center_lat: number | null;
  center_lon: number | null;
  footprint: string | null;
  stac_item_url: string | null;
}

export async function fetchSentinel1Scenes(now = new Date()) {
  const url = stacSearchUrl("SENTINEL_1_SAR", "sentinel-1-grd", now);
  const { items, truncated } = await fetchAllStacItems(url);
  const rows: Sentinel1SceneRow[] = items.map(item => {
    const p = item.properties || {};
    const center = bboxCenter(item.bbox);
    return {
      scene_id: item.id,
      platform: p.platform || "sentinel-1",
      acquired_at: p.datetime || p.start_datetime,
      instrument_mode: p["sar:instrument_mode"] ?? null,
      product_type: p["product:type"] ?? null,
      polarizations: p["sar:polarizations"] ?? null,
      orbit_state: p["sat:orbit_state"] ?? null,
      relative_orbit: p["sat:relative_orbit"] ?? null,
      absolute_orbit: p["sat:absolute_orbit"] ?? null,
      center_lat: center.lat,
      center_lon: center.lon,
      footprint: geoJsonToEwkt(item.geometry),
      stac_item_url: selfLink(item),
    };
  });
  return { rows, url, truncated };
}

export interface Sentinel2ProductRow {
  product_id: string;
  tile_id: string;
  datatake_id: string | null;
  spacecraft_name: string;
  sensing_time: string;
  processing_level: string;
  cloud_pixel_pct: number | null;
  geom_footprint: string;
  relative_orbit: number | null;
  center_lat: number | null;
  center_lon: number | null;
  stac_item_url: string | null;
}

/** "sentinel-2c" -> "S2C" */
function sentinel2Code(platform: string | undefined): string {
  const match = /sentinel-2([a-d])/i.exec(platform || "");
  return match ? `S2${match[1].toUpperCase()}` : "S2";
}

export async function fetchSentinel2Products(now = new Date()) {
  const url = stacSearchUrl("SENTINEL_2_MSI", "sentinel-2-l2a", now);
  const { items, truncated } = await fetchAllStacItems(url);
  const rows: Sentinel2ProductRow[] = [];
  for (const item of items) {
    const p = item.properties || {};
    const footprint = geoJsonToEwkt(item.geometry);
    if (!footprint) continue; // geom_footprint es obligatoria en la tabla
    const center = bboxCenter(item.bbox);
    const grid = String(p["grid:code"] || "").replace(/^MGRS-/, "");
    const cloud = Number(p["eo:cloud_cover"]);
    rows.push({
      product_id: item.id,
      tile_id: grid ? `T${grid}` : "T?",
      datatake_id: p["eopf:datatake_id"] ?? null,
      spacecraft_name: sentinel2Code(p.platform),
      sensing_time: p.datetime || p.start_datetime,
      processing_level: "L2A",
      cloud_pixel_pct: Number.isFinite(cloud) ? round(cloud, 2) : null,
      geom_footprint: footprint,
      relative_orbit: p["sat:relative_orbit"] ?? null,
      center_lat: center.lat,
      center_lon: center.lon,
      stac_item_url: selfLink(item),
    });
  }
  return { rows, url, truncated };
}
