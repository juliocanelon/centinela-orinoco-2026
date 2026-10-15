import { CommunityReport } from '../types';

// High-fidelity SVG Data URLs simulating real photographic evidence for offline and test environments
const SVG_PHOTO_DREDGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%231e293b"/><stop offset="100%" stop-color="%23334155"/></linearGradient><linearGradient id="river" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23854d0e"/><stop offset="100%" stop-color="%23713f12"/></linearGradient></defs><rect width="800" height="240" fill="url(%23sky)"/><rect y="240" width="800" height="210" fill="url(%23river)"/><path d="M0,180 Q200,140 400,170 T800,160 L800,240 L0,240 Z" fill="%2314532d"/><rect x="260" y="220" width="280" height="50" rx="6" fill="%23475569"/><rect x="300" y="180" width="200" height="45" fill="%2364748b"/><line x1="330" y1="180" x2="310" y2="120" stroke="%2394a3b8" stroke-width="6"/><circle x1="310" y1="120" r="10" fill="%23ef4444"/><rect x="420" y="160" width="18" height="40" fill="%230f172a"/><path d="M430,160 Q450,130 470,110" stroke="%2364748b" stroke-width="8" stroke-linecap="round" opacity="0.6"/><text x="400" y="320" fill="%23ffffff" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">BALSA MINERA TIPO DRAGONA DETECTADA</text><text x="400" y="350" fill="%23fef08a" font-family="monospace" font-size="13" text-anchor="middle">EVIDENCIA COMUNITARIA - CAURA ALTO</text></svg>`;

const SVG_PHOTO_TURBIDITY = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><defs><linearGradient id="turbidWater" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="%230f172a"/><stop offset="45%" stop-color="%231e293b"/><stop offset="55%" stop-color="%23a16207"/><stop offset="100%" stop-color="%23ca8a04"/></linearGradient></defs><rect width="800" height="450" fill="url(%23turbidWater)"/><path d="M400,0 Q430,225 380,450" stroke="%23facc15" stroke-width="4" stroke-dasharray="8 6" fill="none"/><text x="180" y="80" fill="%2338bdf8" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">AGUAS NEGRAS NATURALES</text><text x="600" y="80" fill="%23fef08a" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">DESCARGA DE SEDIMENTOS Y RELAVES</text><rect x="50" y="340" width="700" height="70" rx="8" fill="rgba(15,23,42,0.85)"/><text x="400" y="375" fill="%23ffffff" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">PLUMA DE TURBIDEZ EXTREMA PROVOCADA POR MONITORES HIDRÁULICOS</text><text x="400" y="398" fill="%2394a3b8" font-family="monospace" font-size="12" text-anchor="middle">CONFLUENCIA RÍO VENTUARI - RÍO MANAPIRE</text></svg>`;

const SVG_PHOTO_DEFORESTATION = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450"><defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23451a03"/><stop offset="100%" stop-color="%2378350f"/></linearGradient></defs><rect width="800" height="150" fill="%2314532d"/><rect y="150" width="800" height="300" fill="url(%23ground)"/><circle cx="200" cy="280" r="40" fill="%23b45309" stroke="%23451a03" stroke-width="6"/><circle cx="360" cy="240" r="30" fill="%23b45309" stroke="%23451a03" stroke-width="5"/><circle cx="540" cy="310" r="50" fill="%23b45309" stroke="%23451a03" stroke-width="7"/><rect x="620" y="200" width="90" height="50" fill="%23eab308" rx="4"/><rect x="640" y="170" width="40" height="30" fill="%23ca8a04"/><circle cx="640" cy="255" r="14" fill="%231e293b"/><circle cx="690" cy="255" r="14" fill="%231e293b"/><rect x="40" y="360" width="720" height="60" rx="8" fill="rgba(15,23,42,0.9)"/><text x="400" y="395" fill="%23f87171" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">DEFORESTACIÓN NO AUTORIZADA Y MAQUINARIA PESADA EN BOSQUE DE GALERÍA</text></svg>`;

export const INITIAL_COMMUNITY_REPORTS: CommunityReport[] = [
  {
    id: 'REP-COM-001',
    code: 'DEN-2026-001',
    title: 'Draga tipo balsa operando en curso del Río Ventuari',
    category: 'MINERIA_ILEGAL',
    severity: 'CRITICAL',
    status: 'CONFIRMADA_EN_TERRENO',
    latitude: 4.1250,
    longitude: -66.5820,
    locationName: 'Alto Ventuari - Sector Caño Oso',
    communityName: 'Comunidad Ye\'kwana de Tencua',
    description: 'Los capitanes indígenas informan sobre la llegada de dos balsas con motor de 12 cilindros extrayendo oro con mercurio. Hay ruido constante en las noches y vertido directo al río.',
    isAnonymous: false,
    reporterName: 'Capitán Comunitario J. Silva',
    reporterContact: 'Radio HF Frecuencia 7.115 MHz / Pueblo Tencua',
    media: [
      {
        id: 'MED-001',
        type: 'image',
        name: 'draga_ventuari_foto1.jpg',
        url: SVG_PHOTO_DREDGE,
        sizeMb: 1.8
      },
      {
        id: 'MED-002',
        type: 'image',
        name: 'turbidez_rio_muestra.jpg',
        url: SVG_PHOTO_TURBIDITY,
        sizeMb: 2.1
      },
      {
        id: 'MED-001-VID',
        type: 'video',
        name: 'video_patrullaje_balsa_ventuari.mp4',
        url: 'data:video/mp4;simulation=tactical_drone',
        sizeMb: 3.4
      }
    ],
    timestamp: '2026-10-12T14:30:00Z',
    verifiedBy: 'Guardería Ambiental Comando Amazonas',
    linkedIncidentId: 'INC-2026-003',
    upvotesCount: 14
  },
  {
    id: 'REP-COM-002',
    code: 'DEN-2026-002',
    title: 'Derrame de combustible diesel cerca de toma de agua de pescadores',
    category: 'DERRAME_HIDROCARBUROS',
    severity: 'HIGH',
    status: 'PENDIENTE_VALIDACION',
    latitude: 7.7420,
    longitude: -65.2150,
    locationName: 'Bajo Caura - Puerto Cabruta / Maripa',
    communityName: 'Asociación de Pescadores Ribereños de Maripa',
    description: 'Se observa una mancha irisada oleosa de más de 400 metros de extensión proveniente de un embarcadero clandestino de tambores de gasoil para campamentos mineros río arriba. Pérdida de peces y olor fuerte a hidrocarburos.',
    isAnonymous: true,
    media: [
      {
        id: 'MED-003',
        type: 'image',
        name: 'mancha_gasoil_rio.jpg',
        url: SVG_PHOTO_TURBIDITY,
        sizeMb: 1.4
      }
    ],
    timestamp: '2026-10-13T09:15:00Z',
    upvotesCount: 8
  },
  {
    id: 'REP-COM-003',
    code: 'DEN-2026-003',
    title: 'Apertura de trocha y deforestación con motosierras en ABRAE Caura',
    category: 'DEFORESTACION',
    severity: 'HIGH',
    status: 'OPERATIVO_ENVIADO',
    latitude: 5.6180,
    longitude: -64.4920,
    locationName: 'Parque Nacional Caura - Sector Salto Pará',
    communityName: 'Comunidad Sanemá de Kanarakuni',
    description: 'Tala masiva de árboles maderables (puy, ceiba y samán) abriendo una pista y trocha hacia el lecho del río. Se calcula más de 12 hectáreas intervenidas sin ningún permiso.',
    isAnonymous: false,
    reporterName: 'Veedores Ambientales Comunitarios Kuwai',
    reporterContact: 'Canal Satelital InReach #22-KWA',
    media: [
      {
        id: 'MED-004',
        type: 'image',
        name: 'deforestacion_trocha.jpg',
        url: SVG_PHOTO_DEFORESTATION,
        sizeMb: 3.2
      }
    ],
    timestamp: '2026-10-11T16:45:00Z',
    verifiedBy: 'Comando Fluvial de Infantería Fluvial',
    linkedIncidentId: 'INC-2026-001',
    upvotesCount: 22
  },
  {
    id: 'REP-COM-004',
    code: 'DEN-2026-004',
    title: 'Uso de cianuro y reactivos químicos en quebrada afluente del Cuyuní',
    category: 'CONTAMINACION_HIDRICA',
    severity: 'CRITICAL',
    status: 'PENDIENTE_VALIDACION',
    latitude: 6.8120,
    longitude: -61.6420,
    locationName: 'Cuenca del Cuyuní - Margen de El Dorado',
    communityName: 'Consejo Comunal Indígena Pemón Kamarata Sur',
    description: 'Mortandad súbita de peces en el caño La Tigra tras lavado de relaves mineros con sustancias químicas desconocidas. Los habitantes reportan irritación en la piel al bañarse.',
    isAnonymous: true,
    media: [
      {
        id: 'MED-005',
        type: 'image',
        name: 'analisis_agua_sedimento.jpg',
        url: SVG_PHOTO_TURBIDITY,
        sizeMb: 1.9
      }
    ],
    timestamp: '2026-10-13T12:05:00Z',
    upvotesCount: 31
  }
];
