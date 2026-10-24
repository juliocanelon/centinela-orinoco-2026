import {
  MONITORING_WKT,
  fillUrlTemplate,
  getApiConnectionForTask,
} from "../../src/data/satelliteApiDirectory";
import { bboxCenter, fetchWithTimeout, geoJsonToEwkt, geometryBbox } from "./common";

export const SENTINEL3_PRODUCT_TYPES = [
  { productType: "OL_2_WFR", instrument: "OLCI" },
  { productType: "SL_2_WST", instrument: "SLSTR" },
] as const;

export const SENTINEL3_LOOKBACK_DAYS = 3;
const ODATA_PAGE_SIZE = 100;
const ODATA_MAX_PAGES = 10;

export interface Sentinel3ProductRow {
  product_id: string;
  product_name: string;
  platform: string;
  instrument: "OLCI" | "SLSTR";
  product_type: string;
  sensing_start: string;
  sensing_end: string | null;
  content_length_bytes: number | null;
  online: boolean | null;
  center_lat: number | null;
  center_lon: number | null;
  footprint: string | null;
  odata_url: string;
}

function productsUrl(productType: string, now: Date): string {
  const connection = getApiConnectionForTask("SENTINEL_3_OLCI");
  if (!connection) throw new Error("Conexión SENTINEL_3_OLCI ausente del directorio.");
  const since = new Date(now.getTime() - SENTINEL3_LOOKBACK_DAYS * 86_400_000).toISOString();
  const filter =
    `Collection/Name eq 'SENTINEL-3' and contains(Name,'${productType}') and ContentDate/Start gt ${since} ` +
    `and OData.CSC.Intersects(area=geography'SRID=4326;${MONITORING_WKT}')`;
  return fillUrlTemplate(connection.baseUrlTemplate, {
    FILTER: encodeURIComponent(filter),
    LIMIT: ODATA_PAGE_SIZE,
  }).replace(/ /g, "%20");
}

export async function fetchSentinel3Products(now = new Date()) {
  const rows: Sentinel3ProductRow[] = [];
  const urls: string[] = [];
  let truncated = false;

  for (const { productType, instrument } of SENTINEL3_PRODUCT_TYPES) {
    let url: string | undefined = productsUrl(productType, now);
    urls.push(url);
    let pages = 0;
    while (url && pages < ODATA_MAX_PAGES) {
      const res = await fetchWithTimeout(url);
      const body: any = await res.json();
      for (const p of body.value || []) {
        const bbox = geometryBbox(p.GeoFootprint);
        const center = bboxCenter(bbox);
        const base = url.split("?")[0];
        rows.push({
          product_id: p.Id,
          product_name: p.Name,
          platform: String(p.Name).slice(0, 3), // S3A / S3B
          instrument,
          product_type: productType,
          sensing_start: p.ContentDate?.Start,
          sensing_end: p.ContentDate?.End ?? null,
          content_length_bytes: p.ContentLength ?? null,
          online: p.Online ?? null,
          center_lat: center.lat,
          center_lon: center.lon,
          footprint: geoJsonToEwkt(p.GeoFootprint),
          odata_url: `${base}(${p.Id})`,
        });
      }
      url = body["@odata.nextLink"];
      pages++;
    }
    if (url) truncated = true;
  }
  return { rows, urls, truncated };
}
