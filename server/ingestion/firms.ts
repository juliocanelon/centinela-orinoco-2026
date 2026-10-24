import {
  FIRMS_MAP_KEY_PLACEHOLDER,
  MONITORED_STATES,
  MONITORING_BBOX,
  fillUrlTemplate,
  getApiConnectionForTask,
} from "../../src/data/satelliteApiDirectory";
import { fetchWithTimeout, findStateName } from "./common";

export const FIRMS_SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_SNPP_NRT", "MODIS_NRT"] as const;
export type FirmsSource = (typeof FIRMS_SOURCES)[number];

/** Días hacia atrás por consulta: 2 cubre retrasos de publicación NRT; los repetidos se omiten al insertar. */
export const FIRMS_DAY_RANGE = 2;

/** Un foco va al índice RAG y a las alertas si tiene confianza alta o FRP >= este umbral (MW). */
export const FIRMS_RELEVANT_FRP_MW = 10;

const MONITORED_STATE_SET = new Set<string>(MONITORED_STATES);

export const FIRMS_CONFLICT_COLUMNS = ["satellite", "latitude", "longitude", "acq_date", "acq_time"];

export function firmsKey(row: Record<string, any>): string {
  return [row.satellite, Number(row.latitude), Number(row.longitude), String(row.acq_date).slice(0, 10), row.acq_time].join("|");
}

export interface FirmsHotspotRow {
  firms_id: string;
  satellite: string;
  instrument: string;
  source_product: FirmsSource;
  latitude: number;
  longitude: number;
  geom: string;
  brightness_temp_k: number | null;
  frp_mw: number | null;
  confidence: "low" | "nominal" | "high";
  acq_date: string;
  acq_time: string;
  day_night: "D" | "N";
  state_name: string;
  sub_basin: string;
  sector_name: string;
  geom_wkt: string;
  metadata: Record<string, any>;
}

export function getFirmsMapKey(): string {
  const key = (process.env.FIRMS_MAP_KEY || "").trim();
  if (!/^[a-f0-9]{32}$/i.test(key)) {
    throw new Error("FIRMS_MAP_KEY no configurada o inválida (32 caracteres hexadecimales).");
  }
  return key;
}

export function buildFirmsUrl(mapKey: string, source: FirmsSource, dayRange = FIRMS_DAY_RANGE): string {
  const connection = getApiConnectionForTask("NASA_FIRMS");
  if (!connection) throw new Error("Conexión NASA_FIRMS ausente del directorio.");
  return fillUrlTemplate(connection.baseUrlTemplate, {
    MAP_KEY: mapKey,
    SOURCE: source,
    BBOX: MONITORING_BBOX.bboxString,
    DAY_RANGE: dayRange,
  });
}

/** URL apta para mostrar o registrar (sin la clave). */
export function redactFirmsUrl(url: string): string {
  return url.replace(/\/csv\/[a-f0-9]{32}\//i, `/csv/${FIRMS_MAP_KEY_PLACEHOLDER}/`);
}

const SATELLITE_LABELS: Record<string, string> = {
  N20: "VIIRS-NOAA20",
  N21: "VIIRS-NOAA21",
  N: "VIIRS-SNPP",
  Aqua: "MODIS-AQUA",
  Terra: "MODIS-TERRA",
  A: "MODIS-AQUA",
  T: "MODIS-TERRA",
};

function normalizeConfidence(raw: string, instrument: string): "low" | "nominal" | "high" {
  if (instrument === "MODIS") {
    // MODIS publica 0-100. Umbrales de la guía de usuario de FIRMS.
    const value = Number(raw);
    if (value >= 80) return "high";
    if (value >= 30) return "nominal";
    return "low";
  }
  if (raw === "h") return "high";
  if (raw === "l") return "low";
  return "nominal";
}

function formatAcqTime(raw: string): string {
  const padded = raw.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)} UTC`;
}

/**
 * Lee el CSV de FIRMS. El recuadro de consulta incluye franjas de estados y países vecinos:
 * solo se devuelven los focos que caen en MONITORED_STATES; el resto se cuenta como descartado.
 */
export function parseFirmsCsv(csv: string, source: FirmsSource): { rows: FirmsHotspotRow[]; discardedOutside: number } {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length === 0 || !lines[0].startsWith("latitude")) {
    // FIRMS devuelve texto plano con el motivo cuando la clave o la consulta son inválidas.
    throw new Error(`Respuesta inesperada de FIRMS (${source}): ${lines[0]?.slice(0, 120) || "vacía"}`);
  }
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  const rows: FirmsHotspotRow[] = [];
  let discardedOutside = 0;

  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const latitude = Number(cols[idx("latitude")]);
    const longitude = Number(cols[idx("longitude")]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const instrument = cols[idx("instrument")] || (source.startsWith("MODIS") ? "MODIS" : "VIIRS");
    const satellite = SATELLITE_LABELS[cols[idx("satellite")]] || `${instrument}-${cols[idx("satellite")]}`;
    const brightnessCol = idx("bright_ti4") >= 0 ? idx("bright_ti4") : idx("brightness");
    const brightness = Number(cols[brightnessCol]);
    const frp = Number(cols[idx("frp")]);
    const acqDate = cols[idx("acq_date")];
    const acqTime = formatAcqTime(cols[idx("acq_time")]);
    const stateName = findStateName(latitude, longitude);
    if (!stateName || !MONITORED_STATE_SET.has(stateName)) {
      discardedOutside++;
      continue;
    }
    const point = `POINT(${longitude} ${latitude})`;

    rows.push({
      firms_id: `FIRMS-${satellite}-${acqDate.replace(/-/g, "")}-${acqTime.slice(0, 5).replace(":", "")}-${latitude.toFixed(5)}_${longitude.toFixed(5)}`,
      satellite,
      instrument,
      source_product: source,
      latitude,
      longitude,
      geom: `SRID=4326;${point}`,
      brightness_temp_k: Number.isFinite(brightness) ? brightness : null,
      frp_mw: Number.isFinite(frp) ? frp : null,
      confidence: normalizeConfidence(cols[idx("confidence")], instrument),
      acq_date: acqDate,
      acq_time: acqTime,
      day_night: cols[idx("daynight")] === "N" ? "N" : "D",
      state_name: stateName,
      sub_basin: stateName,
      sector_name: `Foco ${satellite} ${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`,
      geom_wkt: point,
      metadata: {
        api_source: "NASA_FIRMS_AREA_CSV",
        source_product: source,
        firms_version: cols[idx("version")] || null,
        is_synthetic: false,
      },
    });
  }
  return { rows, discardedOutside };
}

/** Relevante = dentro de un estado monitoreado y con confianza alta o FRP >= FIRMS_RELEVANT_FRP_MW. */
export function isRelevantHotspot(row: { confidence: string; frp_mw: number | null; state_name: string | null }): boolean {
  if (!row.state_name || !MONITORED_STATE_SET.has(row.state_name)) return false;
  return row.confidence === "high" || (row.frp_mw ?? 0) >= FIRMS_RELEVANT_FRP_MW;
}

export function firmsRagDocument(row: FirmsHotspotRow) {
  const place = `estado ${row.state_name}`;
  return {
    doc_type: "NASA_FIRMS",
    source_reference_id: row.firms_id,
    title: `Foco de calor ${row.satellite} ${row.acq_date} ${row.acq_time}`,
    location_name: row.sector_name,
    sub_basin: row.sub_basin,
    latitude: row.latitude,
    longitude: row.longitude,
    content_chunk:
      `Foco de calor activo detectado por ${row.satellite} (NASA FIRMS, ${row.source_product}) el ${row.acq_date} a las ${row.acq_time}, ` +
      `en ${row.latitude.toFixed(4)}°, ${row.longitude.toFixed(4)}° (${place}). ` +
      `Potencia radiativa (FRP): ${row.frp_mw ?? "s/d"} MW. Temperatura de brillo: ${row.brightness_temp_k ?? "s/d"} K. ` +
      `Confianza: ${row.confidence}. Un foco térmico puede corresponder a quema agrícola, incendio forestal o actividad minera; requiere verificación.`,
    metadata: {
      task_key: "NASA_FIRMS",
      confidence: row.confidence,
      frp_mw: row.frp_mw,
      satellite: row.satellite,
      acq_date: row.acq_date,
      is_synthetic: false,
    },
  };
}

/** Descarga los tres sensores. Si un sensor falla, se informa y se continúa con los demás. */
export async function fetchFirmsHotspots(): Promise<{ rows: FirmsHotspotRow[]; discardedOutside: number; errors: string[]; urls: string[] }> {
  const mapKey = getFirmsMapKey();
  const rows: FirmsHotspotRow[] = [];
  let discardedOutside = 0;
  const errors: string[] = [];
  const urls: string[] = [];

  for (const source of FIRMS_SOURCES) {
    const url = buildFirmsUrl(mapKey, source);
    urls.push(redactFirmsUrl(url));
    try {
      const res = await fetchWithTimeout(url);
      const parsed = parseFirmsCsv(await res.text(), source);
      rows.push(...parsed.rows);
      discardedOutside += parsed.discardedOutside;
    } catch (err: any) {
      errors.push(`${source}: ${err?.message || err}`);
    }
  }
  return { rows, discardedOutside, errors, urls };
}
