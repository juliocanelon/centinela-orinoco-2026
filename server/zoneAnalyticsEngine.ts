import type { SchedulerCache } from "./satelliteScheduler";
import { aiModelCascadeManager, AIModelConfig, CascadingExecutionResult } from "./aiModelManager";
import { haversineKm } from "./ragSearch";

export interface ZoneAnalyticsInput {
  zoneName: string;
  coordinates: { lat: number; lng: number };
  radiusKm?: number;
  thermalAnomalies?: any[];
  miningAlerts?: any[];
  waterQuality?: any;
  protectedAreaOverlap?: string;
  investigationSites?: any[];
  featureData?: any;
  generatingEvent?: {
    type?: string;
    typeLabel?: string;
    title?: string;
    description?: string;
    severity?: string;
    satelliteSensor?: string;
    details?: any;
    coordinates?: { lat: number; lng: number };
  };
}

export interface RagIndicatorItem {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
  status: "NORMAL" | "MODERATE" | "HIGH" | "CRITICAL";
  sourceDatabase: string;
  sourceMission: string;
  description: string;
}

export interface ZoneAnalyticsResponse {
  zoneName: string;
  coordinates: { lat: number; lng: number };
  satelliteLocation?: {
    latitude: number;
    longitude: number;
    formatted: string;
    geohashOrSector?: string;
  };
  generatingEvent?: {
    type?: string;
    typeLabel?: string;
    title?: string;
    description?: string;
    severity?: string;
    satelliteSensor?: string;
    details?: any;
    coordinates?: { lat: number; lng: number };
  };
  systemIdentifier?: string;
  evaluationPeriod?: string;
  confidencePercentage?: number;
  issuedAtVenezuela?: string;
  prescriptiveRecommendations?: string[];
  analysisMarkdown: string;
  verdict: "MINERIA_ILEGAL_CONFIRMADA" | "MINERIA_PERMISADA_ARCO_MINERO" | "ZONA_CONSERVACION_SIN_MINERIA";
  verdictLabel: string;
  verdictSummary: string;
  perceptiveSummary: string;
  predictiveSummary: string;
  ragIndicators: RagIndicatorItem[];
  explicitDataSources: Array<{
    category: string;
    table: string;
    sensorOrProvider: string;
    recordsFound: number;
    description: string;
  }>;
  aiExecution: {
    modelUsed: string;
    modelDisplayName: string;
    modelIndex: number;
    engineType: "gemini_multimodel" | "tactical_contingency";
    poolStatus: AIModelConfig[];
    executionSteps: any[];
  };
  timestamp: string;
}

export interface ZoneAnalyticsSources {
  cache: SchedulerCache;
  liveKoboReportsStore: any[];
  liveCorpusArticlesStore: any[];
}

// Palabras clave del Arco Minero del Orinoco (Decreto N° 2.248). Se evalúan sobre el nombre del sector.
const PERMITTED_ARCO_MINERO_KEYWORDS = [
  "arco minero", "el callao", "guasipati", "tumeremo", "yuruari", "bloque i", "bloque ii",
  "bloque iii", "bloque iv", "alianza minera", "concesion minera", "planta caratal", "revermin",
];

// Áreas protegidas (ABRAE) donde la minería está prohibida (Art. 127 CRBV). Se evalúan sobre el nombre del sector.
const STRICT_PROTECTED_AREAS = [
  "yapacana", "caura", "canaima", "duida", "marahuaca", "neblina", "parima tapirapeco", "sipapo",
  "atabapo", "ventuari", "autana", "monumento natural", "parque nacional", "reserva forestal", "reserva de biosfera",
];

const DEFAULT_RADIUS_KM = 50;
/** Ancho de barrido IW de Sentinel-1 (~250 km): una escena cubre la zona si su centro está a menos de la mitad. */
const S1_FOOTPRINT_RADIUS_KM = 125;
/** Cuadrante MGRS de Sentinel-2 (~110 km). */
const S2_FOOTPRINT_RADIUS_KM = 60;
const S2_USEFUL_CLOUD_PCT = 20;

const WATER_QUALITY_NOTE =
  "Turbidez, pH, conductividad y mercurio no se miden en esta plataforma: INAMEH no los publica y no son observables desde satélite. Requieren muestreo de campo.";

/** Referencias verificables de las fuentes de datos y del marco legal. */
const DATA_REFERENCES = `### REFERENCIAS DE DATOS Y MARCO LEGAL
1. NASA. (2026). *Fire Information for Resource Management System (FIRMS): VIIRS 375 m y MODIS NRT* [Conjunto de datos]. https://firms.modaps.eosdis.nasa.gov/
2. European Space Agency. (2026). *Copernicus Sentinel-1, Sentinel-2 y Sentinel-3* [Catálogos STAC y OData]. Copernicus Data Space Ecosystem. https://dataspace.copernicus.eu/
3. Instituto Nacional de Meteorología e Hidrología. (2026). *Comportamiento del Río Orinoco* [Boletines de nivel por estación]. http://www.inameh.gob.ve/web/
4. Constitución de la República Bolivariana de Venezuela. (1999). *Gaceta Oficial N° 36.860*, 30 de diciembre de 1999 (Arts. 127-129).
5. Ley Penal del Ambiente. (2012). *Gaceta Oficial N° 39.913*, 2 de mayo de 2012.
6. Programa de las Naciones Unidas para el Medio Ambiente. (2013). *Convenio de Minamata sobre el Mercurio*.`;

const OFFICIAL_HEADER = `# CENTINELA ORINOCO — ANALÍTICA DE ZONA
**Sistema de monitoreo satelital e hidrológico de la cuenca del Orinoco**

---`;

export function formatVenezuelanDateTime(d: Date = new Date()): string {
  try {
    const fullFormatter = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return `${fullFormatter.format(d)} VET (Hora Legal de Venezuela, UTC-04:00)`;
  } catch {
    return `${d.toISOString()} (UTC)`;
  }
}

function formatGps(lat: number, lng: number): string {
  const ns = lat >= 0 ? `${lat.toFixed(5)}° N` : `${Math.abs(lat).toFixed(5)}° S`;
  const ew = lng >= 0 ? `${lng.toFixed(5)}° E` : `${Math.abs(lng).toFixed(5)}° W`;
  return `${ns}, ${ew} (WGS-84)`;
}

function countStatus(count: number, high: number, critical: number): RagIndicatorItem["status"] {
  if (count >= critical) return "CRITICAL";
  if (count >= high) return "HIGH";
  if (count > 0) return "MODERATE";
  return "NORMAL";
}

interface ZoneEvidence {
  hotspots: any[];
  highConfidence: number;
  maxFrp: number | null;
  sar: any[];
  s1Scenes: any[];
  s2Products: any[];
  s2Useful: any[];
  nearestStation: { station: any; distanceKm: number } | null;
  koboReports: any[];
  corpusSites: Array<{ title: string; site: string; distanceKm: number }>;
}

function collectEvidence(lat: number, lng: number, radiusKm: number, sources: ZoneAnalyticsSources): ZoneEvidence {
  const { cache } = sources;
  const within = (r: number) => (pLat: any, pLng: any) =>
    pLat != null && pLng != null && haversineKm(lat, lng, Number(pLat), Number(pLng)) <= r;
  const inZone = within(radiusKm);

  const hotspots = cache.hotspots.filter(h => inZone(h.latitude, h.longitude));
  const frps = hotspots.map(h => Number(h.frp_mw)).filter(Number.isFinite);
  const s2Products = cache.sentinel2Products.filter(p => within(S2_FOOTPRINT_RADIUS_KM)(p.center_lat, p.center_lon));

  const stations = cache.hydroStations
    .map(s => ({ station: s, distanceKm: haversineKm(lat, lng, Number(s.latitude), Number(s.longitude)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const corpusSites = sources.liveCorpusArticlesStore.flatMap((art: any) =>
    (art.investigationSites || [])
      .filter((s: any) => inZone(s.latitude, s.longitude))
      .map((s: any) => ({ title: art.title, site: s.name, distanceKm: Math.round(haversineKm(lat, lng, s.latitude, s.longitude)) }))
  );

  return {
    hotspots,
    highConfidence: hotspots.filter(h => h.confidence === "high").length,
    maxFrp: frps.length > 0 ? Math.max(...frps) : null,
    sar: cache.sarDisturbances.filter(d => inZone(d.centroid_lat, d.centroid_lng)),
    s1Scenes: cache.sentinel1Scenes.filter(s => within(S1_FOOTPRINT_RADIUS_KM)(s.center_lat, s.center_lon)),
    s2Products,
    s2Useful: s2Products.filter(p => p.cloud_pixel_pct != null && Number(p.cloud_pixel_pct) < S2_USEFUL_CLOUD_PCT),
    nearestStation: stations[0] || null,
    koboReports: sources.liveKoboReportsStore.filter((r: any) => inZone(r.latitude, r.longitude)),
    corpusSites,
  };
}

function buildIndicators(ev: ZoneEvidence, radiusKm: number, regimeValue: string, isStrictAbrae: boolean, isArcoMinero: boolean): RagIndicatorItem[] {
  const station = ev.nearestStation?.station;
  const stationValue = station?.latest_level_msnm == null
    ? "Sin lectura"
    : `${Number(station.latest_level_msnm).toFixed(2)} msnm (${station.latest_reading_date})`;
  let stationStatus: RagIndicatorItem["status"] = "NORMAL";
  if (station?.latest_alert_status === "ALERT_CRECIDA") stationStatus = "CRITICAL";
  else if (station?.latest_alert_status === "ELEVATED") stationStatus = "HIGH";
  else if (!station || station.latest_alert_status === "SIN_REFERENCIA" || station.latest_is_stale) stationStatus = "MODERATE";

  let regimeStatus: RagIndicatorItem["status"] = "NORMAL";
  if (isStrictAbrae) regimeStatus = "CRITICAL";
  else if (isArcoMinero) regimeStatus = "MODERATE";

  return [
    {
      id: "IND-01",
      name: `Focos de calor NASA FIRMS (radio ${radiusKm} km, 7 días)`,
      value: ev.hotspots.length,
      status: countStatus(ev.hotspots.length, 5, 20),
      sourceDatabase: "Supabase (nasa_firms_hotspots)",
      sourceMission: "VIIRS NOAA-20 / Suomi-NPP, MODIS Terra / Aqua",
      description: "Un foco térmico puede ser quema agrícola, incendio forestal o actividad minera: requiere verificación.",
    },
    {
      id: "IND-02",
      name: "Focos de confianza alta",
      value: ev.highConfidence,
      status: countStatus(ev.highConfidence, 3, 10),
      sourceDatabase: "Supabase (nasa_firms_hotspots)",
      sourceMission: "NASA FIRMS",
      description: "Detecciones clasificadas por FIRMS con confianza alta.",
    },
    {
      id: "IND-03",
      name: "Potencia radiativa máxima (FRP)",
      value: ev.maxFrp === null ? "Sin focos" : `${ev.maxFrp.toFixed(1)} MW`,
      unit: "MW",
      status: ev.maxFrp === null ? "NORMAL" : countStatus(ev.maxFrp, 10, 50),
      sourceDatabase: "Supabase (nasa_firms_hotspots)",
      sourceMission: "NASA FIRMS",
      description: "Energía emitida por el foco más intenso en el radio de análisis.",
    },
    {
      id: "IND-04",
      name: "Perturbaciones SAR medidas",
      value: ev.sar.length > 0 ? ev.sar.length : "Sin medición (Nivel 2 pendiente)",
      status: countStatus(ev.sar.length, 1, 3),
      sourceDatabase: "Supabase (copernicus_sar_disturbances)",
      sourceMission: "Copernicus Sentinel-1",
      description: "Cambios de retrodispersión radar medidos sobre la zona. Requiere procesamiento de píxeles (Nivel 2).",
    },
    {
      id: "IND-05",
      name: "Pasadas recientes con cobertura",
      value: `${ev.s1Scenes.length} Sentinel-1 · ${ev.s2Useful.length}/${ev.s2Products.length} Sentinel-2 útiles (<${S2_USEFUL_CLOUD_PCT}% nubes)`,
      status: "NORMAL",
      sourceDatabase: "Supabase (sentinel1_scenes, s2_product_tile)",
      sourceMission: "Copernicus Data Space Ecosystem (STAC)",
      description: "Imágenes disponibles para análisis visual o de píxeles sobre la zona.",
    },
    {
      id: "IND-06",
      name: station ? `Nivel del río en ${station.name} (a ${Math.round(ev.nearestStation!.distanceKm)} km)` : "Nivel del río",
      value: stationValue,
      unit: "msnm",
      status: stationStatus,
      sourceDatabase: "Supabase (environmental_monitoring_stations)",
      sourceMission: "Boletines INAMEH",
      description: station?.overflow_level_msnm == null
        ? "INAMEH no publica cota de desborde para esta estación."
        : `Cota de desborde: ${Number(station.overflow_level_msnm).toFixed(2)} msnm.${station.latest_is_stale ? " Boletín desactualizado." : ""}`,
    },
    {
      id: "IND-07",
      name: "Calidad del agua (turbidez, pH, conductividad, mercurio)",
      value: "No medida",
      status: "MODERATE",
      sourceDatabase: "—",
      sourceMission: "Requiere muestreo de campo",
      description: WATER_QUALITY_NOTE,
    },
    {
      id: "IND-08",
      name: "Régimen territorial (según el nombre del sector)",
      value: regimeValue,
      status: regimeStatus,
      sourceDatabase: "Clasificación por palabras clave",
      sourceMission: "ABRAE / Arco Minero del Orinoco",
      description: "Estimado a partir del nombre del sector; no es una consulta a la cartografía oficial.",
    },
    {
      id: "IND-09",
      name: `Reportes de campo (Kobo) en el radio`,
      value: ev.koboReports.length,
      status: countStatus(ev.koboReports.length, 1, 3),
      sourceDatabase: "Memoria del servidor (webhook Kobo)",
      sourceMission: "Guardería Ambiental",
      description: "Minutas de patrullaje recibidas en esta sesión del servidor.",
    },
  ];
}

export async function performZonePredictiveAndPerceptiveAnalysis(
  input: ZoneAnalyticsInput,
  sources: ZoneAnalyticsSources
): Promise<ZoneAnalyticsResponse> {
  const { zoneName } = input;
  const lat = Number(input.coordinates?.lat);
  const lng = Number(input.coordinates?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Se requieren coordenadas (lat, lng) para analizar la zona.");
  }
  const radiusKm = Number(input.radiusKm) > 0 ? Number(input.radiusKm) : DEFAULT_RADIUS_KM;
  const zoneLower = (zoneName || "").toLowerCase();
  const overlapLower = (input.protectedAreaOverlap || "").toLowerCase();

  const generatingEvent = input.generatingEvent || (input.featureData ? {
    title: input.featureData.name || input.featureData.title || input.featureData.code || zoneName,
    type: input.featureData.type || "EVENTO_TERRITORIAL",
    typeLabel: input.featureData.category || "Detección cartográfica",
    satelliteSensor: input.featureData.satellite || "Fuente no indicada",
    coordinates: input.coordinates,
    severity: input.featureData.severity,
    description: input.featureData.findings || input.featureData.description || `Elemento del mapa en ${zoneName}`,
  } : undefined);

  const eventLat = generatingEvent?.coordinates?.lat ?? lat;
  const eventLng = generatingEvent?.coordinates?.lng ?? lng;
  const formattedGpsZone = formatGps(lat, lng);
  const formattedGpsEvent = formatGps(eventLat, eventLng);

  // 1. Evidencia real dentro del radio
  const ev = collectEvidence(lat, lng, radiusKm, sources);

  // 2. Clasificación (régimen por nombre + presencia de indicios reales en el radio)
  const isStrictAbrae = STRICT_PROTECTED_AREAS.some(a => zoneLower.includes(a) || overlapLower.includes(a));
  const isArcoMinero = PERMITTED_ARCO_MINERO_KEYWORDS.some(k => zoneLower.includes(k) || overlapLower.includes(k));
  const hasIndicators = ev.hotspots.length > 0 || ev.sar.length > 0 || ev.koboReports.length > 0;

  let verdict: ZoneAnalyticsResponse["verdict"];
  let verdictLabel: string;
  let verdictSummary: string;
  if (isArcoMinero && !isStrictAbrae) {
    verdict = "MINERIA_PERMISADA_ARCO_MINERO";
    verdictLabel = "SECTOR DENTRO DEL ARCO MINERO DEL ORINOCO (SEGÚN EL NOMBRE)";
    verdictSummary = "El nombre del sector coincide con zonas del Arco Minero. La legalidad de una actividad concreta requiere verificar su título minero.";
  } else if (hasIndicators) {
    verdict = "MINERIA_ILEGAL_CONFIRMADA";
    verdictLabel = isStrictAbrae
      ? "INDICIOS DE ACTIVIDAD EN ÁREA PROTEGIDA: REQUIERE VERIFICACIÓN"
      : "INDICIOS DE ACTIVIDAD: REQUIERE VERIFICACIÓN";
    verdictSummary = `Se registran ${ev.hotspots.length} focos de calor, ${ev.sar.length} perturbaciones SAR y ${ev.koboReports.length} reportes de campo en ${radiusKm} km. Los datos satelitales no confirman por sí solos minería ilegal.`;
  } else {
    verdict = "ZONA_CONSERVACION_SIN_MINERIA";
    verdictLabel = "SIN INDICIOS EN LOS DATOS DISPONIBLES";
    verdictSummary = `No hay focos de calor, perturbaciones SAR ni reportes de campo en ${radiusKm} km durante los últimos 7 días.`;
  }

  let regimeValue = "Sin régimen especial identificado";
  if (isStrictAbrae) regimeValue = "Área protegida (ABRAE)";
  else if (isArcoMinero) regimeValue = "Arco Minero del Orinoco";
  const regimeLabel = input.protectedAreaOverlap || regimeValue;

  const ragIndicators = buildIndicators(ev, radiusKm, regimeValue, isStrictAbrae, isArcoMinero);

  const explicitDataSources = [
    { category: "Focos de calor", table: "public.nasa_firms_hotspots", sensorOrProvider: "NASA FIRMS (VIIRS / MODIS)", recordsFound: ev.hotspots.length,
      description: `Focos de los últimos 7 días a menos de ${radiusKm} km.` },
    { category: "Perturbaciones radar", table: "public.copernicus_sar_disturbances", sensorOrProvider: "Copernicus Sentinel-1", recordsFound: ev.sar.length,
      description: "Perturbaciones medidas (Nivel 2)." },
    { category: "Escenas radar", table: "public.sentinel1_scenes", sensorOrProvider: "Copernicus Sentinel-1 (STAC)", recordsFound: ev.s1Scenes.length,
      description: "Pasadas recientes que cubren la zona." },
    { category: "Escenas ópticas", table: "public.s2_product_tile", sensorOrProvider: "Copernicus Sentinel-2 L2A (STAC)", recordsFound: ev.s2Products.length,
      description: `Productos recientes sobre la zona (${ev.s2Useful.length} con menos de ${S2_USEFUL_CLOUD_PCT}% de nubes).` },
    { category: "Nivel del río", table: "public.environmental_monitoring_stations", sensorOrProvider: "INAMEH", recordsFound: ev.nearestStation ? 1 : 0,
      description: "Estación hidrométrica más cercana." },
    { category: "Corpus científico", table: "corpus en memoria del servidor", sensorOrProvider: "Artículos cargados en la plataforma", recordsFound: ev.corpusSites.length,
      description: "Sitios de estudio publicados dentro del radio (literatura, no medición actual)." },
  ];

  const issuedAtVenezuela = formatVenezuelanDateTime(new Date());
  const evaluationPeriod = "Últimos 7 días (focos FIRMS y pasadas Copernicus) y último boletín INAMEH";
  const systemIdentifier = "CENTINELA ORINOCO — MONITOREO SATELITAL E HIDROLÓGICO";

  const prescriptiveRecommendations: string[] = [];
  if (ev.hotspots.length > 0) {
    prescriptiveRecommendations.push(`VERIFICACIÓN DE FOCOS: Revisar en imagen óptica o en campo los ${ev.hotspots.length} focos de calor del radio, empezando por los de confianza alta (${ev.highConfidence}).`);
  }
  if (ev.s2Useful.length > 0) {
    prescriptiveRecommendations.push(`IMAGEN ÓPTICA DISPONIBLE: Hay ${ev.s2Useful.length} escenas Sentinel-2 con menos de ${S2_USEFUL_CLOUD_PCT}% de nubes para inspección visual.`);
  } else {
    prescriptiveRecommendations.push("SEGUIMIENTO RADAR: Sin imagen óptica útil reciente; priorizar Sentinel-1, que ve a través de las nubes (Nivel 2).");
  }
  prescriptiveRecommendations.push("CALIDAD DEL AGUA: Tomar muestras de campo (turbidez, pH, conductividad, mercurio) y cargarlas por KoboToolbox para disponer de mediciones reales.");
  if (isStrictAbrae && hasIndicators) {
    prescriptiveRecommendations.push("ÁREA PROTEGIDA: Notificar a la autoridad ambiental competente para inspección, dado que el sector corresponde a un ABRAE.");
  }

  const perceptiveSummary = `${ev.hotspots.length} focos de calor (${ev.highConfidence} de confianza alta${ev.maxFrp === null ? "" : `, FRP máx. ${ev.maxFrp.toFixed(1)} MW`}), ${ev.sar.length} perturbaciones SAR medidas y ${ev.s2Useful.length} escenas Sentinel-2 útiles en ${radiusKm} km.`;
  const predictiveSummary = "Sin modelo predictivo calibrado: las proyecciones requieren series temporales de turbidez y SAR (Nivel 2).";

  const evidenceText = [
    `- Focos FIRMS en ${radiusKm} km (7 días): ${ev.hotspots.length} (confianza alta: ${ev.highConfidence}; FRP máximo: ${ev.maxFrp === null ? "s/d" : `${ev.maxFrp.toFixed(1)} MW`}).`,
    `- Perturbaciones SAR medidas: ${ev.sar.length}.`,
    `- Pasadas Sentinel-1 sobre la zona: ${ev.s1Scenes.length}. Productos Sentinel-2: ${ev.s2Products.length} (${ev.s2Useful.length} con menos de ${S2_USEFUL_CLOUD_PCT}% de nubes).`,
    ev.nearestStation
      ? `- Estación INAMEH más cercana: ${ev.nearestStation.station.name} a ${Math.round(ev.nearestStation.distanceKm)} km, nivel ${ev.nearestStation.station.latest_level_msnm ?? "s/d"} msnm (${ev.nearestStation.station.latest_reading_date ?? "s/f"}), estado ${ev.nearestStation.station.latest_alert_status ?? "s/d"}.`
      : "- Sin estaciones INAMEH cargadas.",
    `- Reportes de campo Kobo en el radio: ${ev.koboReports.length}.`,
    ev.corpusSites.length > 0
      ? `- Sitios de estudio publicados en el radio: ${ev.corpusSites.map(c => `${c.site} (${c.title})`).join("; ")}.`
      : "- Sin sitios de estudio publicados en el radio.",
    `- ${WATER_QUALITY_NOTE}`,
  ].join("\n");

  const systemInstruction = `Eres analista ambiental del sistema "Centinela Orinoco". Redactas en español formal, en Markdown limpio y sin LaTeX.
REGLAS:
- Usa EXCLUSIVAMENTE las cifras de la sección EVIDENCIA. No inventes mediciones, hectáreas, niveles, porcentajes de confianza ni referencias bibliográficas.
- Un foco de calor no confirma minería: preséntalo como indicio que requiere verificación.
- No des valores de turbidez, pH, conductividad ni mercurio: no se miden en esta plataforma.
- No incluyas encabezado institucional (se agrega aparte).`;

  const userPrompt = `Analiza la zona con la evidencia disponible.

SECTOR: ${zoneName}
UBICACIÓN: ${formattedGpsZone}
EVENTO QUE ORIGINA EL ANÁLISIS: ${generatingEvent?.title || zoneName} (${generatingEvent?.typeLabel || "consulta"})
RÉGIMEN TERRITORIAL (estimado por nombre): ${regimeLabel}
CLASIFICACIÓN PRELIMINAR: ${verdictLabel}

EVIDENCIA:
${evidenceText}

Estructura: 1) Situación observada, 2) Limitaciones de los datos, 3) Clasificación y fundamento, 4) Acciones recomendadas de verificación.`;

  let executionResult: CascadingExecutionResult;
  try {
    executionResult = await aiModelCascadeManager.executeWithCascadingModels(userPrompt, systemInstruction);
  } catch (err: any) {
    console.warn("[Zone Analytics Engine] IA no disponible; informe determinístico:", err?.message || err);
    executionResult = {
      text: `### 1. SITUACIÓN OBSERVADA\n${evidenceText}\n\n### 2. CLASIFICACIÓN\n**${verdictLabel}**\n\n${verdictSummary}`,
      modelUsed: "contingency_tactical_engine",
      modelDisplayName: "Informe determinístico (sin IA)",
      modelIndex: -1,
      executionSteps: [{
        modelId: "contingency_tactical_engine",
        displayName: "Informe determinístico (sin IA)",
        index: -1,
        attemptTimestamp: new Date().toISOString(),
        status: "SUCCESS",
      }],
      poolStatus: aiModelCascadeManager.getModelPoolStatus(),
      engineType: "tactical_contingency",
    };
  }

  const technicalSheet = `### FICHA TÉCNICA
| Parámetro | Valor |
| :--- | :--- |
| **Sector** | ${zoneName} |
| **Ubicación** | ${formattedGpsZone} |
| **Evento que origina el análisis** | ${generatingEvent?.title || zoneName} |
| **Ubicación del evento** | ${formattedGpsEvent} |
| **Radio de análisis** | ${radiusKm} km |
| **Ventana temporal** | ${evaluationPeriod} |
| **Emisión** | ${issuedAtVenezuela} |
| **Régimen territorial (estimado)** | ${regimeLabel} |
| **Clasificación** | ${verdictLabel} |`;

  const recommendations = `### RECOMENDACIONES\n${prescriptiveRecommendations.map((r, i) => `${i + 1}. **${r.split(":")[0]}:**${r.split(":").slice(1).join(":")}`).join("\n")}`;

  const body = (executionResult.text || "").trim();
  const analysisMarkdown = [OFFICIAL_HEADER, technicalSheet, "---", body, "---", recommendations, "---", DATA_REFERENCES].join("\n\n");

  return {
    zoneName,
    coordinates: { lat, lng },
    satelliteLocation: { latitude: lat, longitude: lng, formatted: formattedGpsZone, geohashOrSector: zoneName },
    generatingEvent: generatingEvent ? { ...generatingEvent, coordinates: { lat: eventLat, lng: eventLng } } : undefined,
    systemIdentifier,
    evaluationPeriod,
    issuedAtVenezuela,
    prescriptiveRecommendations,
    analysisMarkdown,
    verdict,
    verdictLabel,
    verdictSummary,
    perceptiveSummary,
    predictiveSummary,
    ragIndicators,
    explicitDataSources,
    aiExecution: {
      modelUsed: executionResult.modelUsed,
      modelDisplayName: executionResult.modelDisplayName,
      modelIndex: executionResult.modelIndex,
      engineType: executionResult.engineType,
      poolStatus: executionResult.poolStatus,
      executionSteps: executionResult.executionSteps,
    },
    timestamp: new Date().toISOString(),
  };
}
