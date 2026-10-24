import { MiningCluster, ProtectedArea, IncidentReport } from '../types';

/**
 * Zonas de vigilancia: sectores mineros conocidos usados como referencia en el mapa.
 * No contienen mediciones; las perturbaciones medidas por radar llegan desde Supabase (Nivel 2).
 */
export const MONITORING_ZONES: MiningCluster[] = [
  {
    id: 'MIN-001',
    name: 'Sector Cerro Yapacana - Base Occidental',
    basin: 'Alto Orinoco',
    latitude: 3.755,
    longitude: -66.824,
    activityType: 'cielo_abierto',
    severity: 'INFO',
    abraeOverlap: 'Parque Nacional Yapacana (ABRAE Estricta)',
    indigenousCommunityOverlap: 'Territorio Ancestral Piaroa / Puinave',
  },
  {
    id: 'MIN-002',
    name: 'Río Ikabarú - Cuenca Alta del Caroní',
    basin: 'Río Caroní',
    latitude: 4.341,
    longitude: -61.735,
    activityType: 'aluvion_balsa',
    severity: 'INFO',
    abraeOverlap: 'Zona Amortiguamiento Parque Nacional Canaima',
    indigenousCommunityOverlap: 'Pueblo Indígena Pemón (Kamarakoto)',
  },
  {
    id: 'MIN-003',
    name: 'Boca de Nicare - Río Caura',
    basin: 'Río Caura',
    latitude: 6.012,
    longitude: -64.551,
    activityType: 'aluvion_balsa',
    severity: 'INFO',
    abraeOverlap: 'Parque Nacional Caura',
    indigenousCommunityOverlap: 'Comunidad Ye\'kwana y Sanema',
  },
  {
    id: 'MIN-004',
    name: 'Río Atabapo - Sector Guasare',
    basin: 'Orinoco Fronterizo',
    latitude: 3.991,
    longitude: -67.682,
    activityType: 'monitoreo_radar_sar',
    severity: 'INFO',
    abraeOverlap: 'Monumento Natural Cerro Yuvin',
    indigenousCommunityOverlap: 'Pueblo Curripaco / Baniva',
  },
  {
    id: 'MIN-005',
    name: 'El Callao - Cuenca del Yuruarí',
    basin: 'Cuenca Cuyuní',
    latitude: 7.348,
    longitude: -61.831,
    activityType: 'cielo_abierto',
    severity: 'INFO',
    abraeOverlap: 'Reserva Forestal Imataca',
    indigenousCommunityOverlap: 'Comunidades Kariña',
  }
];

export const INITIAL_PROTECTED_AREAS: ProtectedArea[] = [
  {
    id: 'ABRAE-01',
    name: 'Parque Nacional Yapacana',
    category: 'PARQUE_NACIONAL',
    surfaceHa: 320000,
    ethnicGroup: 'Pueblos Piaroa, Puinave y Curripaco',
    coordinates: [
      [-67.05, 3.55],
      [-66.60, 3.55],
      [-66.60, 4.05],
      [-67.05, 4.05],
      [-67.05, 3.55],
    ],
    color: '#ef4444',
  },
  {
    id: 'ABRAE-02',
    name: 'Parque Nacional Canaima',
    category: 'PARQUE_NACIONAL',
    surfaceHa: 3000000,
    ethnicGroup: 'Pueblo Pemón',
    coordinates: [
      [-63.20, 5.00],
      [-60.80, 5.00],
      [-60.80, 6.40],
      [-63.20, 6.40],
      [-63.20, 5.00],
    ],
    color: '#f59e0b',
  },
  {
    id: 'ABRAE-03',
    name: 'Parque Nacional Caura',
    category: 'PARQUE_NACIONAL',
    surfaceHa: 7534000,
    ethnicGroup: 'Pueblos Ye\'kwana y Sanema',
    coordinates: [
      [-65.50, 4.50],
      [-63.50, 4.50],
      [-63.50, 6.80],
      [-65.50, 6.80],
      [-65.50, 4.50],
    ],
    color: '#10b981',
  },
  {
    id: 'ABRAE-04',
    name: 'Reserva de Biosfera Alto Orinoco - Casiquiare',
    category: 'RESERVA_BIOSFERA',
    surfaceHa: 8266230,
    ethnicGroup: 'Pueblos Yanomami y Ye\'kwana',
    coordinates: [
      [-66.30, 1.20],
      [-64.00, 1.20],
      [-64.00, 3.50],
      [-66.30, 3.50],
      [-66.30, 1.20],
    ],
    color: '#3b82f6',
  },
  {
    id: 'ABRAE-05',
    name: 'Parque Nacional Delta del Orinoco (Mariusa)',
    category: 'PARQUE_NACIONAL',
    surfaceHa: 331000,
    ethnicGroup: 'Pueblo Warao',
    coordinates: [
      [-61.50, 9.20],
      [-60.50, 9.20],
      [-60.50, 9.90],
      [-61.50, 9.90],
      [-61.50, 9.20],
    ],
    color: '#06b6d4',
  },
  {
    id: 'ABRAE-06',
    name: 'Reserva Integral Cuenca del Cuyuní / Esequibo',
    category: 'RESERVA_FORESTAL',
    surfaceHa: 1450000,
    ethnicGroup: 'Comunidades Ancestrales Akawaio y Patamona',
    coordinates: [
      [-60.80, 5.80],
      [-59.20, 5.80],
      [-59.20, 7.20],
      [-60.80, 7.20],
      [-60.80, 5.80],
    ],
    color: '#8b5cf6',
  }
];

export const INITIAL_INCIDENT_REPORTS: IncidentReport[] = [
  {
    id: 'INC-2026-0041',
    code: 'CEN-AMZ-0041',
    title: 'Detección de balsa minera con motor de succión tipo dragona en Río Atabapo',
    category: 'MINERIA_ILEGAL',
    severity: 'CRITICAL',
    status: 'OPERATIVO_EN_CURSO',
    latitude: 3.991,
    longitude: -67.682,
    locationName: 'Río Atabapo - Sector Guasare',
    description: 'Imágenes Sentinel-1 SAR y reporte de observadores comunitarios confirman 3 balsas dragas operando en horario nocturno con vertido directo de sedimentos y mercurio.',
    reportedBy: 'Comando Fluvial de Guardería Ambiental',
    timestamp: '2026-08-31 06:15 UTC',
    assignedUnit: 'Lancha Patrullera Guardacostas LP-32',
    evidenceCount: 4,
  },
  {
    id: 'INC-2026-0040',
    code: 'CEN-BOL-0040',
    title: 'Alerta de turbidez crítica y posible relave en cabeceras del Río Caroní',
    category: 'CONTAMINACION_MERCURIO',
    severity: 'HIGH',
    status: 'EN_VERIFICACION',
    latitude: 4.341,
    longitude: -61.735,
    locationName: 'Río Ikabarú - Gran Sabana',
    description: 'Sensor espectrométrico registra incremento anómalo en NTU (>110) y presencia probable de drenaje ácido de mina.',
    reportedBy: 'Red de Monitoreo Comunitario Indígena',
    timestamp: '2026-08-30 22:40 UTC',
    assignedUnit: 'Unidad de Calidad Ambiental CVG',
    evidenceCount: 2,
  },
  {
    id: 'INC-2026-0039',
    code: 'CEN-AMZ-0039',
    title: 'Apertura de pista clandestina no autorizada en zona selvática del Ventuari',
    category: 'PISTA_CLANDESTINA',
    severity: 'CRITICAL',
    status: 'ACTIVO',
    latitude: 4.882,
    longitude: -65.221,
    locationName: 'Alto Ventuari - Sureste de Manapiare',
    description: 'Análisis de cambio de cobertura forestal detecta franja despejada de 950m de longitud orientada NW-SE.',
    reportedBy: 'Radar Centinela SAR / Satélite',
    timestamp: '2026-08-30 14:10 UTC',
    assignedUnit: 'Destacamento de Vigilancia Aérea',
    evidenceCount: 3,
  },
  {
    id: 'INC-2026-0038',
    code: 'CEN-BOL-0038',
    title: 'Focos de calor simultáneos en sabanas de amortiguamiento de Canaima',
    category: 'DEFORESTACION',
    severity: 'MEDIUM',
    status: 'RESUELTO',
    latitude: 6.321,
    longitude: -63.504,
    locationName: 'La Paragua - Sector San Salvador',
    description: 'Incendio de cobertura vegetal controlado por bomberos forestales e Inparques.',
    reportedBy: 'VIIRS Alerta Térmica',
    timestamp: '2026-08-29 19:30 UTC',
    assignedUnit: 'Bomberos Forestales Inparques',
    evidenceCount: 1,
  }
];

export const MOCK_ORINOCO_BASIN_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'basin-orinoco-main',
      properties: {
        name: 'Macrocuenca Hidrográfica del Río Orinoco',
        officialName: 'Cuenca del Río Orinoco (Venezuela - Colombia)',
        areaKm2: 989000,
        averageDischargeM3s: 36000,
        drainageRatio: '65% Venezuela / 35% Colombia',
        countries: ['Venezuela', 'Colombia'],
        status: 'MONITORING_ACTIVE'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            // Delta del Orinoco / Boca Grande y Caño Manamo
            [-60.400, 8.900],
            [-60.900, 9.400],
            [-61.500, 9.900],
            [-62.000, 10.150],
            // Divisoria Norte: Serranía del Interior / Cordillera de la Costa (Monagas, Anzoátegui, Guárico)
            [-62.800, 10.200],
            [-63.600, 10.100],
            [-64.500, 9.900],
            [-65.400, 9.850],
            [-66.300, 9.800],
            [-67.100, 9.600],
            [-67.800, 9.500],
            // Divisoria Noroccidental: Llanos Altos Centrales y Occidentales (Cojedes, Portuguesa, Barinas)
            [-68.500, 9.400],
            [-69.300, 9.200],
            [-70.000, 9.000],
            [-70.600, 8.800],
            // Cordillera de Mérida y Andes Venezolanos (Nacientes Santo Domingo, Pagüey, Suripá, Caparo)
            [-71.100, 8.600],
            [-71.600, 8.400],
            [-72.100, 8.000],
            [-72.350, 7.500],
            // Cordillera Oriental de Colombia (Cuenca Alta Ríos Arauca, Casanare, Meta)
            [-72.800, 7.100],
            [-73.300, 6.500],
            [-73.800, 5.800],
            [-74.200, 5.100],
            [-74.400, 4.500],
            [-74.500, 3.800],
            // Cabeceras del Río Guaviare (Límite Suroccidental)
            [-74.200, 2.900],
            [-73.600, 2.200],
            [-72.800, 1.800],
            [-71.900, 1.600],
            [-70.800, 1.800],
            [-69.800, 2.200],
            [-68.800, 2.400],
            // Conexión Casiquiare / Sierra Parima
            [-67.800, 2.200],
            [-66.850, 1.230],
            [-66.100, 1.000],
            [-65.300, 1.100],
            [-64.500, 1.500],
            [-63.700, 2.000],
            [-63.300, 2.350],
            // Divisoria Sureste: Serranía de Pacaraima y Cuenca Alta del Caroní
            [-62.800, 3.200],
            [-62.200, 3.800],
            [-61.500, 4.300],
            [-60.750, 5.220],
            // Sierra de Imataca y Escudo Guayanés (Divisoria Caroní/Cuyuní - Delta)
            [-61.200, 6.200],
            [-61.600, 7.100],
            [-61.800, 7.800],
            [-61.500, 8.400],
            // Cierre en el Delta
            [-60.400, 8.900]
          ]
        ]
      }
    }
  ]
};
