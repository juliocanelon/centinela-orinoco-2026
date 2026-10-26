export type ViewMode = 
  | 'MAP_SITUATION'
  | 'COMMUNITY_REPORTS'
  | 'LIVE_PIPELINE'
  | 'SCIENTIFIC_CORPUS'
  | 'SAR_RADAR_ANOMALIES'
  | 'TELEMETRY'
  | 'INCIDENTS'
  | 'SUPABASE_CONSOLE'
  | 'AI_INTELLIGENCE'
  | 'BULLETIN_GENERATOR';

export type BaseLayerType = 'satellite' | 'dark' | 'topo';

export interface VisibleLayersState {
  venezuela: boolean;
  states: boolean;
  municipalities: boolean;
  rivers: boolean;
  sectors: boolean;
  basin: boolean;
  mining: boolean;
  heat: boolean;
  hydro: boolean;
  protected: boolean;
  incidents: boolean;
  communityReports: boolean;
  sentinelS2: boolean;
  firmsWms: boolean;
  scientific: boolean;
  amazonasBolivarDelta: boolean;
}

export type CommunityReportCategory = 
  | 'MINERIA_ILEGAL'
  | 'CONTAMINACION_HIDRICA'
  | 'DERRAME_HIDROCARBUROS'
  | 'DEFORESTACION'
  | 'AFECTACION_FAUNA_FLORA'
  | 'INVASION_ABRAE'
  | 'OTRO';

export type CommunityReportStatus = 
  | 'PENDIENTE_VALIDACION'
  | 'CONFIRMADA_EN_TERRENO'
  | 'OPERATIVO_ENVIADO'
  | 'DESESTIMADA';

export interface CommunityReportMedia {
  id: string;
  type: 'image' | 'video';
  name: string;
  url: string;
  sizeMb?: number;
  thumbnailUrl?: string;
  storagePath?: string;
}

export interface CommunityReport {
  id: string;
  code: string;
  title: string;
  category: CommunityReportCategory;
  severity: AlertSeverity;
  status: CommunityReportStatus;
  latitude: number;
  longitude: number;
  locationName: string;
  communityName?: string;
  description: string;
  isAnonymous: boolean;
  reporterName?: string;
  reporterContact?: string;
  media: CommunityReportMedia[];
  timestamp: string;
  verifiedBy?: string;
  linkedIncidentId?: string;
  upvotesCount?: number;
}

export type IngestionSource = 'NASA_FIRMS' | 'COPERNICUS_SAR' | 'KOBO_TOOLBOX' | 'ODK_COLLECT';

/** Foco de calor NASA FIRMS tal como lo entrega /api/ingestion/feed. */
export interface NasaFirmsHotspot {
  id: string;
  satellite: string;
  latitude: number;
  longitude: number;
  brightnessTempK: number | null;
  frpMw: number | null;
  confidence: 'low' | 'nominal' | 'high';
  acqDate: string;
  acqTime: string;
  dayNight: 'D' | 'N';
  state: string;
  sectorName: string;
  sourceProduct: string;
}

/** Escena Sentinel-1 GRD del catálogo STAC de Copernicus. */
export interface Sentinel1Scene {
  sceneId: string;
  platform: string;
  acquiredAt: string;
  instrumentMode: string | null;
  polarizations: string[] | null;
  orbitState: string | null;
  relativeOrbit: number | null;
  centerLat: number | null;
  centerLon: number | null;
  stacItemUrl: string | null;
}

/** Producto Sentinel-3 (OLCI WFR / SLSTR WST) del catálogo OData de Copernicus. */
export interface Sentinel3Product {
  productId: string;
  productName: string;
  platform: string;
  instrument: 'OLCI' | 'SLSTR';
  productType: string;
  sensingStart: string;
  centerLat: number | null;
  centerLon: number | null;
  odataUrl: string;
}

export interface IngestionFeed {
  loadedAt: string | null;
  hotspots: NasaFirmsHotspot[];
  sentinel1Scenes: Sentinel1Scene[];
  sentinel2Products: S2ProductTile[];
  sentinel3Products: Sentinel3Product[];
  hydroStations: HydrologicalStation[];
  sarDisturbances: Record<string, any>[];
}

export interface KoboFieldPatrolReport {
  id: string;
  source: 'KOBO_TOOLBOX' | 'ODK_COLLECT';
  formId: string;
  submissionTime: string;
  officerName: string;
  patrolUnit: string;
  riverOrSubBasin: string;
  sectorName: string;
  latitude: number;
  longitude: number;
  category: 'MINERIA_ILEGAL' | 'DEFORESTACION' | 'CONTAMINACION_MERCURIO' | 'PISTA_CLANDESTINA' | 'PATRULLAJE_DE_RUTINA';
  severity: AlertSeverity;
  mercuryDetectedPpm?: number;
  turbidityNtu?: number;
  dredgesConfiscatedCount?: number;
  arrestsCount?: number;
  fuelConfiscatedLiters?: number;
  narrative: string;
  evidencePhotoCount: number;
  postgisGeomText: string;
}

export interface LiveIngestionItem {
  id: string;
  source: IngestionSource;
  title: string;
  timestamp: string;
  sector: string;
  subBasin: string;
  latitude: number;
  longitude: number;
  summary: string;
  severity: AlertSeverity;
  postgisGeom: string;
  embeddingStatus: 'SYNCHRONIZED' | 'PENDING' | 'LOCAL_VECTOR';
  embeddingVectorPreview?: number[];
  attributes: Record<string, any>;
}

/** Documento recuperado de la memoria semántica (vectorial, o por texto como respaldo). */
export interface VectorRagSearchResult {
  id: string;
  source: string;
  title: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  distanceKmFromQueryTarget?: number;
  relevanceScore: number; // vectorial: puntaje del reranker; texto: fracción de términos presentes (0-1)
  similarity?: number; // similitud coseno (solo búsqueda vectorial)
  contentSnippet: string;
  createdAt: string;
}

export interface RagIntelligenceSynthesis {
  query: string;
  timestamp: string;
  searchMethod?: string;
  searchMode?: 'vector' | 'text-fallback';
  fallbackReason?: string;
  terms?: string[];
  engine?: string;
  matchesFoundCount: number;
  topMatches: VectorRagSearchResult[];
  synthesisMarkdown: string;
  tacticalRecommendation: string;
  threatMatrix: {
    deforestationRisk: string;
    mercuryExposureRisk: string;
    indigenousTerritoryOverlap: string;
    immediateInterdictionZone: string;
  };
}

/** Estado de la ingesta (GET /api/ingestion/status). */
export interface IngestionOverview {
  generatedAt: string;
  supabaseConnected: boolean;
  supabaseHost: string;
  tasks: SatelliteScheduledTask[];
  ragDocumentsCount: number;
  kobo: {
    webhookPath: string;
    totalSubmissions: number;
    lastSubmission: string | null;
  };
  cacheLoadedAt: string | null;
}

export interface ScientificArticle {
  id: string;
  title: string;
  authors: string;
  year: number;
  source: string;
  abstract: string;
  fullText?: string;
  primaryBasin: string;
  peerReviewed?: boolean;
  classificationReason?: string;
  docType?: 'pdf' | 'url' | 'doi' | 'text';
  doi?: string;
  investigationSites: {
    name: string;
    latitude: number;
    longitude: number;
    findings: string;
    heavyMetalsPpm?: number;
    turbidityNtu?: number;
    deforestationHa?: number;
    ethnicTerritory?: string;
    sampleType?: string;
  }[];
  tags: string[];
}

export interface SarRadarAnomaly {
  id: string;
  code: string;
  sectorName: string;
  basin: string;
  latitude: number;
  longitude: number;
  baselineDate: string; // Sentinel-1 previous pass
  currentPassDate: string; // Sentinel-1 recent pass
  coherenceLossPercent: number; // Coherence drop indicative of ground disturbance
  sarBackscatterChangeDb: number; // Backscatter differential (dB)
  presumedActivity: 'MINERIA_ALUVION_BALSAS' | 'DEFORESTACION_REPENTINA' | 'PISCINA_RELAVES_LODO' | 'PISTA_CLANDESTINA_EXPANSION';
  severity: AlertSeverity;
  affectedSurfaceHa: number;
  opticalNdviDropPercent: number;
  dredgePresenceProbability: number; // 0-100%
  status: 'SUSPICIOUS' | 'CONFIRMED_INTERDICTION' | 'REJECTED_NATURAL';
  notes: string;
}

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
}

export interface GeoJSONFeature<G = GeoJSONPoint | GeoJSONPolygon | GeoJSONMultiPolygon, P = Record<string, any>> {
  type: 'Feature';
  id?: string | number;
  geometry: G;
  properties: P;
}

export interface GeoJSONFeatureCollection<F = GeoJSONFeature> {
  type: 'FeatureCollection';
  features: F[];
}

export interface HeatAnomaly {
  id: string;
  satellite: string; // VIIRS-NOAA20 | VIIRS-SNPP | MODIS-AQUA | MODIS-TERRA
  latitude: number;
  longitude: number;
  brightnessTempK: number | null;
  frpMw: number | null; // Fire Radiative Power (MW)
  confidence: 'nominal' | 'high' | 'low';
  acqDate: string;
  acqTime: string;
  dayNight: 'D' | 'N';
  sector: string;
  subBasin: string; // estado donde cae el foco
}

/** Zona de vigilancia (referencia) o perturbación SAR medida (Nivel 2). */
export interface MiningCluster {
  id: string;
  name: string;
  basin: string;
  latitude: number;
  longitude: number;
  polygon?: [number, number][];
  activityType: 'aluvion_balsa' | 'cielo_abierto' | 'monitoreo_radar_sar';
  severity: AlertSeverity;
  /** Solo para perturbaciones medidas por SAR (Nivel 2). */
  affectedAreaHa?: number;
  backscatterDiffDb?: number;
  detectedAt?: string;
  abraeOverlap?: string;
  indigenousCommunityOverlap?: string;
}

/** Estación hidrométrica de INAMEH con su último boletín publicado. */
export interface HydrologicalStation {
  id: string; // código INAMEH (0850, 0855, 0870, 0875)
  name: string;
  river: string;
  state: string;
  coordinates: [number, number]; // [lng, lat]
  currentLevelM: number | null; // msnm
  dailyChangeM: number | null;
  trend: 'SUBIENDO' | 'BAJANDO' | 'ESTABLE' | null;
  overflowLevelM: number | null; // cota de desborde publicada por INAMEH
  historicalMaxM: number | null;
  historicalMinM: number | null;
  status: 'OPTIMAL' | 'ELEVATED' | 'ALERT_CRECIDA' | 'SIN_REFERENCIA';
  readingDate: string | null;
  isStale: boolean;
  sourceUrl: string;
  lastTelemetry: string;
}

export interface ProtectedArea {
  id: string;
  name: string;
  category: 'PARQUE_NACIONAL' | 'RESERVA_BIOSFERA' | 'MONUMENTO_NATURAL' | 'TERRITORIO_INDIGENA' | 'RESERVA_FORESTAL';
  surfaceHa: number;
  ethnicGroup?: string;
  coordinates: [number, number][]; // polígono aproximado de referencia
  color: string;
}

export interface IncidentReport {
  id: string;
  code: string;
  title: string;
  category: 'MINERIA_ILEGAL' | 'DEFORESTACION' | 'CONTAMINACION_MERCURIO' | 'PISTA_CLANDESTINA' | 'CRECIDA_SUBITA' | 'ALTERCADO_TERRITORIAL';
  severity: AlertSeverity;
  status: 'ACTIVO' | 'EN_VERIFICACION' | 'OPERATIVO_EN_CURSO' | 'RESUELTO' | 'ARCHIVADO';
  latitude: number;
  longitude: number;
  locationName: string;
  description: string;
  reportedBy: string;
  timestamp: string;
  assignedUnit?: string;
  evidenceCount?: number;
}

export interface SupabaseRpcStatus {
  name: string;
  description: string;
  returns: string;
  sampleParams: Record<string, any>;
  lastStatus: 'idle' | 'success' | 'error' | 'pending';
  executionTimeMs?: number;
  responsePreview?: any;
}

// === Sentinel-2: producto L2A del catálogo STAC ===
export interface S2ProductTile {
  productId: string;
  tileId: string; // cuadrante MGRS (p. ej. T19PHC)
  satelliteCode: string; // S2A | S2B | S2C
  sensingTime: string;
  cloudPixelPct: number | null;
  relativeOrbit: number | null;
  centerLat: number | null;
  centerLon: number | null;
  stacItemUrl: string | null;
}

// === Automated Satellite Scheduler & Supabase Ingestion Types ===
export interface SatelliteScheduledTask {
  key: 'NASA_FIRMS' | 'SENTINEL_1_SAR' | 'SENTINEL_2_MSI' | 'SENTINEL_3_OLCI' | 'HYDRO_TELEMETRY';
  name: string;
  satelliteMission: string;
  agency: string;
  nominalCadenceText: string;
  nominalIntervalHours: number;
  intervalSeconds: number;
  lastRunAt: string | null;
  nextRunAt: string;
  countdownSeconds: number;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'ERROR';
  totalIngested: number;
  supabaseTable: string;
  endpointUrl: string;
  lastInserted: number | null;
  lastSkipped: number | null;
  lastMessage?: string;
}

export interface SchedulerLogEntry {
  id: string;
  timestamp: string;
  taskKey: string;
  satelliteMission: string;
  status: 'SUCCESS' | 'ERROR' | 'RUNNING' | 'WARNING';
  recordsCount: number;
  skippedCount: number;
  supabaseSynced: boolean;
  message: string;
}

export interface SchedulerStatusResponse {
  isRunning: boolean;
  mode: 'PRODUCTION_CADENCE';
  supabaseConnected: boolean;
  supabaseHost?: string;
  activeTasks: SatelliteScheduledTask[];
  recentLogs: SchedulerLogEntry[];
  totalSatelliteEventsIngested: number;
  vectorRagDocsCount: number;
  /** Vectorización de la memoria semántica (worker de embeddings del servidor). */
  ragEmbeddings?: {
    running: boolean;
    model: string;
    embeddedDocs: number | null;
    pendingDocs: number | null;
    pausedUntil: string | null;
    lastRunAt: string | null;
    lastRunEmbedded: number;
    lastError: string | null;
  };
}

// === Zone Predictive & Perceptive Analytics Types ===
export interface RagIndicatorItem {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
  status: 'NORMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  sourceDatabase: string;
  sourceMission: string;
  description: string;
}

export interface ExplicitDataSource {
  category: string;
  table: string;
  sensorOrProvider: string;
  recordsFound: number;
  description: string;
}

export interface AIModelConfigClient {
  index: number;
  id: string;
  displayName: string;
  family: string;
  dailyQueryQuota: number;
  dailyQueriesUsed: number;
  estimatedTokensUsed: number;
  status: 'ACTIVE' | 'AVAILABLE' | 'TOKENS_EXHAUSTED' | 'QUOTA_EXHAUSTED' | 'COOLING_DOWN';
  lastUsedAt?: string;
  lastError?: string;
}

export interface GeneratingCartographicEvent {
  type: 'MINING_CLUSTER' | 'THERMAL_ANOMALY' | 'HYDRO_ALERT' | 'PROTECTED_AREA' | 'INCIDENT' | 'SENTINEL2_DETECTION' | 'SCIENTIFIC_STUDY';
  typeLabel: string;
  title: string;
  coordinates: { lat: number; lng: number };
  satelliteCoordinates?: string;
  satelliteSensor: string;
  severity?: string;
  description: string;
  details?: any;
}

export interface ZoneAnalyticsResult {
  zoneName: string;
  coordinates: { lat: number; lng: number };
  satelliteLocation?: {
    latitude: number;
    longitude: number;
    formatted: string;
    geohashOrSector?: string;
  };
  generatingEvent?: GeneratingCartographicEvent;
  systemIdentifier?: string;
  evaluationPeriod?: string;
  confidencePercentage?: number;
  issuedAtVenezuela?: string;
  prescriptiveRecommendations?: string[];
  analysisMarkdown: string;
  verdict: 'MINERIA_ILEGAL_CONFIRMADA' | 'MINERIA_PERMISADA_ARCO_MINERO' | 'ZONA_CONSERVACION_SIN_MINERIA';
  verdictLabel: string;
  verdictSummary: string;
  perceptiveSummary: string;
  predictiveSummary: string;
  ragIndicators: RagIndicatorItem[];
  explicitDataSources: ExplicitDataSource[];
  aiExecution: {
    modelUsed: string;
    modelDisplayName: string;
    modelIndex: number;
    engineType: 'gemini_multimodel' | 'tactical_contingency';
    poolStatus: AIModelConfigClient[];
    executionSteps: Array<{
      modelId: string;
      displayName: string;
      index: number;
      attemptTimestamp: string;
      status: string;
      errorMessage?: string;
    }>;
  };
  timestamp: string;
}


// === Densidad de focos NASA FIRMS en hexágonos (GET /api/firms/density) ===
export type HotspotPriority = 'ALTA' | 'MEDIA' | 'BAJA';

export interface FirmsDensityHotspot {
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

export interface FirmsDensityCell {
  id: string;
  center: [number, number]; // [lat, lon]
  polygon: [number, number][]; // [lat, lon]
  areaKm2: number;
  total: number;
  relevant: number; // prioridad alta + media
  highConfidence: number;
  byPriority: Record<HotspotPriority, number>;
  level: 0 | 1 | 2 | 3 | 4;
  relevantPer1000Km2: number;
  totalPer1000Km2: number;
  maxFrpMw: number | null;
  perDay: { date: string; total: number; relevant: number }[];
  persistentPoints: { latitude: number; longitude: number; days: number }[];
  states: string[];
  nearestReference: { name: string; kind: 'ZONA_MINERA' | 'AREA_PROTEGIDA'; distanceKm: number; inside: boolean } | null;
  nearestStation: { code: string; name: string; distanceKm: number; levelMsnm: number | null; readingDate: string | null; status: string | null; isStale: boolean } | null;
  latestUsefulS2: { productId: string; tileId: string; sensingTime: string; cloudPixelPct: number | null; stacItemUrl: string | null } | null;
  hotspots: FirmsDensityHotspot[];
}

export interface FirmsDensityResponse {
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
  cells: FirmsDensityCell[];
}
