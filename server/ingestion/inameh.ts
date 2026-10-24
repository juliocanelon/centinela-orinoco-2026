import { PDFParse } from "pdf-parse";
import { fillUrlTemplate, getApiConnectionForTask } from "../../src/data/satelliteApiDirectory";
import { fetchWithTimeout, round } from "./common";

/** Estaciones del Orinoco publicadas por INAMEH (código del boletín y página PHP). */
export const INAMEH_STATIONS = [
  { stationCode: "0850", endpoint: "roayacucho", name: "Estación Hidrométrica Puerto Ayacucho" },
  { stationCode: "0855", endpoint: "rocaicara", name: "Estación Hidrométrica Caicara del Orinoco" },
  { stationCode: "0870", endpoint: "robolivar", name: "Estación Hidrométrica Ciudad Bolívar" },
  { stationCode: "0875", endpoint: "ropalua", name: "Estación Hidrométrica Palúa" },
] as const;

/** A menos de este margen (m) de la cota de desborde, la estación pasa a ELEVATED. */
export const ELEVATED_MARGIN_M = 2;
/** Un boletín con más de estos días de antigüedad se marca como desactualizado. */
export const STALE_AFTER_DAYS = 3;

const INAMEH_BASE = "http://www.inameh.gob.ve/web/";

export interface InamehBulletin {
  stationCode: string;
  readingDate: string; // YYYY-MM-DD
  levelMsnm: number;
  previousReadingDate: string | null;
  previousLevelMsnm: number | null;
  overflowLevelMsnm: number | null;
  latitude: number | null;
  longitude: number | null;
  pdfUrl: string;
}

export interface HydroReadingRow {
  station_code: string;
  reading_date: string;
  level_msnm: number;
  previous_reading_date: string | null;
  previous_level_msnm: number | null;
  daily_change_m: number | null;
  trend: "SUBIENDO" | "BAJANDO" | "ESTABLE" | null;
  overflow_level_msnm: number | null;
  margin_to_overflow_m: number | null;
  alert_status: "OPTIMAL" | "ELEVATED" | "ALERT_CRECIDA" | "SIN_REFERENCIA";
  bulletin_pdf_url: string;
  is_stale: boolean;
}

const toNumber = (s: string) => Number(s.replace(",", "."));

function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Lee los valores del boletín. pdf-parse entrega el texto fuera de orden visual,
 * por eso cada dato se busca por su frase y no por su posición.
 */
export function parseInamehBulletinText(text: string, stationCode: string, pdfUrl: string): InamehBulletin {
  const flat = text.replace(/\s+/g, " ");

  const current = /es de (\d+,\d+)/.exec(flat);
  if (!current) throw new Error(`Boletín ${stationCode}: no se encontró "es de <nivel>"`);

  const previous = /(\d+,\d+) msnm , (?:bajando|subiendo|estable)/i.exec(flat);
  // Fechas ISO (YYYY-MM-DD): el orden de texto coincide con el cronológico.
  const dates = [...new Set([...flat.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)].map(m => toIsoDate(m[1])))]
    .sort((a, b) => a.localeCompare(b));
  if (dates.length === 0) throw new Error(`Boletín ${stationCode}: no se encontró la fecha`);
  const readingDate = dates.at(-1) as string;
  const previousDate = dates.at(-2) ?? null;

  const overflow = /Cota de desborde\D{0,15}(\d+,\d+)\s*msnm/i.exec(flat);
  const coords = /Latitud\s*=\s*(-?\d+,\d+)\s*Longitud\s*=\s*(-?\d+,\d+)/i.exec(flat);

  return {
    stationCode,
    readingDate,
    levelMsnm: toNumber(current[1]),
    previousReadingDate: previousDate,
    previousLevelMsnm: previous ? toNumber(previous[1]) : null,
    overflowLevelMsnm: overflow ? toNumber(overflow[1]) : null,
    latitude: coords ? toNumber(coords[1]) : null,
    longitude: coords ? toNumber(coords[2]) : null,
    pdfUrl,
  };
}

export function alertStatusFor(level: number, overflow: number | null): HydroReadingRow["alert_status"] {
  if (overflow === null) return "SIN_REFERENCIA";
  if (level >= overflow) return "ALERT_CRECIDA";
  if (overflow - level <= ELEVATED_MARGIN_M) return "ELEVATED";
  return "OPTIMAL";
}

export function isStale(readingDate: string, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(`${readingDate}T12:00:00Z`).getTime()) / 86_400_000;
  return ageDays > STALE_AFTER_DAYS;
}

/**
 * Filas a guardar por boletín: la lectura del día y, si el PDF la trae, la del día anterior
 * (así se acumula historia aunque una consulta falle). Los repetidos se omiten al insertar.
 * `overflow` es la cota de la estación (la del PDF tiene prioridad si existe).
 */
export function bulletinToRows(b: InamehBulletin, stationOverflow: number | null, now = new Date()): HydroReadingRow[] {
  const overflow = b.overflowLevelMsnm ?? stationOverflow;
  const rows: HydroReadingRow[] = [];
  const make = (date: string, level: number, prevDate: string | null, prevLevel: number | null): HydroReadingRow => {
    const change = prevLevel === null ? null : round(level - prevLevel, 2);
    let trend: HydroReadingRow["trend"] = null;
    if (change !== null && change > 0) trend = "SUBIENDO";
    else if (change !== null && change < 0) trend = "BAJANDO";
    else if (change !== null) trend = "ESTABLE";
    return {
      station_code: b.stationCode,
      reading_date: date,
      level_msnm: level,
      previous_reading_date: prevDate,
      previous_level_msnm: prevLevel,
      daily_change_m: change,
      trend,
      overflow_level_msnm: overflow,
      margin_to_overflow_m: overflow === null ? null : round(overflow - level, 2),
      alert_status: alertStatusFor(level, overflow),
      bulletin_pdf_url: b.pdfUrl,
      is_stale: isStale(date, now),
    };
  };
  rows.push(make(b.readingDate, b.levelMsnm, b.previousReadingDate, b.previousLevelMsnm));
  if (b.previousReadingDate && b.previousLevelMsnm !== null) {
    rows.push(make(b.previousReadingDate, b.previousLevelMsnm, null, null));
  }
  return rows;
}

async function downloadBulletin(stationCode: string, endpoint: string): Promise<InamehBulletin> {
  const connection = getApiConnectionForTask("HYDRO_TELEMETRY");
  if (!connection) throw new Error("Conexión HYDRO_TELEMETRY ausente del directorio.");
  const pageUrl = fillUrlTemplate(connection.baseUrlTemplate, { STATION_ENDPOINT: endpoint });

  const html = await (await fetchWithTimeout(pageUrl)).text();
  const pdfPath = /PDF\/[^"'#?]+\.pdf/i.exec(html)?.[0];
  if (!pdfPath) throw new Error(`La página ${endpoint}.php no contiene el enlace al PDF`);
  const pdfUrl = INAMEH_BASE + encodeURI(pdfPath);

  const pdf = Buffer.from(await (await fetchWithTimeout(pdfUrl)).arrayBuffer());
  const parser = new PDFParse({ data: pdf });
  try {
    const { text } = await parser.getText();
    return parseInamehBulletinText(text, stationCode, pdfUrl);
  } finally {
    await parser.destroy();
  }
}

export async function fetchInamehBulletins() {
  const bulletins: InamehBulletin[] = [];
  const errors: string[] = [];
  for (const station of INAMEH_STATIONS) {
    try {
      bulletins.push(await downloadBulletin(station.stationCode, station.endpoint));
    } catch (err: any) {
      errors.push(`${station.name}: ${err?.message || err}`);
    }
  }
  return { bulletins, errors };
}

export function hydroRagDocument(row: HydroReadingRow, stationName: string, river: string, lat: number, lon: number) {
  const overflowText = row.overflow_level_msnm === null
    ? "INAMEH no publica cota de desborde para esta estación"
    : `cota de desborde ${row.overflow_level_msnm} msnm (margen ${row.margin_to_overflow_m} m)`;
  let changeText = "";
  if (row.daily_change_m !== null) {
    const sign = row.daily_change_m > 0 ? "+" : "";
    changeText = ` Variación diaria: ${sign}${row.daily_change_m} m (${row.trend?.toLowerCase()}).`;
  }
  return {
    doc_type: "HYDRO_TELEMETRY",
    source_reference_id: `${row.station_code}-${row.reading_date}`,
    title: `Nivel del ${river} en ${stationName} (${row.reading_date})`,
    location_name: stationName,
    sub_basin: river,
    latitude: lat,
    longitude: lon,
    content_chunk:
      `Boletín INAMEH del ${row.reading_date}: el ${river} en ${stationName} (estación ${row.station_code}) registró ${row.level_msnm} msnm.` +
      `${changeText} Referencia: ${overflowText}. Estado: ${row.alert_status}.` +
      (row.is_stale ? " Atención: el boletín publicado está desactualizado." : "") +
      " INAMEH no publica turbidez, conductividad, pH ni mercurio para esta estación.",
    metadata: {
      task_key: "HYDRO_TELEMETRY",
      station_code: row.station_code,
      level_msnm: row.level_msnm,
      alert_status: row.alert_status,
      is_stale: row.is_stale,
      bulletin_pdf_url: row.bulletin_pdf_url,
      is_synthetic: false,
    },
  };
}
