export type SatelliteApiCategory =
  | 'THERMAL_INFRARED'
  | 'SAR_RADAR'
  | 'MULTISPECTRAL_OPTICAL'
  | 'FOREST_ALERTS'
  | 'REGIONAL_BASIN'
  | 'INTERNAL_PIPELINE'
  | 'RIVER_TELEMETRY';

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
  bboxString: string;
}

export interface SatelliteApiConnection {
  id: string;
  name: string;
  agency: string;
  category: SatelliteApiCategory;
  sensorMissions: string[];
  activeUrl: string;
  baseUrlTemplate: string;
  documentationUrl: string;
  updateFrequency: string;
  spatialResolution: string;
  amazonBoundingBox: BoundingBox;
  authType: 'MAP_KEY_PARAM' | 'BEARER_TOKEN_OAUTH2' | 'BASIC_AUTH' | 'PUBLIC_NO_AUTH' | 'INTERNAL_PROXY' | 'PUBLIC_OGC';
  /** ACTIVE: consumida por la ingesta. REFERENCE_ONLY: documentada, sin ingesta. UNAVAILABLE: endpoint caído. */
  availability: 'ACTIVE' | 'REFERENCE_ONLY' | 'UNAVAILABLE';
  availabilityNote?: string;
  /** URL liviana para comprobar disponibilidad cuando activeUrl es costosa de consultar. */
  healthCheckUrl?: string;
  description: string;
  payloadFormat: 'CSV' | 'GEOJSON' | 'JSON' | 'NETCDF' | 'GEOTIFF' | 'PNG_WMS' | 'GEOJSON_STAC' | 'PDF_BULLETIN';
  sampleCurlCommand: string;
  queryParameters: {
    name: string;
    description: string;
    example: string;
  }[];
}

/** Estados monitoreados por la plataforma (nombres de los límites ADM1 cargados en la app). */
export const MONITORED_STATES = ['Amazonas', 'Bolívar', 'Delta Amacuro', 'Guayana Esequiba'] as const;

/**
 * Recuadro de consulta que cubre los estados monitoreados (calculado de sus polígonos:
 * -67.86, 0.63, -57.95, 10.02, más un pequeño margen). Incluye franjas de estados y
 * países vecinos: cada foco se asigna después a su estado y solo se guardan los de MONITORED_STATES.
 */
export const MONITORING_BBOX: BoundingBox = {
  west: -68.0,
  south: 0.6,
  east: -57.8,
  north: 10.1,
  bboxString: '-68.0,0.6,-57.8,10.1',
};

/** Orden de ejes WMS 1.3.0 en EPSG:4326: Sur, Oeste, Norte, Este. */
export const MONITORING_WMS_BBOX = '0.6,-68.0,10.1,-57.8';

/** Polígono WKT del mismo recuadro, para filtros OData.CSC.Intersects. */
export const MONITORING_WKT =
  'POLYGON((-68.0 0.6,-57.8 0.6,-57.8 10.1,-68.0 10.1,-68.0 0.6))';

/** Marcador que se sustituye en el servidor por FIRMS_MAP_KEY. Nunca escribir la clave real aquí. */
export const FIRMS_MAP_KEY_PLACEHOLDER = '[FIRMS_MAP_KEY]';

const STAC_SEARCH_URL = 'https://stac.dataspace.copernicus.eu/v1/search';
const ODATA_PRODUCTS_URL = 'https://catalogue.dataspace.copernicus.eu/odata/v1/Products';
const SENTINEL3_ACTIVE_FILTER =
  `Collection/Name eq 'SENTINEL-3' and contains(Name,'OL_2_WFR') and OData.CSC.Intersects(area=geography'SRID=4326;${MONITORING_WKT}')`;

/**
 * Directorio Oficial de APIs de Conexiones Satelitales utilizadas en Centinela Orinoco
 * Enfocadas en los estados Amazonas, Bolívar, Delta Amacuro y Guayana Esequiba
 */
export const SATELLITE_API_CONNECTIONS: SatelliteApiConnection[] = [
  {
    id: 'NASA_FIRMS_VIIRS_NOAA20',
    name: 'NASA FIRMS - VIIRS / MODIS NRT Fire & Thermal Anomalies API',
    agency: 'NASA Earthdata / LANCE FIRMS',
    category: 'THERMAL_INFRARED',
    sensorMissions: ['VIIRS (Suomi-NPP & NOAA-20)', 'MODIS (Terra & Aqua)'],
    activeUrl: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY_PLACEHOLDER}/VIIRS_NOAA20_NRT/${MONITORING_BBOX.bboxString}/1`,
    baseUrlTemplate: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{BBOX}/{DAY_RANGE}',
    documentationUrl: 'https://firms.modaps.eosdis.nasa.gov/api/area/',
    updateFrequency: 'Cada 3 horas (NRT - Near Real Time)',
    spatialResolution: '375 m (VIIRS I-Band) / 1 km (MODIS)',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'MAP_KEY_PARAM',
    availability: 'ACTIVE',
    availabilityNote: 'La MAP_KEY se lee de la variable de entorno FIRMS_MAP_KEY en el servidor.',
    description: 'Ingesta de anomalías térmicas y focos de calor activos (hornos de fundición minera, tala y quema, campamentos). Se consultan los sensores VIIRS NOAA-20, VIIRS Suomi-NPP y MODIS.',
    payloadFormat: 'CSV',
    sampleCurlCommand: `curl -s "https://firms.modaps.eosdis.nasa.gov/api/area/csv/$FIRMS_MAP_KEY/VIIRS_NOAA20_NRT/${MONITORING_BBOX.bboxString}/1"`,
    queryParameters: [
      { name: 'MAP_KEY', description: 'Clave gratuita emitida por NASA FIRMS (variable de entorno FIRMS_MAP_KEY)', example: FIRMS_MAP_KEY_PLACEHOLDER },
      { name: 'SOURCE', description: 'Sensor satelital (VIIRS_NOAA20_NRT, VIIRS_SNPP_NRT, MODIS_NRT)', example: 'VIIRS_NOAA20_NRT' },
      { name: 'BBOX', description: 'Recuadro [Oeste,Sur,Este,Norte] de Amazonas, Bolívar, Delta Amacuro y Guayana Esequiba', example: MONITORING_BBOX.bboxString },
      { name: 'DAY_RANGE', description: 'Número de días retrospectivos a consultar (1 a 10)', example: '1' }
    ]
  },
  {
    id: 'NASA_FIRMS_WMS_GEOJSON',
    name: 'NASA GIBS WMS - Capa de Anomalías Térmicas VIIRS 375 m',
    agency: 'NASA GIBS (Global Imagery Browse Services)',
    category: 'THERMAL_INFRARED',
    sensorMissions: ['VIIRS 375m Active Fire'],
    activeUrl: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&VERSION=1.3.0&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=1024&HEIGHT=768&CRS=EPSG:4326&BBOX=${MONITORING_WMS_BBOX}`,
    baseUrlTemplate: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS={LAYER}&VERSION=1.3.0&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH={WIDTH}&HEIGHT={HEIGHT}&CRS=EPSG:4326&BBOX={SOUTH,WEST,NORTH,EAST}',
    documentationUrl: 'https://nasa-gibs.github.io/gibs-api-docs/',
    updateFrequency: 'Diaria (composición NRT)',
    spatialResolution: '375 m (ráster)',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'PUBLIC_OGC',
    availability: 'ACTIVE',
    availabilityNote: 'Capa superpuesta en el mapa táctico (Leaflet). No se almacena en Supabase.',
    description: 'Servicio Web Cartográfico OGC (WMS) público para superponer focos térmicos VIIRS sobre el mapa táctico.',
    payloadFormat: 'PNG_WMS',
    sampleCurlCommand: `curl -s -o firms_wms.png "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&VERSION=1.3.0&FORMAT=image/png&TRANSPARENT=TRUE&WIDTH=1024&HEIGHT=768&CRS=EPSG:4326&BBOX=${MONITORING_WMS_BBOX}"`,
    queryParameters: [
      { name: 'SERVICE / REQUEST', description: 'Servicio OGC y operación', example: 'WMS / GetMap' },
      { name: 'VERSION', description: 'Versión del protocolo WMS', example: '1.3.0' },
      { name: 'LAYERS', description: 'Capa GIBS', example: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All' },
      { name: 'BBOX', description: 'Recuadro en orden WMS 1.3.0 EPSG:4326 [Sur,Oeste,Norte,Este]', example: MONITORING_WMS_BBOX },
      { name: 'TIME', description: 'Fecha opcional de la composición (YYYY-MM-DD)', example: '2026-10-24' }
    ]
  },
  {
    id: 'COPERNICUS_CDSE_SENTINEL1_SAR',
    name: 'Copernicus Data Space Ecosystem (CDSE) - Sentinel-1 GRD STAC Catalogue',
    agency: 'Agencia Espacial Europea (ESA) / Unión Europea',
    category: 'SAR_RADAR',
    sensorMissions: ['Sentinel-1C / Sentinel-1D (Banda C SAR, IW, Polarización Dual VV+VH)'],
    activeUrl: `${STAC_SEARCH_URL}?bbox=${MONITORING_BBOX.bboxString}&collections=sentinel-1-grd&limit=100`,
    baseUrlTemplate: `${STAC_SEARCH_URL}?bbox={BBOX}&collections={COLLECTION}&datetime={START_DATE}/{END_DATE}&limit={LIMIT}`,
    documentationUrl: 'https://documentation.dataspace.copernicus.eu/APIs/STAC.html',
    updateFrequency: 'Consulta cada 12 horas (revisita orbital 6-12 días)',
    spatialResolution: '10 m (GRD - Interferometric Wide)',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'PUBLIC_NO_AUTH',
    availability: 'ACTIVE',
    availabilityNote: 'El catálogo es público. Solo la descarga o el procesamiento de píxeles requiere token OAuth2.',
    description: 'Catálogo de pasadas reales de radar SAR sobre el área. Indica qué escena existe, cuándo y dónde; la detección de desmonte o dragado requiere procesar los píxeles (Nivel 2).',
    payloadFormat: 'GEOJSON_STAC',
    sampleCurlCommand: `curl -s "${STAC_SEARCH_URL}?bbox=${MONITORING_BBOX.bboxString}&collections=sentinel-1-grd&limit=10"`,
    queryParameters: [
      { name: 'bbox', description: 'Recuadro en grados decimales [Oeste,Sur,Este,Norte]', example: MONITORING_BBOX.bboxString },
      { name: 'collections', description: 'Colección STAC', example: 'sentinel-1-grd' },
      { name: 'datetime', description: 'Intervalo ISO-8601', example: '2026-10-17T00:00:00Z/2026-10-24T23:59:59Z' },
      { name: 'limit', description: 'Escenas por página (se pagina con el enlace "next")', example: '100' }
    ]
  },
  {
    id: 'COPERNICUS_SENTINEL_HUB_PROCESS',
    name: 'Sentinel Hub Process / Statistical API (Copernicus CDSE)',
    agency: 'ESA / Planet / Sinergise',
    category: 'SAR_RADAR',
    sensorMissions: ['Sentinel-1 SAR Backscatter', 'Sentinel-2 L2A (NDVI, turbidez Nechad)'],
    activeUrl: 'https://sh.dataspace.copernicus.eu/api/v1/process',
    baseUrlTemplate: 'https://sh.dataspace.copernicus.eu/api/v1/{process|statistics}',
    documentationUrl: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Process.html',
    updateFrequency: 'Bajo demanda (procesamiento en la nube)',
    spatialResolution: '10 m',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'BEARER_TOKEN_OAUTH2',
    availability: 'REFERENCE_ONLY',
    availabilityNote: 'Nivel 2: requiere COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET (cuenta CDSE).',
    description: 'Procesamiento de píxeles mediante peticiones POST con Evalscript: retrodispersión SAR calibrada, NDVI y turbidez. Base del Nivel 2 (detecciones reales).',
    payloadFormat: 'GEOTIFF',
    sampleCurlCommand: 'curl -X POST "https://sh.dataspace.copernicus.eu/api/v1/process" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d \'{"input":{"bounds":{"bbox":[-66.9,3.6,-66.6,3.9]},"data":[{"type":"sentinel-1-grd"}]},"output":{"width":512,"height":512}}\'',
    queryParameters: [
      { name: 'Authorization', description: 'Token OAuth2 (Bearer) emitido por identity.dataspace.copernicus.eu', example: 'Bearer <token>' },
      { name: 'bbox', description: 'Zona de vigilancia [W, S, E, N]', example: '[-66.9, 3.6, -66.6, 3.9]' },
      { name: 'evalscript', description: 'Script de procesamiento de píxeles', example: '//VERSION=3\nfunction setup(){return{input:["VV"],output:{bands:1}}}\nfunction evaluatePixel(s){return [s.VV]}' }
    ]
  },
  {
    id: 'INPE_QUEIMADAS_AMAZONIA',
    name: 'INPE Programa Queimadas - API de Focos de la Amazonía',
    agency: 'Instituto Nacional de Pesquisas Espaciais (INPE - Brasil)',
    category: 'REGIONAL_BASIN',
    sensorMissions: ['AQUA_M-T', 'TERRA_M-T', 'NPP-375', 'NOAA-20', 'GOES-16'],
    activeUrl: 'https://terrabrasilis.dpi.inpe.br/queimadasapi/focos/?pais_id=233',
    baseUrlTemplate: 'https://terrabrasilis.dpi.inpe.br/queimadasapi/focos/?pais_id={PAIS_ID}',
    documentationUrl: 'https://terrabrasilis.dpi.inpe.br/queimadas/portal/',
    updateFrequency: 'Cada 1 hora',
    spatialResolution: '375 m a 1 km',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'PUBLIC_NO_AUTH',
    availability: 'UNAVAILABLE',
    availabilityNote: 'Verificado 24/10/2026: queimadas.dgi.inpe.br/api/focos redirige a terrabrasilis.dpi.inpe.br/queimadasapi/focos y responde 404. Sin ingesta hasta confirmar el endpoint vigente.',
    description: 'API del INPE para vigilancia transfronteriza de focos de calor en la Panamazonía. Los mismos sensores ya se ingieren vía NASA FIRMS.',
    payloadFormat: 'JSON',
    sampleCurlCommand: 'curl -s -L "https://terrabrasilis.dpi.inpe.br/queimadasapi/focos/?pais_id=233"',
    queryParameters: [
      { name: 'pais_id', description: 'Código de país (233 = Venezuela)', example: '233' }
    ]
  },
  {
    id: 'GFW_GLAD_DEFORESTATION_ALERTS',
    name: 'Global Forest Watch (GFW) - Integrated Deforestation Alerts API',
    agency: 'World Resources Institute (WRI) / University of Maryland (UMD)',
    category: 'FOREST_ALERTS',
    sensorMissions: ['GLAD-L (Landsat)', 'GLAD-S2 (Sentinel-2)', 'RADD (Radar SAR Alert)'],
    activeUrl: "https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/latest/query?sql=SELECT count(*) FROM data WHERE country='VEN'",
    baseUrlTemplate: 'https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/latest/query?sql={SQL_QUERY}',
    documentationUrl: 'https://www.globalforestwatch.org/help/developers/',
    updateFrequency: 'Semanal / Diaria',
    spatialResolution: '10 a 30 metros',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'BEARER_TOKEN_OAUTH2',
    availability: 'REFERENCE_ONLY',
    availabilityNote: 'Requiere una clave de API propia de GFW (x-api-key). Sin ingesta en el Nivel 1.',
    description: 'Alertas tempranas de pérdida de bosque primario que combinan radar SAR y sensores ópticos sobre áreas protegidas (ABRAE).',
    payloadFormat: 'JSON',
    sampleCurlCommand: 'curl -s -H "x-api-key: $GFW_API_KEY" "https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/latest/query?sql=SELECT%20count(*)%20FROM%20data%20WHERE%20country%3D%27VEN%27"',
    queryParameters: [
      { name: 'sql', description: 'Consulta SQL sobre el dataset de alertas', example: "SELECT * FROM data WHERE country='VEN' AND adm1='Amazonas'" }
    ]
  },
  {
    id: 'COPERNICUS_CDSE_SENTINEL2_MSI',
    name: 'Copernicus Data Space Ecosystem (CDSE) - Sentinel-2 MSI L2A STAC Catalogue',
    agency: 'Agencia Espacial Europea (ESA) / Unión Europea',
    category: 'MULTISPECTRAL_OPTICAL',
    sensorMissions: ['Sentinel-2A / Sentinel-2B / Sentinel-2C (Multispectral Instrument - 13 bandas)'],
    activeUrl: `${STAC_SEARCH_URL}?bbox=${MONITORING_BBOX.bboxString}&collections=sentinel-2-l2a&limit=100`,
    baseUrlTemplate: `${STAC_SEARCH_URL}?bbox={BBOX}&collections={COLLECTION}&datetime={START_DATE}/{END_DATE}&limit={LIMIT}`,
    documentationUrl: 'https://documentation.dataspace.copernicus.eu/APIs/STAC.html',
    updateFrequency: 'Consulta cada 24 horas (revisita 5 días)',
    spatialResolution: '10 m (B02, B03, B04, B08), 20 m (B11, B12, SCL)',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'PUBLIC_NO_AUTH',
    availability: 'ACTIVE',
    availabilityNote: 'El catálogo es público. Solo la descarga o el procesamiento de píxeles requiere token OAuth2.',
    description: 'Catálogo de escenas ópticas reales con su nubosidad (eo:cloud_cover) y cuadrante MGRS. Permite saber cuándo hay imagen útil de cada zona; la turbidez (Nechad) y el NDVI se calculan en el Nivel 2.',
    payloadFormat: 'GEOJSON_STAC',
    sampleCurlCommand: `curl -s "${STAC_SEARCH_URL}?bbox=${MONITORING_BBOX.bboxString}&collections=sentinel-2-l2a&limit=10"`,
    queryParameters: [
      { name: 'bbox', description: 'Recuadro en grados decimales [Oeste,Sur,Este,Norte]', example: MONITORING_BBOX.bboxString },
      { name: 'collections', description: 'Colección L2A con corrección atmosférica', example: 'sentinel-2-l2a' },
      { name: 'datetime', description: 'Intervalo ISO-8601', example: '2026-10-17T00:00:00Z/2026-10-24T23:59:59Z' },
      { name: 'limit', description: 'Escenas por página (se pagina con el enlace "next")', example: '100' }
    ]
  },
  {
    id: 'COPERNICUS_CDSE_SENTINEL3_OLCI_SLSTR',
    name: 'Copernicus Data Space Ecosystem (CDSE) - Sentinel-3 OLCI / SLSTR OData Catalogue',
    agency: 'Agencia Espacial Europea (ESA) / EUMETSAT / Unión Europea',
    category: 'MULTISPECTRAL_OPTICAL',
    sensorMissions: [
      'Sentinel-3A / Sentinel-3B OLCI (Ocean & Land Colour Instrument - 21 bandas)',
      'Sentinel-3A / Sentinel-3B SLSTR (Sea & Land Surface Temperature Radiometer)'
    ],
    activeUrl: `${ODATA_PRODUCTS_URL}?$filter=${SENTINEL3_ACTIVE_FILTER}&$orderby=ContentDate/Start desc&$top=20`,
    baseUrlTemplate: `${ODATA_PRODUCTS_URL}?$filter={FILTER}&$orderby=ContentDate/Start desc&$top={LIMIT}`,
    documentationUrl: 'https://documentation.dataspace.copernicus.eu/APIs/OData.html',
    updateFrequency: 'Consulta cada 24 horas (cobertura casi diaria)',
    spatialResolution: '300 m (OLCI FR) / 1 km (SLSTR)',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'PUBLIC_NO_AUTH',
    availability: 'ACTIVE',
    availabilityNote: 'Solo metadatos del catálogo. Los productos (37-116 MB) no se descargan en el Nivel 1.',
    healthCheckUrl: `${ODATA_PRODUCTS_URL}?$filter=Collection/Name eq 'SENTINEL-3'&$top=1&$select=Id`,
    description: 'Catálogo OData de productos Sentinel-3 sobre el área. OLCI L2 (OL_2_WFR) contiene materia suspendida total (TSM), clorofila y CDOM; SLSTR L2 (SL_2_WST) contiene temperatura superficial. Ninguno mide conductividad, pH ni mercurio.',
    payloadFormat: 'JSON',
    sampleCurlCommand: `curl -s -G "${ODATA_PRODUCTS_URL}" --data-urlencode "\\$filter=${SENTINEL3_ACTIVE_FILTER}" --data-urlencode "\\$orderby=ContentDate/Start desc" --data-urlencode "\\$top=3"`,
    queryParameters: [
      { name: '$filter', description: "Colección 'SENTINEL-3', tipo de producto (OL_2_WFR o SL_2_WST) e intersección espacial", example: "Collection/Name eq 'SENTINEL-3' and contains(Name,'OL_2_WFR')" },
      { name: '$orderby', description: 'Orden por fecha de adquisición', example: 'ContentDate/Start desc' },
      { name: '$top', description: 'Número máximo de productos', example: '20' }
    ]
  },
  {
    id: 'INAMEH_HIDROMETRIA_ORINOCO',
    name: 'INAMEH - Red Hidrométrica Oficial del Río Orinoco',
    agency: 'Instituto Nacional de Meteorología e Hidrología (INAMEH)',
    category: 'RIVER_TELEMETRY',
    sensorMissions: ['Estaciones hidrométricas in situ (reglas limnimétricas)'],
    activeUrl: 'http://www.inameh.gob.ve/web/robolivar.php',
    baseUrlTemplate: 'http://www.inameh.gob.ve/web/{STATION_ENDPOINT}.php',
    documentationUrl: 'http://www.inameh.gob.ve/web/',
    updateFrequency: 'Diaria (boletín PDF); consulta cada 6 horas',
    spatialResolution: 'Estaciones puntuales',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'PUBLIC_NO_AUTH',
    availability: 'ACTIVE',
    availabilityNote: 'El nivel se publica en un PDF incrustado en cada página. Solo HTTP: se consulta desde el servidor. Ciudad Bolívar sin actualizar desde 18/03/2025.',
    description: 'Lectura automatizada del boletín de nivel (msnm), variación diaria y cota de desborde de las estaciones Puerto Ayacucho (0850), Caicara (0855), Ciudad Bolívar (0870) y Palúa (0875). INAMEH no publica turbidez, conductividad, pH ni mercurio.',
    payloadFormat: 'PDF_BULLETIN',
    sampleCurlCommand: 'curl -s "http://www.inameh.gob.ve/web/robolivar.php"',
    queryParameters: [
      {
        name: 'STATION_ENDPOINT',
        description: 'Página PHP de la estación; contiene el enlace al PDF del boletín.',
        example: 'roayacucho | rocaicara | robolivar | ropalua'
      }
    ]
  },
  {
    id: 'CENTINELA_INTERNAL_INGESTION_PROXY',
    name: 'Centinela Orinoco Ingestion Engine (Backend Proxy)',
    agency: 'Centinela Orinoco / Node Express Server',
    category: 'INTERNAL_PIPELINE',
    sensorMissions: ['NASA FIRMS', 'Copernicus Sentinel-1/2/3', 'INAMEH', 'Webhook KoboToolbox / ODK'],
    activeUrl: '/api/scheduler/status',
    baseUrlTemplate: '/api/scheduler/trigger/{TASK_KEY}',
    documentationUrl: '/api/health',
    updateFrequency: 'Tareas programadas + cron externo (POST /api/scheduler/run-due)',
    spatialResolution: 'Geometrías PostGIS (Point / Polygon WGS84 EPSG:4326)',
    amazonBoundingBox: MONITORING_BBOX,
    authType: 'INTERNAL_PROXY',
    availability: 'ACTIVE',
    availabilityNote: 'Los disparadores requieren el encabezado x-ingestion-token (INGESTION_TRIGGER_TOKEN).',
    description: 'Rutas internas que protegen las credenciales, consumen las fuentes de este directorio e insertan en Supabase solo registros nuevos (claves únicas). Los documentos de environmental_rag_documents se vectorizan con Gemini (gemini-embedding-001, 768 dimensiones) y se consultan con la RPC match_environmental_documents (pgvector + PostGIS).',
    payloadFormat: 'JSON',
    sampleCurlCommand: 'curl -s -X POST -H "x-ingestion-token: $INGESTION_TRIGGER_TOKEN" "http://localhost:3000/api/scheduler/trigger/NASA_FIRMS"',
    queryParameters: [
      { name: 'GET /api/scheduler/status', description: 'Estado de las tareas, últimos registros nuevos / omitidos', example: '{}' },
      { name: 'POST /api/scheduler/trigger/{TASK_KEY}', description: 'Ejecuta una tarea (NASA_FIRMS, SENTINEL_1_SAR, SENTINEL_2_MSI, SENTINEL_3_OLCI, HYDRO_TELEMETRY)', example: 'NASA_FIRMS' },
      { name: 'POST /api/scheduler/run-due', description: 'Ejecuta las tareas vencidas (para cron externo)', example: '{}' },
      { name: 'POST /api/webhooks/kobo', description: 'Recibe minutas de patrullaje de Guardería Ambiental', example: '{"officerName":"Cap. Marcos Alfonzo"}' }
    ]
  }
];

/**
 * Mapeo oficial entre las tareas programadas del componente de ingesta y las conexiones del directorio
 */
export const TASK_TO_API_CONNECTION_MAP: Record<string, string> = {
  NASA_FIRMS: 'NASA_FIRMS_VIIRS_NOAA20',
  SENTINEL_1_SAR: 'COPERNICUS_CDSE_SENTINEL1_SAR',
  SENTINEL_2_MSI: 'COPERNICUS_CDSE_SENTINEL2_MSI',
  SENTINEL_3_OLCI: 'COPERNICUS_CDSE_SENTINEL3_OLCI_SLSTR',
  HYDRO_TELEMETRY: 'INAMEH_HIDROMETRIA_ORINOCO',
};

/**
 * Obtiene la conexión satelital oficial configurada en SatelliteApiDirectory para una tarea
 */
export function getApiConnectionForTask(taskKey: string): SatelliteApiConnection | undefined {
  const connectionId = TASK_TO_API_CONNECTION_MAP[taskKey] || taskKey;
  return SATELLITE_API_CONNECTIONS.find(c => c.id === connectionId);
}

/**
 * Sustituye los marcadores {NOMBRE} de una plantilla de URL. Los valores se insertan tal cual;
 * la codificación de parámetros es responsabilidad de quien llama.
 */
export function fillUrlTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([A-Z_]+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}
