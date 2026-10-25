import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  X,
  Layers, 
  Flame, 
  Pickaxe, 
  Droplets, 
  Shield, 
  ShieldAlert,
  AlertTriangle, 
  Maximize2, 
  Play,
  Crosshair, 
  Sparkles, 
  Download, 
  Eye, 
  EyeOff,
  Compass,
  FileSpreadsheet,
  Globe,
  Flag,
  MapPin,
  Waves,
  Building2,
  Navigation,
  Satellite,
  BookOpen,
  Camera,
  Film,
  ChevronDown,
} from 'lucide-react';
import { 
  HeatAnomaly, 
  MiningCluster, 
  HydrologicalStation, 
  ProtectedArea, 
  IncidentReport,
  VisibleLayersState,
  BaseLayerType,
  ScientificArticle,
  CommunityReport,
  CommunityReportMedia,
  ZoneAnalyticsResult,
  S2ProductTile,
  FirmsDensityResponse,
  FirmsDensityCell,
  HotspotPriority
} from '../types';
import { GeospatialLayerToolbar } from './GeospatialLayerToolbar';
import { ZoneAnalyticsModal } from './ZoneAnalyticsModal';
import { MediaLightboxModal } from './MediaLightboxModal';
import { MOCK_ORINOCO_BASIN_GEOJSON } from '../data/mockGeoJSON';
import { VENEZUELA_FULL_BOUNDARY_GEOJSON, VENEZUELA_STRATEGIC_LANDMARKS } from '../data/venezuelaGeoJSON';
import { 
  VENEZUELA_STATES_GEOJSON, 
  VENEZUELA_MUNICIPALITIES_GEOJSON, 
  VENEZUELA_NAMED_RIVERS_GEOJSON, 
  VENEZUELA_STRATEGIC_SECTORS 
} from '../data/venezuelaTerritorialData';
import { SupabaseRpcService } from '../lib/supabaseClient';
import { LivePipelineService } from '../services/liveDataPipelineService';
import { formatLabel } from '../lib/labels';

/** Nubosidad máxima para mostrar una escena Sentinel-2 como útil en el mapa. */
const S2_USEFUL_CLOUD_PCT = 20;

/** A partir de este zoom se muestran los focos individuales en lugar de los hexágonos. */
const HEX_TO_POINTS_ZOOM = 9;
const DENSITY_PERIODS: { days: 1 | 3 | 7; label: string }[] = [
  { days: 1, label: '24 h' },
  { days: 3, label: '3 días' },
  { days: 7, label: '7 días' },
];
/** Color de relleno por nivel de densidad (0 = solo prioridad baja). */
const DENSITY_LEVEL_COLORS = ['#64748b', '#fde047', '#fb923c', '#ef4444', '#991b1b'];
const PRIORITY_COLORS: Record<HotspotPriority, string> = { ALTA: '#dc2626', MEDIA: '#f97316', BAJA: '#facc15' };
const PRIORITY_LABELS: Record<HotspotPriority, string> = { ALTA: 'Alta', MEDIA: 'Media', BAJA: 'Baja' };

interface TacticalMapProps {
  heatAnomalies: HeatAnomaly[];
  miningClusters: MiningCluster[];
  hydrologicalStations: HydrologicalStation[];
  protectedAreas: ProtectedArea[];
  incidents: IncidentReport[];
  communityReports?: CommunityReport[];
  scientificArticles?: ScientificArticle[];
  mapFocusCoords?: {
    lat: number;
    lng: number;
    zoom?: number;
    selectFeature?: {
      type: 'scientific' | 'communityReport';
      data: any;
    };
  } | null;
  onClearMapFocus?: () => void;
  onElevateCommunityReport?: (report: CommunityReport) => void;
  onTriggerAiAnalysis: (context: {
    zoneName: string;
    coordinates: any;
    thermalAnomalies: any;
    miningAlerts: any;
    waterQuality?: any;
    protectedAreaOverlap?: string;
  }) => void;
  onOpenNewIncident: (coords?: { lat: number; lng: number }) => void;
  onOpenAiDrawer?: () => void;
  onOpenSatelliteApis?: () => void;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  heatAnomalies,
  miningClusters,
  hydrologicalStations,
  protectedAreas,
  incidents,
  communityReports = [],
  scientificArticles = [],
  mapFocusCoords = null,
  onClearMapFocus,
  onElevateCommunityReport,
  onTriggerAiAnalysis,
  onOpenNewIncident,
  onOpenAiDrawer,
  onOpenSatelliteApis,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(6);

  const layerGroupsRef = useRef<{
    venezuela?: L.LayerGroup;
    states?: L.LayerGroup;
    municipalities?: L.LayerGroup;
    rivers?: L.LayerGroup;
    sectors?: L.LayerGroup;
    basin?: L.GeoJSON;
    heat?: L.LayerGroup;
    mining?: L.LayerGroup;
    hydro?: L.LayerGroup;
    protected?: L.LayerGroup;
    incidents?: L.LayerGroup;
    communityReports?: L.LayerGroup;
    sentinelS2?: L.LayerGroup;
    firmsWms?: L.LayerGroup;
    scientific?: L.LayerGroup;
    amazonasBolivarDelta?: L.LayerGroup;
    selectionHighlight?: L.LayerGroup;
  }>({});

  // Base tile layers
  const baseTileLayersRef = useRef<{
    dark?: L.TileLayer;
    satellite?: L.TileLayer;
    topo?: L.TileLayer;
  }>({});

  // Active state
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>('satellite');
  const [visibleLayers, setVisibleLayers] = useState<VisibleLayersState>({
    venezuela: true,
    states: false,
    municipalities: true,
    rivers: true,
    sectors: true,
    basin: false,
    protected: true,
    mining: true,
    heat: true,
    hydro: true,
    incidents: true,
    communityReports: true,
    // Escenas Sentinel-2 apagadas por defecto: son cientos de marcadores y tapan los hexágonos.
    sentinelS2: false,
    firmsWms: false,
    scientific: true,
    amazonasBolivarDelta: true,
  });

  const [officialGisData, setOfficialGisData] = useState<any>(null);
  const [loadingOfficialGis, setLoadingOfficialGis] = useState<boolean>(false);

  const handleToggleLayer = (layerKey: keyof VisibleLayersState) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  };

  const [selectedFeature, setSelectedFeature] = useState<{
    type: 'heat' | 'hexDensity' | 'mining' | 'hydro' | 'protected' | 'incident' | 'sentinelS2' | 'scientific' | 'communityReport';
    data: any;
    latlng?: [number, number];
  } | null>(null);

  const [popupScreenPos, setPopupScreenPos] = useState<{
    x: number;
    y: number;
    placement: 'right' | 'left' | 'bottom' | 'top';
  } | null>(null);

  // Helper to extract geographical coordinates from any feature type
  const getFeatureLatLng = (feature: { type: string; data: any; latlng?: [number, number] } | null): [number, number] | null => {
    if (!feature) return null;
    if (feature.latlng && typeof feature.latlng[0] === 'number' && typeof feature.latlng[1] === 'number' && !isNaN(feature.latlng[0]) && !isNaN(feature.latlng[1])) {
      return feature.latlng;
    }
    const d = feature.data;
    if (!d) return null;
    if (typeof d.latitude === 'number' && typeof d.longitude === 'number' && !isNaN(d.latitude) && !isNaN(d.longitude)) {
      return [d.latitude, d.longitude];
    }
    if (typeof d.lat === 'number' && typeof d.lng === 'number' && !isNaN(d.lat) && !isNaN(d.lng)) {
      return [d.lat, d.lng];
    }
    if (Array.isArray(d.center) && d.center.length >= 2 && typeof d.center[0] === 'number' && typeof d.center[1] === 'number' && !isNaN(d.center[0]) && !isNaN(d.center[1])) {
      return [d.center[0], d.center[1]];
    }
    if (Array.isArray(d.coordinates) && d.coordinates.length >= 2) {
      if (typeof d.coordinates[0] === 'number' && typeof d.coordinates[1] === 'number' && !isNaN(d.coordinates[0]) && !isNaN(d.coordinates[1])) {
        if (feature.type === 'hydro') {
          return [d.coordinates[1], d.coordinates[0]];
        }
        return [d.coordinates[0], d.coordinates[1]];
      }
      if (Array.isArray(d.coordinates[0])) {
        let sumLat = 0;
        let sumLng = 0;
        let validPts = 0;
        d.coordinates.forEach((pt: any) => {
          if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number' && !isNaN(pt[0]) && !isNaN(pt[1])) {
            sumLng += pt[0];
            sumLat += pt[1];
            validPts++;
          }
        });
        if (validPts > 0) {
          return [sumLat / validPts, sumLng / validPts];
        }
      }
    }
    return null;
  };

  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<[number, number] | null>(null);

  // Community Reports Media Lightbox state (photos and videos expansion & playback)
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<CommunityReportMedia | null>(null);
  const [lightboxMediaList, setLightboxMediaList] = useState<CommunityReportMedia[]>([]);

  // Zone Predictive & Perceptive Analytics state
  const [hasClickedAnalyze, setHasClickedAnalyze] = useState<boolean>(false);
  const [isZoneAnalyticsModalOpen, setIsZoneAnalyticsModalOpen] = useState<boolean>(false);
  const [zoneAnalyticsResult, setZoneAnalyticsResult] = useState<ZoneAnalyticsResult | null>(null);
  const [isZoneAnalyticsLoading, setIsZoneAnalyticsLoading] = useState<boolean>(false);

  const handleExecuteZonePredictiveAnalytics = async (contextPayload: any) => {
    setHasClickedAnalyze(true);
    setIsZoneAnalyticsLoading(true);
    setIsZoneAnalyticsModalOpen(true);

    try {
      const response = await fetch('/api/ai/zone-predictive-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ZoneAnalyticsResult = await response.json();
      setZoneAnalyticsResult(data);
    } catch (err: any) {
      console.warn('Error al invocar analítica predictiva de zona, intentando ruta alternativa:', err);
      try {
        const fallbackRes = await fetch('/api/ai/analyze-zone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contextPayload),
        });
        const fallbackData = await fallbackRes.json();
        setZoneAnalyticsResult(fallbackData);
      } catch (err2) {
        console.error('Fallo total de analítica:', err2);
      }
    } finally {
      setIsZoneAnalyticsLoading(false);
    }
  };

  // Close the popup/panel when losing focus (clicking/touching outside)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!selectedFeature) return;
      const target = event.target as HTMLElement;
      
      // If the user clicks inside the active panel or modal, ignore
      if (panelRef.current && panelRef.current.contains(target)) {
        return;
      }
      if (target.closest('#analitica-de-la-zona-modal-overlay')) {
        return;
      }
      
      // If the user clicks map markers, tools or AI trigger, ignore so they can click other items
      if (
        target.closest('.custom-mining-icon') ||
        target.closest('.custom-heat-icon') ||
        target.closest('.custom-hydro-icon') ||
        target.closest('.custom-incident-icon') ||
        target.closest('.custom-sentinels2-icon') ||
        target.closest('.custom-scientific-icon') ||
        target.closest('.leaflet-marker-icon') ||
        target.closest('.leaflet-interactive') ||
        target.closest('#btn-ai-analyze-feature') ||
        target.closest('#analitica-de-la-zona')
      ) {
        return;
      }

      // Lose focus: dismiss selected panel
      setSelectedFeature(null);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [selectedFeature]);

  // Dynamic calculation of popup position near the clicked zone/icon
  useEffect(() => {
    if (!selectedFeature || !mapInstanceRef.current) {
      setPopupScreenPos(null);
      return;
    }

    const map = mapInstanceRef.current;
    const coords = getFeatureLatLng(selectedFeature);
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) {
      setPopupScreenPos(null);
      return;
    }

    // Auto-pan if the marker is too close to the borders of the viewport
    if (mapContainerRef.current) {
      try {
        const containerRect = mapContainerRef.current.getBoundingClientRect();
        const pt = map.latLngToContainerPoint(L.latLng(coords[0], coords[1]));
        if (
          pt.x < 120 ||
          pt.x > containerRect.width - 120 ||
          pt.y < 90 ||
          pt.y > containerRect.height - 90
        ) {
          map.panTo(L.latLng(coords[0], coords[1]), { animate: true, duration: 0.35 });
        }
      } catch (e) {
        // Map transform error guard
      }
    }

    const updatePosition = () => {
      if (!map || !mapContainerRef.current) return;
      try {
        const container = mapContainerRef.current;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const currentCoords = getFeatureLatLng(selectedFeature);
        if (!currentCoords || typeof currentCoords[0] !== 'number' || typeof currentCoords[1] !== 'number' || isNaN(currentCoords[0]) || isNaN(currentCoords[1])) return;

        const pt = map.latLngToContainerPoint(L.latLng(currentCoords[0], currentCoords[1]));
        const cardWidth = Math.min(384, rect.width - 24);
        const cardEstimatedHeight = 440;

        // Mobile fallback: position nicely docked at bottom of map view
        if (rect.width < 640) {
          setPopupScreenPos({
            x: Math.max(12, (rect.width - cardWidth) / 2),
            y: Math.max(12, rect.height - Math.min(cardEstimatedHeight, rect.height - 24) - 12),
            placement: 'bottom',
          });
          return;
        }

        let x = pt.x;
        let placement: 'right' | 'left' | 'bottom' | 'top' = 'right';

        // Check horizontal clearance
        if (pt.x + 24 + cardWidth <= rect.width - 16) {
          x = pt.x + 24;
          placement = 'right';
        } else if (pt.x - 24 - cardWidth >= 16) {
          x = pt.x - cardWidth - 24;
          placement = 'left';
        } else {
          x = Math.max(16, Math.min(rect.width - cardWidth - 16, pt.x - cardWidth / 2));
          placement = 'bottom';
        }

        // Vertical positioning: vertically align with clicked point, clamped strictly within map container
        let y = pt.y - 70;
        y = Math.max(12, Math.min(rect.height - cardEstimatedHeight - 12, y));

        setPopupScreenPos({
          x,
          y,
          placement,
        });
      } catch (err) {
        // Map instance might be transitioning
      }
    };

    updatePosition();

    map.on('move', updatePosition);
    map.on('zoom', updatePosition);
    map.on('viewreset', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      map.off('move', updatePosition);
      map.off('zoom', updatePosition);
      map.off('viewreset', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [selectedFeature]);

  // Tactical beacon highlighting for the clicked zone
  useEffect(() => {
    const selGroup = layerGroupsRef.current?.selectionHighlight;
    if (!selGroup) return;
    selGroup.clearLayers();

    if (!selectedFeature) return;

    const coords = getFeatureLatLng(selectedFeature);
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) return;

    // Glowing target marker
    const outerPulse = L.circleMarker([coords[0], coords[1]], {
      radius: 22,
      color: '#38bdf8',
      weight: 2,
      fillColor: '#0284c7',
      fillOpacity: 0.18,
      dashArray: '4, 4',
    });

    const innerCenter = L.circleMarker([coords[0], coords[1]], {
      radius: 4.5,
      color: '#ffffff',
      weight: 1.5,
      fillColor: '#38bdf8',
      fillOpacity: 0.95,
    });

    selGroup.addLayer(outerPulse);
    selGroup.addLayer(innerCenter);
  }, [selectedFeature]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered on Venezuela and the Orinoco Basin
    const map = L.map(mapContainerRef.current, {
      center: [6.5, -64.8],
      zoom: 6,
      minZoom: 4,
      maxZoom: 17,
      zoomControl: false,
    });

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Tile providers: High-performance, 100% Free & No API Key Required
    const satelliteTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and GIS User Community',
        maxZoom: 18,
      }
    );

    // Esri Dark Gray Canvas - Military Tactical Dark GIS, No API Key, No Watermarks
    const darkTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community',
        maxZoom: 16,
      }
    );

    const topoTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN',
        maxZoom: 17,
      }
    );

    baseTileLayersRef.current = {
      satellite: satelliteTile,
      dark: darkTile,
      topo: topoTile,
    };

    // Default layer: Satellite
    satelliteTile.addTo(map);

    // Initialize layer groups
    layerGroupsRef.current = {
      venezuela: L.layerGroup().addTo(map),
      states: L.layerGroup().addTo(map),
      municipalities: L.layerGroup().addTo(map),
      rivers: L.layerGroup().addTo(map),
      sectors: L.layerGroup().addTo(map),
      heat: L.layerGroup().addTo(map),
      mining: L.layerGroup().addTo(map),
      hydro: L.layerGroup().addTo(map),
      protected: L.layerGroup().addTo(map),
      incidents: L.layerGroup().addTo(map),
      communityReports: L.layerGroup().addTo(map),
      sentinelS2: L.layerGroup().addTo(map),
      firmsWms: L.layerGroup().addTo(map),
      scientific: L.layerGroup().addTo(map),
      amazonasBolivarDelta: L.layerGroup().addTo(map),
      selectionHighlight: L.layerGroup().addTo(map),
    };

    // Add Basin boundary GeoJSON (Accurate Hydrological Boundary - Zero Fill)
    const basinLayer = L.geoJSON(MOCK_ORINOCO_BASIN_GEOJSON as any, {
      style: {
        color: '#0284c7',
        weight: 2.2,
        dashArray: '5, 5',
        fill: false,
        fillOpacity: 0,
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(
          `<b>💧 ${feature.properties.name}</b><br/><span style="font-size: 11px;">Área: ${feature.properties.areaKm2.toLocaleString()} km² • Descarga: ${feature.properties.averageDischargeM3s.toLocaleString()} m³/s</span><br/><span style="font-size: 10px; color: #7dd3fc;">Venezuela (65%) | Colombia (35%)</span>`,
          { sticky: true, className: 'tactical-tooltip' }
        );
      }
    }).addTo(map);
    layerGroupsRef.current.basin = basinLayer;

    // Track zoom level changes for dynamic territorial labeling
    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    // Handle map click for selection mode or recording incidents
    map.on('click', (e: L.LeafletMouseEvent) => {
      setSelectedCoordinates([e.latlng.lat, e.latlng.lng]);
    });

    mapInstanceRef.current = map;

    // ResizeObserver to prevent layout glitch inside containers
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle external focus triggers (e.g. from Scientific Corpus Page "Ver en mapa")
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapFocusCoords) return;

    // Guard against invalid coordinates to prevent Leaflet LatLng crash
    if (
      typeof mapFocusCoords.lat !== 'number' ||
      typeof mapFocusCoords.lng !== 'number' ||
      isNaN(mapFocusCoords.lat) ||
      isNaN(mapFocusCoords.lng)
    ) {
      if (onClearMapFocus) onClearMapFocus();
      return;
    }

    // 1. Force the relevant layer to be visible
    if (mapFocusCoords.selectFeature?.type === 'scientific' && !visibleLayers.scientific) {
      setVisibleLayers(prev => ({ ...prev, scientific: true }));
    }
    if (mapFocusCoords.selectFeature?.type === 'communityReport' && !visibleLayers.communityReports) {
      setVisibleLayers(prev => ({ ...prev, communityReports: true }));
    }

    // 2. Center/Fly map to location
    map.flyTo([mapFocusCoords.lat, mapFocusCoords.lng], mapFocusCoords.zoom || 9, { duration: 1.2 });

    // 3. Auto-select/highlight the feature to open the inspection drawer
    if (mapFocusCoords.selectFeature) {
      setSelectedFeature(mapFocusCoords.selectFeature as any);
    }

    // 4. Clear the trigger in parent state so it doesn't loop
    if (onClearMapFocus) {
      onClearMapFocus();
    }
  }, [mapFocusCoords, onClearMapFocus, visibleLayers.scientific, visibleLayers.communityReports]);

  // Update Base Layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(baseTileLayersRef.current).forEach((layer) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    const targetLayer = baseTileLayersRef.current[activeBaseLayer];
    if (targetLayer) {
      targetLayer.addTo(map);
    }
  }, [activeBaseLayer]);

  // Render Venezuela Sovereignty and Border Landmarks (Beacons) - No badly drawn partial silhouette lines
  useEffect(() => {
    const group = layerGroupsRef.current.venezuela;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.venezuela) return;

    // Add Sovereignty and Border Landmarks (White Beacon Nodes)
    VENEZUELA_STRATEGIC_LANDMARKS.forEach((landmark) => {
      const landmarkIcon = L.divIcon({
        className: 'custom-sovereignty-icon',
        html: `
          <div class="relative flex items-center justify-center w-5 h-5">
            <span class="absolute w-5 h-5 rounded-full bg-white/40 animate-ping"></span>
            <div class="w-3 h-3 rounded-full bg-white border border-slate-950 shadow-[0_0_10px_rgba(255,255,255,1)] flex items-center justify-center">
              <div class="w-1 h-1 rounded-full bg-sky-600"></div>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([landmark.lat, landmark.lng], { icon: landmarkIcon });
      marker.bindTooltip(
        `<b>Unidad de Soberanía: ${landmark.name}</b><br/><span style="font-size: 10px; font-family: monospace; color: #7dd3fc;">[${landmark.lat.toFixed(3)}°N, ${landmark.lng.toFixed(3)}°W]</span>`,
        { direction: 'top', className: 'tactical-tooltip' }
      );
      group.addLayer(marker);
    });
  }, [visibleLayers.venezuela]);

  // Render State Internal Boundaries (High-Precision Tenuous White Lines)
  useEffect(() => {
    const group = layerGroupsRef.current.states;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.states) return;

    const sourceData = officialGisData || VENEZUELA_STATES_GEOJSON;

    // Calculate dynamic weight and opacity based on zoom level to ensure high-visibility and crispness
    const dynamicWeight = Math.max(2.0, Math.min(3.2, 2.0 + (currentZoom - 5) * 0.25));
    const dynamicOpacity = Math.max(0.80, Math.min(0.95, 0.80 + (currentZoom - 5) * 0.03));

    // High-contrast black halo backing line to ensure white borders stand out vividly over any map base
    const stateShadowLayer = L.geoJSON(sourceData as any, {
      style: {
        color: '#000000',
        weight: dynamicWeight + 1.8,
        opacity: 0.45,
        fill: false,
        fillOpacity: 0,
      },
      interactive: false,
    });
    group.addLayer(stateShadowLayer);

    // Highly visible, crisp solid white boundary line (continuous)
    const statesLayer = L.geoJSON(sourceData as any, {
      style: {
        color: '#ffffff',
        weight: dynamicWeight,
        opacity: dynamicOpacity,
        fill: false,
        fillOpacity: 0,
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.shapeName || feature.properties?.nombre || 'Estado';
        layer.bindTooltip(
          `<b>Estado ${name}</b><br/><span style="font-size: 10px; color: #cbd5e1;">Límite Político-Territorial Oficial</span>`,
          { sticky: true, className: 'tactical-tooltip' }
        );
      }
    });
    group.addLayer(statesLayer);

    // State Labels rendered dynamically at appropriate zoom levels (zoom >= 5)
    if (currentZoom >= 5 && currentZoom <= 10) {
      const STATE_CENTROIDS: Record<string, [number, number]> = {
        'Amazonas': [3.10, -65.80],
        'Bolívar': [6.30, -63.40],
        'Delta Amacuro': [8.70, -61.20],
        'Anzoátegui': [9.00, -64.40],
        'Monagas': [9.50, -63.15],
        'Apure': [7.10, -68.80],
        'Guárico': [8.90, -66.40],
        'Sucre': [10.40, -63.20],
        'Guayana Esequiba': [5.20, -59.35],
      };

      sourceData.features.forEach((state: any) => {
        const name = state.properties?.shapeName || state.properties?.nombre;
        const coords = (name && STATE_CENTROIDS[name]) || state.properties?.centroid;
        if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) return;

        const isEsequiba = name && name.toLowerCase().includes('esequib');
        const labelIcon = L.divIcon({
          className: 'state-map-label',
          html: `<span>${isEsequiba ? 'Guayana Esequiba' : name}</span>`,
          iconSize: isEsequiba ? [160, 22] : [120, 20],
          iconAnchor: isEsequiba ? [80, 11] : [60, 10],
        });

        const labelMarker = L.marker([coords[0], coords[1]], { 
          icon: labelIcon, 
          interactive: false,
          zIndexOffset: 100 
        });
        group.addLayer(labelMarker);
      });
    }
  }, [visibleLayers.states, currentZoom, officialGisData]);

  // Load official GeoJSON table immediately on mount or when boundary layers are requested
  useEffect(() => {
    if (!officialGisData && !loadingOfficialGis) {
      setLoadingOfficialGis(true);

      // Primary source: /venezuela_estados.geojson (full 26 official states GeoJSON table including Guayana Esequiba)
      fetch('/venezuela_estados.geojson')
        .then((res) => {
          if (!res.ok) throw new Error('Local GeoJSON fallback');
          return res.json();
        })
        .then((data) => {
          setOfficialGisData(data);
          setLoadingOfficialGis(false);
          console.log('[Centinela GIS] Tabla GeoJSON de límites de Venezuela cargada con éxito:', data.features?.length, 'estados');
        })
        .catch((err) => {
          console.warn('[Centinela GIS] Fallo local, consultando API /api/limites:', err);
          fetch('/api/limites')
            .then((r) => r.json())
            .then((data) => {
              setOfficialGisData(data);
              setLoadingOfficialGis(false);
            })
            .catch((apiErr) => {
              console.warn('[Centinela GIS] Usando respaldo territorial:', apiErr);
              setOfficialGisData(VENEZUELA_STATES_GEOJSON);
              setLoadingOfficialGis(false);
            });
        });
    }
  }, [officialGisData, loadingOfficialGis]);

  // Render authentic state borders and internal delimitation lines from GeoJSON table
  useEffect(() => {
    const group = layerGroupsRef.current.amazonasBolivarDelta;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.amazonasBolivarDelta) return;

    // Use fetched official high-precision dataset if available, otherwise fallback to local dataset
    const sourceData = officialGisData || VENEZUELA_STATES_GEOJSON;

    // Draw authentic boundary lines from the GeoJSON table
    const backingLayer = L.geoJSON(sourceData as any, {
      style: {
        color: '#000000',
        weight: 3.5,
        opacity: 0.40,
        fill: false,
        fillOpacity: 0,
        className: 'non-scaling-stroke'
      },
      interactive: false,
    });
    group.addLayer(backingLayer);

    // Highly visible, crisp solid white boundary line (static weight of 1.5px, 100% opacity, non-scaling-stroke)
    const boundariesLayer = L.geoJSON(sourceData as any, {
      style: {
        color: '#ffffff',
        weight: 1.5,
        opacity: 1.0,
        fill: false,
        fillOpacity: 0,
        className: 'non-scaling-stroke'
      },
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.shapeName || feature.properties?.nombre || feature.properties?.NAME_1 || 'Estado';
        const isEsequiba = name.toLowerCase().includes('esequib');
        layer.bindTooltip(
          `<b>${isEsequiba ? 'Estado Guayana Esequiba' : `Estado: ${name}`}</b><br/><span style="font-size: 10px; color: #cbd5e1;">${isEsequiba ? 'Límite Histórico Soberano (Acuerdo de Ginebra de 1966)' : 'Límite Geodésico Oficial (Fronteras Internas)'}</span>`,
          { sticky: true, className: 'tactical-tooltip' }
        );
      }
    });
    group.addLayer(boundariesLayer);

    // State Name Labels directly on the map matching the design reference
    const STATE_CENTROIDS: Record<string, [number, number]> = {
      'Amazonas': [3.10, -65.80],
      'Bolívar': [6.30, -63.40],
      'Delta Amacuro': [8.70, -61.20],
      'Anzoátegui': [9.00, -64.40],
      'Monagas': [9.50, -63.15],
      'Apure': [7.10, -68.80],
      'Guárico': [8.90, -66.40],
      'Sucre': [10.40, -63.20],
      'Guayana Esequiba': [5.20, -59.35]
    };

    // Render labels for the regional states and any state with defined coordinates
    Object.entries(STATE_CENTROIDS).forEach(([stateName, coords]) => {
      const isEsequiba = stateName.toLowerCase().includes('esequib');
      const labelIcon = L.divIcon({
        className: 'state-map-label',
        html: `<span>${stateName}</span>`,
        iconSize: isEsequiba ? [160, 24] : [140, 24],
        iconAnchor: isEsequiba ? [80, 12] : [70, 12]
      });

      const marker = L.marker(coords, {
        icon: labelIcon,
        interactive: false,
        zIndexOffset: 300
      });
      group.addLayer(marker);
    });
  }, [visibleLayers.amazonasBolivarDelta, officialGisData]);

  // Render Municipality Boundaries and Labels (zoom >= 7)
  useEffect(() => {
    const group = layerGroupsRef.current.municipalities;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.municipalities) return;

    // Municipal boundaries render when zoom >= 7 for high clarity
    if (currentZoom >= 7) {
      const muniLayer = L.geoJSON(VENEZUELA_MUNICIPALITIES_GEOJSON as any, {
        style: {
          color: '#cbd5e1',
          weight: 0.9,
          opacity: 0.4,
          dashArray: '2, 3',
          fillOpacity: 0,
        },
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(
            `<b>Municipio ${feature.properties.shapeName}</b><br/><span style="font-size: 10px; color: #94a3b8;">Jurisdicción Municipal ADM2</span>`,
            { sticky: true, className: 'tactical-tooltip' }
          );
        }
      });
      group.addLayer(muniLayer);

      // Municipality name tags rendered at closer zoom (zoom >= 8)
      if (currentZoom >= 8) {
        VENEZUELA_MUNICIPALITIES_GEOJSON.features.forEach((muni) => {
          const centroid = muni.properties.centroid;
          if (!centroid || typeof centroid[0] !== 'number' || typeof centroid[1] !== 'number' || isNaN(centroid[0]) || isNaN(centroid[1])) return;

          const labelIcon = L.divIcon({
            className: 'muni-map-label',
            html: `<span>${muni.properties.shapeName}</span>`,
            iconSize: [100, 16],
            iconAnchor: [50, 8],
          });

          const labelMarker = L.marker([centroid[0], centroid[1]], {
            icon: labelIcon,
            interactive: false,
            zIndexOffset: 50,
          });
          group.addLayer(labelMarker);
        });
      }
    }
  }, [visibleLayers.municipalities, currentZoom]);

  // Render Named River Networks & Fluvial Labels
  useEffect(() => {
    const group = layerGroupsRef.current.rivers;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.rivers) return;

    // Draw main river centerlines
    const riversLayer = L.geoJSON(VENEZUELA_NAMED_RIVERS_GEOJSON as any, {
      style: (feature) => {
        const isMain = feature?.properties?.name === 'Río Orinoco';
        return {
          color: '#38bdf8',
          weight: isMain ? 3.5 : 2.2,
          opacity: 0.85,
        };
      },
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(
          `<b>🌊 ${feature.properties.name}</b><br/><span style="font-size: 11px; color: #bae6fd;">Longitud: ${feature.properties.lengthKm} km</span><br/><span style="font-size: 10px; color: #94a3b8;">${feature.properties.description}</span>`,
          { sticky: true, className: 'tactical-tooltip' }
        );
      }
    });
    group.addLayer(riversLayer);

    // River name labels at midpoint of each river path (zoom >= 6)
    if (currentZoom >= 6) {
      VENEZUELA_NAMED_RIVERS_GEOJSON.features.forEach((river) => {
        const coords = river.geometry.coordinates;
        if (!coords || coords.length === 0) return;
        const midIdx = Math.floor(coords.length / 2);
        const midPt = coords[midIdx]; // [lng, lat]
        if (!midPt || typeof midPt[0] !== 'number' || typeof midPt[1] !== 'number' || isNaN(midPt[0]) || isNaN(midPt[1])) return;

        const labelIcon = L.divIcon({
          className: 'river-map-label',
          html: `<span><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>${river.properties.name}</span>`,
          iconSize: [120, 20],
          iconAnchor: [60, 10],
        });

        const labelMarker = L.marker([midPt[1], midPt[0]], {
          icon: labelIcon,
          interactive: false,
          zIndexOffset: 120,
        });
        group.addLayer(labelMarker);
      });
    }
  }, [visibleLayers.rivers, currentZoom]);

  // Render Strategic Sectors & Poblados (zoom >= 7)
  useEffect(() => {
    const group = layerGroupsRef.current.sectors;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.sectors) return;

    if (currentZoom >= 7) {
      VENEZUELA_STRATEGIC_SECTORS.forEach((sec) => {
        if (typeof sec.lat !== 'number' || typeof sec.lng !== 'number' || isNaN(sec.lat) || isNaN(sec.lng)) return;
        const sectorIcon = L.divIcon({
          className: 'sector-map-label',
          html: `<span><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${sec.name}</span>`,
          iconSize: [130, 20],
          iconAnchor: [65, 10],
        });

        const marker = L.marker([sec.lat, sec.lng], { icon: sectorIcon, zIndexOffset: 90 });
        marker.bindTooltip(
          `<b>📍 ${sec.name}</b><br/>Estado: ${sec.state}<br/>Municipio: ${sec.municipality}<br/><span style="font-size: 10px; color: #94a3b8;">${sec.strategicImportance}</span>`,
          { direction: 'top', className: 'tactical-tooltip' }
        );
        group.addLayer(marker);
      });
    }
  }, [visibleLayers.sectors, currentZoom]);

  // Render Basin Boundary
  useEffect(() => {
    const basin = layerGroupsRef.current.basin;
    const map = mapInstanceRef.current;
    if (!basin || !map) return;

    if (visibleLayers.basin) {
      if (!map.hasLayer(basin)) {
        basin.addTo(map);
      }
    } else {
      if (map.hasLayer(basin)) {
        map.removeLayer(basin);
      }
    }
  }, [visibleLayers.basin]);

  // Render Protected Areas
  useEffect(() => {
    const group = layerGroupsRef.current.protected;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.protected) return;

    protectedAreas.forEach((area) => {
      const latlngs = (area.coordinates || [])
        .filter((c) => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number' && !isNaN(c[0]) && !isNaN(c[1]))
        .map((c) => [c[1], c[0]] as [number, number]);
      if (latlngs.length < 3) return;

      const polygon = L.polygon(latlngs, {
        color: area.color,
        weight: 2,
        fillColor: area.color,
        fillOpacity: 0.18,
      });

      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ type: 'protected', data: area, latlng: [e.latlng.lat, e.latlng.lng] });
        setSelectedCoordinates([e.latlng.lat, e.latlng.lng]);
      });

      polygon.bindTooltip(`<b>${area.name}</b><br/><span style="font-size: 11px;">${area.category} • polígono aproximado</span>`, {
        sticky: true,
        className: 'tactical-tooltip',
      });

      group.addLayer(polygon);
    });
  }, [protectedAreas, visibleLayers.protected]);

  // Render Mining Clusters
  useEffect(() => {
    const group = layerGroupsRef.current.mining;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.mining) return;

    miningClusters.forEach((cluster) => {
      if (typeof cluster.latitude !== 'number' || typeof cluster.longitude !== 'number' || isNaN(cluster.latitude) || isNaN(cluster.longitude)) return;
      const isCritical = cluster.severity === 'CRITICAL';
      
      const customIcon = L.divIcon({
        className: 'custom-mining-icon',
        html: `
          <div class="relative flex items-center justify-center w-7 h-7">
            <span class="absolute w-7 h-7 rounded-full ${isCritical ? 'bg-red-600/50 pulse-critical' : 'bg-amber-600/50'}"></span>
            <div class="w-5 h-5 rounded-full bg-slate-900 border-2 ${isCritical ? 'border-red-500 text-red-400' : 'border-amber-500 text-amber-400'} flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"/><path d="M15 13 9 7l4-4 6 6-4 4Z"/><path d="m21.5 2.5-1.9 1.9"/></svg>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([cluster.latitude, cluster.longitude], { icon: customIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ type: 'mining', data: cluster, latlng: [cluster.latitude, cluster.longitude] });
        setSelectedCoordinates([cluster.latitude, cluster.longitude]);
      });

      marker.bindTooltip(cluster.affectedAreaHa === undefined
        ? `<b>${cluster.name}</b><br/>Zona de vigilancia (referencia)`
        : `<b>${cluster.name}</b><br/>Perturbación SAR medida: ${cluster.affectedAreaHa} ha`, {
        direction: 'top',
        className: 'tactical-tooltip',
      });

      group.addLayer(marker);
    });
  }, [miningClusters, visibleLayers.mining]);

  // Densidad de focos NASA FIRMS (hexágonos de 25 km) para el periodo elegido
  const [densityDays, setDensityDays] = useState<1 | 3 | 7>(7);
  const [density, setDensity] = useState<FirmsDensityResponse | null>(null);
  const [densityError, setDensityError] = useState<string | null>(null);
  const [showLowPriority, setShowLowPriority] = useState<boolean>(false);
  // En móvil la leyenda de focos arranca plegada para no tapar el mapa
  const [isFirmsPanelOpen, setIsFirmsPanelOpen] = useState<boolean>(() => window.innerWidth >= 640);

  useEffect(() => {
    setDensityError(null);
    LivePipelineService.getFirmsDensity(densityDays)
      .then(setDensity)
      .catch((err) => setDensityError(err?.message || String(err)));
  }, [densityDays]);

  const showHotspotPoints = currentZoom >= HEX_TO_POINTS_ZOOM;

  // Render focos: hexágonos con zoom alejado, puntos por prioridad al acercar
  useEffect(() => {
    const group = layerGroupsRef.current.heat;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.heat || !density) return;

    if (!showHotspotPoints) {
      density.cells.forEach((cell) => {
        if (cell.level === 0 && !showLowPriority) return;
        const fill = DENSITY_LEVEL_COLORS[cell.level];
        const hasHigh = cell.byPriority.ALTA > 0;
        const polygon = L.polygon(cell.polygon, {
          color: hasHigh ? '#fecaca' : fill,
          weight: hasHigh ? 2.5 : 1,
          fillColor: fill,
          fillOpacity: cell.level === 0 ? 0.25 : 0.55,
        });
        polygon.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedFeature({ type: 'hexDensity', data: cell, latlng: cell.center });
          setSelectedCoordinates(cell.center);
        });
        polygon.bindTooltip(
          `<b>${cell.relevant} focos prioritarios</b> de ${cell.total}<br/>${cell.relevantPer1000Km2} por 1.000 km² · ${cell.states.join(', ')}`,
          { sticky: true, className: 'tactical-tooltip' }
        );
        group.addLayer(polygon);

        const shown = cell.relevant > 0 ? cell.relevant : cell.total;
        group.addLayer(L.marker(cell.center, {
          interactive: false,
          icon: L.divIcon({
            className: 'hex-count-label',
            html: `<div style="font: 700 11px/1 ui-monospace,monospace; color: #fff; text-shadow: 0 0 3px #000, 0 0 3px #000; text-align: center;">${shown}</div>`,
            iconSize: [30, 14],
            iconAnchor: [15, 7],
          }),
        }));
      });
      return;
    }

    density.cells.forEach((cell) => {
      cell.hotspots.forEach((h) => {
        if (h.priority === 'BAJA' && !showLowPriority) return;
        const color = PRIORITY_COLORS[h.priority];
        const marker = L.circleMarker([h.latitude, h.longitude], {
          radius: h.priority === 'BAJA' ? 4 : 6,
          color: h.persistent ? '#ffffff' : color,
          weight: h.persistent ? 2 : 1,
          fillColor: color,
          fillOpacity: 0.85,
        });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedFeature({
            type: 'heat',
            data: {
              id: h.id, satellite: h.satellite, latitude: h.latitude, longitude: h.longitude, brightnessTempK: null,
              frpMw: h.frpMw, confidence: h.confidence, acqDate: h.acqDate, acqTime: h.acqTime, dayNight: '',
              sector: `Foco ${h.satellite}`, subBasin: h.state, priority: h.priority, persistent: h.persistent,
            },
            latlng: [h.latitude, h.longitude],
          });
          setSelectedCoordinates([h.latitude, h.longitude]);
        });
        marker.bindTooltip(
          `<b>Prioridad ${PRIORITY_LABELS[h.priority]}</b>${h.persistent ? ' · persistente' : ''}<br/>${h.satellite} · ${h.acqDate} ${h.acqTime}<br/>FRP: ${h.frpMw ?? 's/d'} MW · ${h.confidence}`,
          { direction: 'top', className: 'tactical-tooltip' }
        );
        group.addLayer(marker);
      });
    });
  }, [density, visibleLayers.heat, showHotspotPoints, showLowPriority]);

  // Render Hydrological Stations
  useEffect(() => {
    const group = layerGroupsRef.current.hydro;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.hydro) return;

    hydrologicalStations.forEach((station) => {
      if (!Array.isArray(station.coordinates) || typeof station.coordinates[0] !== 'number' || typeof station.coordinates[1] !== 'number' || isNaN(station.coordinates[0]) || isNaN(station.coordinates[1])) return;
      const isAlert = station.status === 'ALERT_CRECIDA' || station.status === 'ELEVATED';
      
      const customIcon = L.divIcon({
        className: 'custom-hydro-icon',
        html: `
          <div class="relative flex items-center justify-center w-7 h-7">
            <div class="w-5 h-5 rounded-full ${isAlert ? 'bg-sky-500 border-2 border-amber-400 text-white' : 'bg-slate-900 border-2 border-sky-400 text-sky-300'} flex items-center justify-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([station.coordinates[1], station.coordinates[0]], { icon: customIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ type: 'hydro', data: station, latlng: [station.coordinates[1], station.coordinates[0]] });
        setSelectedCoordinates([station.coordinates[1], station.coordinates[0]]);
      });

      marker.bindTooltip(`<b>${station.name}</b><br/>Nivel: ${station.currentLevelM ?? 's/d'} msnm (${station.readingDate ?? 'sin fecha'})${station.isStale ? ' • boletín desactualizado' : ''}<br/>Cota de desborde: ${station.overflowLevelM ?? 'no publicada'}`, {
        direction: 'top',
        className: 'tactical-tooltip',
      });

      group.addLayer(marker);
    });
  }, [hydrologicalStations, visibleLayers.hydro]);

  // Render Scientific Investigation Sites (Corpus)
  useEffect(() => {
    const group = layerGroupsRef.current.scientific;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.scientific) return;

    scientificArticles.forEach((article) => {
      if (!article.investigationSites) return;

      article.investigationSites.forEach((site) => {
        if (typeof site.latitude !== 'number' || typeof site.longitude !== 'number' || isNaN(site.latitude) || isNaN(site.longitude)) return;
        // Cadaster icons representing the land plot/scientific findings
        const customIcon = L.divIcon({
          className: 'custom-scientific-icon',
          html: `
            <div class="relative flex items-center justify-center w-8 h-8">
              <span class="absolute w-8 h-8 rounded-lg bg-teal-500/25 pulse-scientific border border-teal-400/40"></span>
              <div class="w-6 h-6 rounded bg-slate-950 border border-teal-400 text-teal-300 flex items-center justify-center shadow-md text-xs font-mono font-bold">
                ⛯
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([site.latitude, site.longitude], { icon: customIcon });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedFeature({
            type: 'scientific',
            data: {
              ...site,
              articleId: article.id,
              articleTitle: article.title,
              authors: article.authors,
              year: article.year,
              source: article.source,
              peerReviewed: article.peerReviewed,
              tags: article.tags,
              abstract: article.abstract
            },
            latlng: [site.latitude, site.longitude]
          });
          setSelectedCoordinates([site.latitude, site.longitude]);
        });

        marker.bindTooltip(`<b>${site.name}</b><br/>📚 ${article.title.slice(0, 45)}...<br/><span style="font-size: 10px; color: #2dd4bf;">Cadastro Científico • Georreferenciado</span>`, {
          direction: 'top',
          className: 'tactical-tooltip',
        });

        group.addLayer(marker);
      });
    });
  }, [scientificArticles, visibleLayers.scientific]);

  // Render Incidents
  useEffect(() => {
    const group = layerGroupsRef.current.incidents;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.incidents) return;

    incidents.forEach((inc) => {
      if (typeof inc.latitude !== 'number' || typeof inc.longitude !== 'number' || isNaN(inc.latitude) || isNaN(inc.longitude)) return;
      const customIcon = L.divIcon({
        className: 'custom-incident-icon',
        html: `
          <div class="relative flex items-center justify-center w-7 h-7">
            <span class="absolute w-7 h-7 rounded-full bg-red-500/40 pulse-critical"></span>
            <div class="w-5 h-5 rounded-full bg-red-700 border-2 border-white text-white flex items-center justify-center shadow-lg font-bold text-[10px]">
              !
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([inc.latitude, inc.longitude], { icon: customIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ type: 'incident', data: inc, latlng: [inc.latitude, inc.longitude] });
        setSelectedCoordinates([inc.latitude, inc.longitude]);
      });

      marker.bindTooltip(`<b>${inc.code}: ${inc.title}</b><br/>Estado: ${formatLabel(inc.status)}`, {
        direction: 'top',
        className: 'tactical-tooltip',
      });

      group.addLayer(marker);
    });
  }, [incidents, visibleLayers.incidents]);

  // Render Community Reports Layer (Veeduría Ciudadana / Indígena)
  useEffect(() => {
    const group = layerGroupsRef.current.communityReports;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.communityReports) return;

    communityReports.forEach((rep) => {
      if (typeof rep.latitude !== 'number' || typeof rep.longitude !== 'number' || isNaN(rep.latitude) || isNaN(rep.longitude)) return;
      
      const isCritical = rep.severity === 'CRITICAL' || rep.severity === 'HIGH';
      const customIcon = L.divIcon({
        className: 'custom-community-report-icon',
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <span class="absolute w-8 h-8 rounded-full ${isCritical ? 'bg-violet-500/40 pulse-community' : 'bg-indigo-500/20'}"></span>
            <div class="w-6 h-6 rounded-full bg-[#1e1b4b] border-2 border-violet-400 text-violet-300 flex items-center justify-center shadow-lg font-bold text-[11px]">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([rep.latitude, rep.longitude], { icon: customIcon });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ type: 'communityReport', data: rep, latlng: [rep.latitude, rep.longitude] });
        setSelectedCoordinates([rep.latitude, rep.longitude]);
      });

      marker.bindTooltip(`<b>${rep.code}: ${rep.title}</b><br/>👤 ${rep.communityName || 'Veeduría Territorial'}<br/><span style="font-size: 10px; color: #a78bfa;">Estado: ${formatLabel(rep.status)}</span>`, {
        direction: 'top',
        className: 'tactical-tooltip',
      });

      group.addLayer(marker);
    });
  }, [communityReports, visibleLayers.communityReports]);

  // Escenas Sentinel-2 L2A reales con poca nubosidad (catálogo STAC ingerido en Supabase)
  const [s2Scenes, setS2Scenes] = useState<S2ProductTile[]>([]);
  useEffect(() => {
    LivePipelineService.getS2ProductTiles(S2_USEFUL_CLOUD_PCT)
      .then(setS2Scenes)
      .catch((err) => console.warn('No se pudieron cargar las escenas Sentinel-2:', err));
  }, []);

  useEffect(() => {
    const group = layerGroupsRef.current.sentinelS2;
    if (!group) return;
    group.clearLayers();

    if (!visibleLayers.sentinelS2) return;

    s2Scenes.forEach((scene) => {
      if (scene.centerLat == null || scene.centerLon == null) return;
      const center: [number, number] = [scene.centerLat, scene.centerLon];
      const data = { ...scene, center, title: `${scene.tileId} · ${scene.satelliteCode}` };

      const customIcon = L.divIcon({
        className: 'custom-sentinels2-icon',
        html: `
          <div class="relative flex items-center justify-center w-6 h-6">
            <div class="w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center shadow-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker(center, { icon: customIcon });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedFeature({ type: 'sentinelS2', data, latlng: center });
        setSelectedCoordinates(center);
      });
      marker.bindTooltip(`<b>Sentinel-2 ${scene.tileId}</b><br/>${scene.sensingTime.slice(0, 10)} • nubes ${scene.cloudPixelPct ?? 's/d'}%`, {
        direction: 'top',
        className: 'tactical-tooltip',
      });
      group.addLayer(marker);
    });
  }, [visibleLayers.sentinelS2, s2Scenes]);

  // Capa WMS pública de NASA GIBS: focos térmicos VIIRS 375 m (composición más reciente).
  // Se usa el servicio EPSG:3857 de GIBS porque el mapa Leaflet trabaja en Web Mercator.
  useEffect(() => {
    const group = layerGroupsRef.current.firmsWms;
    if (!group) return;
    group.clearLayers();
    if (!visibleLayers.firmsWms) return;
    group.addLayer(
      L.tileLayer.wms('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi', {
        layers: 'VIIRS_NOAA20_Thermal_Anomalies_375m_All',
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        attribution: 'NASA GIBS / FIRMS',
        opacity: 0.9,
      })
    );
  }, [visibleLayers.firmsWms]);

  // Fly to Macrocuenca view
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([5.8, -65.2], 6, { duration: 1.2 });
    }
  };

  // Fly to Full Venezuela & Guayana Esequiba view
  const handleFocusVenezuela = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([6.5, -64.8], 6, { duration: 1.2 });
    }
  };

  // Fly to feature location
  const handleFlyTo = (lat: number, lng: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 10, { duration: 1 });
    }
  };

  // Export current active view to GeoJSON file
  const handleExportGeoJSON = () => {
    const featureCollection = {
      type: 'FeatureCollection',
      features: [
        ...miningClusters.map((m) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
          properties: { ...m, featureClass: 'MINING_CLUSTER' },
        })),
        ...heatAnomalies.map((h) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [h.longitude, h.latitude] },
          properties: { ...h, featureClass: 'HEAT_ANOMALY' },
        })),
        ...hydrologicalStations.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.coordinates[0], s.coordinates[1]] },
          properties: { ...s, featureClass: 'HYDRO_STATION' },
        })),
        ...incidents.map((i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [i.longitude, i.latitude] },
          properties: { ...i, featureClass: 'TACTICAL_INCIDENT' },
        })),
      ],
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `centinela_orinoco_gis_${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-canvas">
      {/* Horizontal Geospatial Layers & Filter Toolbar (Eligible, with counts, beside actions) */}
      <GeospatialLayerToolbar
        visibleLayers={visibleLayers}
        onToggleLayer={handleToggleLayer}
        activeBaseLayer={activeBaseLayer}
        onChangeBaseLayer={setActiveBaseLayer}
        miningCount={miningClusters.length}
        heatCount={density?.totals.hotspots ?? heatAnomalies.length}
        hydroCount={hydrologicalStations.length}
        protectedCount={protectedAreas.length}
        incidentsCount={incidents.length}
        communityReportsCount={communityReports.length}
        sentinelS2Count={s2Scenes.length}
        scientificCount={scientificArticles.reduce((acc, curr) => acc + (curr.investigationSites?.length || 0), 0)}
        onFocusVenezuela={handleFocusVenezuela}
        onExportGeoJSON={handleExportGeoJSON}
        onOpenSatelliteApis={onOpenSatelliteApis}
      />

      {/* Map Container & Anchored Overlay Area */}
      <div className="relative w-full flex-1 overflow-hidden">
        <div 
          ref={mapContainerRef} 
          id="tactical-leaflet-map" 
          className="w-full h-full z-0 cursor-crosshair relative"
        />

        {/* Anchored Selected Feature Inspection Window (Positioned near clicked zone/icon) */}
        {selectedFeature && (
          <div 
            ref={panelRef}
            style={
              popupScreenPos
                ? {
                    left: `${popupScreenPos.x}px`,
                    top: `${popupScreenPos.y}px`,
                    width: 'min(384px, calc(100% - 24px))',
                    maxHeight: 'calc(100% - 24px)',
                  }
                : {
                    right: '16px',
                    top: '16px',
                    width: 'min(384px, calc(100% - 24px))',
                    maxHeight: 'calc(100% - 24px)',
                  }
            }
            className="absolute flex flex-col bg-surface/95 backdrop-blur-md border border-slate-700/90 rounded-2xl shadow-2xl shadow-black/90 text-slate-200 z-30 transition-all duration-100 ease-out overflow-hidden"
          >
            {/* Sticky Header: Never scrolls off */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/90 bg-slate-950/70 shrink-0">
              <div className="flex items-center gap-2">
                {selectedFeature.type === 'mining' && <Pickaxe className="w-4 h-4 text-red-400" />}
                {selectedFeature.type === 'heat' && <Flame className="w-4 h-4 text-amber-400" />}
                {selectedFeature.type === 'hexDensity' && <Flame className="w-4 h-4 text-orange-400" />}
                {selectedFeature.type === 'hydro' && <Droplets className="w-4 h-4 text-sky-400" />}
                {selectedFeature.type === 'protected' && <Shield className="w-4 h-4 text-emerald-400" />}
                {selectedFeature.type === 'incident' && <AlertTriangle className="w-4 h-4 text-purple-400" />}
                {selectedFeature.type === 'sentinelS2' && <Satellite className="w-4 h-4 text-emerald-400" />}
                {selectedFeature.type === 'scientific' && <BookOpen className="w-4 h-4 text-teal-400" />}
                <span className="text-xs font-bold text-slate-100">
                  {selectedFeature.type === 'mining' && 'Cluster de Minería Ilegal'}
                  {selectedFeature.type === 'heat' && 'Foco de Calor NASA FIRMS'}
                  {selectedFeature.type === 'hexDensity' && 'Densidad de Focos · Celda de 25 km'}
                  {selectedFeature.type === 'hydro' && 'Estación Hidrométrica'}
                  {selectedFeature.type === 'protected' && 'Área Protegida / ABRAE'}
                  {selectedFeature.type === 'incident' && 'Reporte de Incidente'}
                  {selectedFeature.type === 'sentinelS2' && 'Análisis Satelital Sentinel-2'}
                  {selectedFeature.type === 'scientific' && 'Registro Corpus Científico'}
                </span>
              </div>
              <button
                onClick={() => setSelectedFeature(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/50 transition-all flex items-center justify-center"
                title="Cerrar panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable Content: Shows full info cleanly without clipping */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs scrollbar-thin scrollbar-thumb-slate-700">
              {/* Target Location Indicator */}
              {(() => {
                const coords = getFeatureLatLng(selectedFeature);
                if (!coords) return null;
                return (
                  <div className="flex items-center justify-between bg-canvas px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400">
                    <span className="flex items-center gap-1 text-sky-400 font-semibold">
                      <Crosshair className="w-3 h-3 text-sky-400" />
                      Ubicación Geográfica
                    </span>
                    <span className="text-slate-300">
                      {coords[0].toFixed(4)}°N, {coords[1].toFixed(4)}°W
                    </span>
                  </div>
                );
              })()}
            {/* Mining Cluster Details */}
            {selectedFeature.type === 'mining' && (
              <>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedFeature.data.name}</h3>
                  <p className="text-slate-400 text-[11px]">{selectedFeature.data.basin}</p>
                </div>

                {selectedFeature.data.affectedAreaHa === undefined ? (
                  <p className="text-[11px] text-slate-300 bg-canvas p-2.5 rounded-lg border border-slate-800">
                    Zona de vigilancia de referencia (sector minero conocido). No tiene mediciones propias: consulte los focos FIRMS cercanos o las perturbaciones SAR medidas (Nivel 2).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400">Área afectada (SAR)</span>
                      <p className="text-sm font-bold text-red-400 font-mono">{selectedFeature.data.affectedAreaHa} ha</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Retrodispersión</span>
                      <p className="text-sm font-bold text-amber-400 font-mono">{selectedFeature.data.backscatterDiffDb ?? 's/d'} dB</p>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 text-[11px]">
                  <p className="text-slate-300">
                    <span className="text-slate-500">Traslape ABRAE:</span> {selectedFeature.data.abraeOverlap || 'Ninguno'}
                  </p>
                  <p className="text-slate-300">
                    <span className="text-slate-500">Pueblo Indígena:</span> {selectedFeature.data.indigenousCommunityOverlap || 'Ninguno'}
                  </p>
                  <p className="text-slate-400 font-mono text-[10px]">
                    Coords: {selectedFeature.data.latitude.toFixed(4)}°N, {selectedFeature.data.longitude.toFixed(4)}°W
                  </p>
                </div>
              </>
            )}

            {/* Hexagon Density Details */}
            {selectedFeature.type === 'hexDensity' && (() => {
              const cell = selectedFeature.data as FirmsDensityCell;
              const maxDay = Math.max(1, ...cell.perDay.map((d) => d.total));
              return (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-white">{cell.states.join(' / ')}</h3>
                    <p className="text-slate-400 text-[11px]">
                      Celda {cell.id} · {cell.areaKm2.toLocaleString('es-VE')} km² · últimos {density?.days === 1 ? '24 h' : `${density?.days} días`}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800 text-center">
                    {(['ALTA', 'MEDIA', 'BAJA'] as HotspotPriority[]).map((p) => (
                      <div key={p}>
                        <span className="text-[10px] text-slate-400">{PRIORITY_LABELS[p]}</span>
                        <p className="text-base font-bold font-mono" style={{ color: PRIORITY_COLORS[p] }}>{cell.byPriority[p]}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400">Prioritarios / 1.000 km²</span>
                      <p className="text-sm font-bold text-orange-400 font-mono">{cell.relevantPer1000Km2}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">FRP máximo</span>
                      <p className="text-sm font-bold text-amber-400 font-mono">{cell.maxFrpMw === null ? 's/d' : `${cell.maxFrpMw.toFixed(1)} MW`}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Total de focos</span>
                      <p className="text-xs font-mono text-slate-200">{cell.total} ({cell.highConfidence} confianza alta)</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Puntos persistentes</span>
                      <p className="text-xs font-mono text-slate-200">{cell.persistentPoints.length}</p>
                    </div>
                  </div>

                  <div className="bg-canvas p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400">Focos por día (naranja = prioritarios)</span>
                    <div className="flex items-end gap-1 h-16 mt-2">
                      {cell.perDay.map((d) => (
                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.date}: ${d.total} focos, ${d.relevant} prioritarios`}>
                          <div className="w-full bg-slate-600 rounded-t relative" style={{ height: `${(d.total / maxDay) * 100}%` }}>
                            <div className="absolute bottom-0 left-0 right-0 bg-orange-500 rounded-t" style={{ height: `${d.total ? (d.relevant / d.total) * 100 : 0}%` }} />
                          </div>
                          <span className="text-[8px] text-slate-500 font-mono mt-1">{d.date.slice(8)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {cell.persistentPoints.length > 0 && (
                    <div className="text-[11px] text-slate-300 space-y-0.5">
                      <span className="text-[10px] text-slate-400 block">Fuego repetido en el mismo punto (~1 km)</span>
                      {cell.persistentPoints.slice(0, 4).map((p) => (
                        <p key={`${p.latitude}|${p.longitude}`} className="font-mono">{p.latitude.toFixed(2)}°, {p.longitude.toFixed(2)}° · {p.days} días</p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 text-[11px] text-slate-300">
                    {cell.nearestReference && (
                      <p>
                        <span className="text-slate-500">{cell.nearestReference.kind === 'AREA_PROTEGIDA' ? 'Área protegida' : 'Zona minera'}:</span>{' '}
                        {cell.nearestReference.name} {cell.nearestReference.inside ? '(dentro, polígono aproximado)' : `(a ${cell.nearestReference.distanceKm} km)`}
                      </p>
                    )}
                    {cell.nearestStation && (
                      <p>
                        <span className="text-slate-500">Estación INAMEH:</span> {cell.nearestStation.name} (a {cell.nearestStation.distanceKm} km) ·{' '}
                        {cell.nearestStation.levelMsnm ?? 's/d'} msnm {cell.nearestStation.isStale ? '(desactualizado)' : ''}
                      </p>
                    )}
                    <p>
                      <span className="text-slate-500">Sentinel-2 útil:</span>{' '}
                      {cell.latestUsefulS2 ? (
                        <a href={cell.latestUsefulS2.stacItemUrl || '#'} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                          {cell.latestUsefulS2.tileId} · {cell.latestUsefulS2.sensingTime.slice(0, 10)} · {cell.latestUsefulS2.cloudPixelPct}% nubes
                        </a>
                      ) : 'sin escena con menos de 20% de nubes en el catálogo reciente'}
                    </p>
                  </div>

                  <button
                    onClick={() => mapInstanceRef.current?.setView(cell.center, HEX_TO_POINTS_ZOOM + 1, { animate: true })}
                    className="w-full py-1.5 text-xs font-semibold rounded-lg bg-orange-600/80 hover:bg-orange-500 text-white"
                  >
                    Ver focos de esta celda
                  </button>
                </>
              );
            })()}

            {/* Heat Anomaly Details */}
            {selectedFeature.type === 'heat' && (
              <>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedFeature.data.id} - {selectedFeature.data.sector}</h3>
                  <p className="text-slate-400 text-[11px]">Estado: {selectedFeature.data.subBasin}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400">Temp. Brillo</span>
                    <p className="text-sm font-bold text-amber-400 font-mono">{selectedFeature.data.brightnessTempK ?? 's/d'} K</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Potencia FRP</span>
                    <p className="text-sm font-bold text-orange-400 font-mono">{selectedFeature.data.frpMw ?? 's/d'} MW</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Satélite</span>
                    <p className="text-xs font-mono text-slate-300">{selectedFeature.data.satellite}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Confianza</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] border border-emerald-800">
                      {selectedFeature.data.confidence}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  Adquisición: {selectedFeature.data.acqDate} {selectedFeature.data.acqTime}
                </div>
                {selectedFeature.data.priority && (
                  <p className="text-[11px] text-slate-300">
                    Prioridad <strong style={{ color: PRIORITY_COLORS[selectedFeature.data.priority as HotspotPriority] }}>{PRIORITY_LABELS[selectedFeature.data.priority as HotspotPriority]}</strong>
                    {selectedFeature.data.persistent ? ' · fuego repetido en el mismo punto en 2 o más días' : ''}
                  </p>
                )}
              </>
            )}

            {/* Hydrological Station Details */}
            {selectedFeature.type === 'hydro' && (
              <>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedFeature.data.name}</h3>
                  <p className="text-slate-400 text-[11px]">{selectedFeature.data.river}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400">Nivel (msnm)</span>
                    <p className="text-sm font-bold text-sky-400 font-mono">{selectedFeature.data.currentLevelM ?? 's/d'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Cota de desborde</span>
                    <p className="text-sm font-bold text-amber-400 font-mono">{selectedFeature.data.overflowLevelM ?? 'No publicada'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Variación diaria</span>
                    <p className="text-xs font-bold text-slate-300 font-mono">
                      {selectedFeature.data.dailyChangeM == null ? 's/d' : `${selectedFeature.data.dailyChangeM > 0 ? '+' : ''}${selectedFeature.data.dailyChangeM} m`}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Boletín</span>
                    <p className={`text-xs font-bold font-mono ${selectedFeature.data.isStale ? 'text-amber-400' : 'text-slate-300'}`}>
                      {selectedFeature.data.readingDate ?? 'sin fecha'}{selectedFeature.data.isStale ? ' (desactualizado)' : ''}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Fuente: boletín INAMEH. Calidad del agua no medida (requiere muestreo de campo).
                </p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Estado de Estación:</span>
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-sky-950 text-sky-300 border border-sky-800">
                    {formatLabel(selectedFeature.data.status)}
                  </span>
                </div>
              </>
            )}

            {/* Protected Area Details */}
            {selectedFeature.type === 'protected' && (
              <>
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedFeature.data.name}</h3>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-mono border border-emerald-800">
                    {formatLabel(selectedFeature.data.category)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400">Superficie</span>
                    <p className="text-sm font-bold text-emerald-400 font-mono">
                      {selectedFeature.data.surfaceHa.toLocaleString()} ha
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Geometría</span>
                    <p className="text-xs text-slate-300">Polígono aproximado</p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300">
                  <span className="text-slate-500">Poblaciones:</span> {selectedFeature.data.ethnicGroup}
                </p>
              </>
            )}

             {/* Incident Details */}
            {selectedFeature.type === 'incident' && (
              <>
                <div>
                  <span className="px-1.5 py-0.5 rounded bg-red-950 text-red-300 text-[10px] font-mono border border-red-800">
                    {selectedFeature.data.code}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1">{selectedFeature.data.title}</h3>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed bg-canvas p-2 rounded border border-slate-800">
                  {selectedFeature.data.description}
                </p>

                <div className="space-y-1 text-[11px]">
                  <p className="text-slate-400">Unidad asignada: <span className="text-slate-200">{selectedFeature.data.assignedUnit || 'En despacho'}</span></p>
                  <p className="text-slate-400">Reportado por: <span className="text-slate-200">{selectedFeature.data.reportedBy}</span></p>
                  <p className="text-slate-500 font-mono text-[10px]">{selectedFeature.data.timestamp}</p>
                </div>
              </>
            )}

            {/* Sentinel-2 Details */}
            {selectedFeature.type === 'sentinelS2' && (
              <>
                <div>
                  <h3 className="text-sm font-bold text-white leading-snug">Escena Sentinel-2 L2A · {selectedFeature.data.tileId}</h3>
                  <p className="text-emerald-400 font-medium text-[11px] mt-0.5">{selectedFeature.data.satelliteCode}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-canvas p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400">Adquisición (UTC)</span>
                    <p className="text-xs font-bold text-emerald-400 font-mono">{selectedFeature.data.sensingTime.slice(0, 16).replace('T', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Nubosidad</span>
                    <p className="text-sm font-bold text-amber-400 font-mono">{selectedFeature.data.cloudPixelPct ?? 's/d'}%</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Órbita relativa</span>
                    <p className="text-xs font-mono text-slate-300">{selectedFeature.data.relativeOrbit ?? 's/d'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400">Cuadrante MGRS</span>
                    <p className="text-xs font-mono text-slate-300">{selectedFeature.data.tileId}</p>
                  </div>
                </div>

                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Imagen disponible para inspección. La detección de pérdida de bosque o turbidez requiere procesar sus bandas (Nivel 2).
                </p>
                {selectedFeature.data.stacItemUrl && (
                  <a href={selectedFeature.data.stacItemUrl} target="_blank" rel="noreferrer" className="text-[11px] text-sky-400 hover:text-sky-300 underline">
                    Ver metadatos en el catálogo STAC de Copernicus
                  </a>
                )}
              </>
            )}

            {/* Scientific Details */}
            {selectedFeature.type === 'scientific' && (
              <>
                <div>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 text-[10px] border border-teal-800 font-bold">
                      📚 Corpus Científico
                    </span>
                    {selectedFeature.data.peerReviewed ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] border border-emerald-800 font-bold">
                        Arbitrado / Indexado
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] border border-amber-800 font-bold">
                        No Arbitrado / No Indexado
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 leading-snug">{selectedFeature.data.name}</h3>
                  <p className="text-slate-400 text-[10px] italic mt-0.5">{selectedFeature.data.authors} ({selectedFeature.data.year})</p>
                </div>

                <div className="bg-canvas p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-teal-400 font-bold">Hallazgos Clave del Estudio:</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed italic">
                    "{selectedFeature.data.findings}"
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-canvas p-2 rounded-lg border border-slate-800/80 font-mono text-[10px]">
                  <div className="col-span-2">
                    <span className="text-slate-500">Estudio:</span>
                    <p className="text-slate-200 font-bold truncate" title={selectedFeature.data.articleTitle}>{selectedFeature.data.articleTitle}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Cuenca Principal:</span>
                    <p className="text-slate-200 font-bold">{selectedFeature.data.primaryBasin || 'Amazonas / Bolívar'}</p>
                  </div>
                  {selectedFeature.data.heavyMetalsPpm !== undefined && (
                    <div>
                      <span className="text-slate-500">Mercurio (Hg):</span>
                      <p className="text-rose-400 font-bold">{selectedFeature.data.heavyMetalsPpm} ppm</p>
                    </div>
                  )}
                  {selectedFeature.data.turbidityNtu !== undefined && (
                    <div>
                      <span className="text-slate-500">Turbidez:</span>
                      <p className="text-amber-400 font-bold">{selectedFeature.data.turbidityNtu} NTU</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Community Report Details */}
            {selectedFeature.type === 'communityReport' && (
              <>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 text-[10px] border border-violet-800 font-bold">
                      👥 Veeduría Comunitaria
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] font-mono border border-slate-700">
                      {selectedFeature.data.code}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap border ${
                      selectedFeature.data.severity === 'CRITICAL' ? 'bg-red-950 text-red-300 border-red-800' :
                      selectedFeature.data.severity === 'HIGH' ? 'bg-orange-950 text-orange-300 border-orange-800' :
                      'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {formatLabel(selectedFeature.data.severity)}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 text-[10px] font-mono border border-sky-800">
                      {formatLabel(selectedFeature.data.status)}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1 leading-snug">{selectedFeature.data.title}</h3>
                  <p className="text-sky-300 text-[11px] mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    <span>{selectedFeature.data.locationName}</span>
                  </p>
                  {selectedFeature.data.communityName && (
                    <p className="text-amber-300/90 text-[10px] mt-0.5 font-medium">
                      Comunidad / Asentamiento: {selectedFeature.data.communityName}
                    </p>
                  )}
                </div>

                <div className="bg-canvas p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[10px] text-violet-400 font-bold">Relato de la Comunidad:</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {selectedFeature.data.description}
                  </p>
                </div>

                {/* Evidence photos / videos preview */}
                {selectedFeature.data.media && selectedFeature.data.media.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" />
                        Evidencias Multimedia ({selectedFeature.data.media.length}):
                      </span>
                      <span className="text-[10px] text-sky-400/90 font-mono">
                        Clic para expandir ↗
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {selectedFeature.data.media.map((med: any) => (
                        <button
                          key={med.id}
                          type="button"
                          onClick={() => {
                            setActiveLightboxMedia(med);
                            setLightboxMediaList(selectedFeature.data.media);
                          }}
                          className="group relative h-24 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 hover:border-sky-400 hover:ring-2 hover:ring-sky-500/40 transition-all text-left flex flex-col justify-between shadow-md cursor-pointer"
                          title={med.type === 'video' ? `Reproducir video: ${med.name}` : `Expandir foto: ${med.name}`}
                        >
                          {med.type === 'video' ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-sky-400 group-hover:from-slate-900 group-hover:to-slate-800 transition-colors relative">
                              <div className="w-9 h-9 rounded-full bg-sky-950/90 border border-sky-400/80 flex items-center justify-center text-sky-300 shadow-lg group-hover:scale-110 transition-transform mb-1">
                                <Play className="w-4 h-4 ml-0.5" />
                              </div>
                              <span className="text-[10px] text-sky-300 font-bold">
                                Reproducir
                              </span>
                              <div className="absolute top-1 right-1 px-1 py-0.5 rounded bg-black/70 text-[8px] font-mono text-sky-300 border border-sky-900">
                                VIDEO
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-full relative overflow-hidden bg-slate-950">
                              <img 
                                src={med.url} 
                                alt={med.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                              <div className="absolute top-1 right-1 p-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          )}

                          {/* Footer thumbnail bar */}
                          <div className="p-1 bg-slate-950/95 border-t border-slate-800 text-[10px] font-mono text-slate-300 truncate w-full flex items-center justify-between">
                            <span className="truncate">{med.name}</span>
                            <span className="text-sky-400 text-[8px] font-bold shrink-0 ml-1">
                              {med.type === 'video' ? 'VER ▶' : 'EXPANDIR'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2 bg-canvas rounded-lg border border-slate-800/80 text-[10px] text-slate-400 font-mono">
                  {selectedFeature.data.isAnonymous ? '🔒 Denuncia Anónima Protegida' : `Vocero: ${selectedFeature.data.reporterName || 'Comunidad'} ${selectedFeature.data.reporterContact ? `(${selectedFeature.data.reporterContact})` : ''}`}
                </div>
              </>
            )}

            </div>

            {/* Sticky Action Footer: always visible and accessible */}
            <div className="p-3 border-t border-slate-800/90 bg-slate-950/70 shrink-0 flex items-center gap-2">
              <button
                id="analitica-de-la-zona"
                data-testid="analitica-de-la-zona"
                name="Analítica de la Zona"
                onClick={() => {
                  const f = selectedFeature;
                  if (!f) return;
                  setHasClickedAnalyze(true);
                  
                  let coords = { lat: 5.0, lng: -65.0 };
                  let zoneName = '';
                  let overlap = '';
                  let generatingEvent: any = null;

                  if (f.type === 'mining') {
                    coords = { lat: f.data.latitude, lng: f.data.longitude };
                    zoneName = f.data.name;
                    overlap = f.data.abraeOverlap || f.data.basin;
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'MINING_CLUSTER',
                      typeLabel: f.data.affectedAreaHa === undefined ? 'Zona de vigilancia minera (referencia)' : 'Perturbación SAR medida',
                      title: f.data.name,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: f.data.affectedAreaHa === undefined ? 'Referencia cartográfica (sin medición propia)' : 'Copernicus Sentinel-1 SAR',
                      severity: f.data.severity,
                      description: f.data.affectedAreaHa === undefined
                        ? `Zona de vigilancia "${f.data.name}" (cuenca ${f.data.basin}). Sector minero conocido; no contiene mediciones propias.`
                        : `Perturbación SAR medida en "${f.data.name}": ${f.data.affectedAreaHa} ha, retrodispersión ${f.data.backscatterDiffDb ?? 's/d'} dB.`,
                      details: f.data,
                    };
                  } else if (f.type === 'scientific') {
                    coords = { lat: f.data.latitude, lng: f.data.longitude };
                    zoneName = f.data.name;
                    overlap = f.data.ethnicTerritory || 'Cuenca del Orinoco - Área de Investigación Científica';
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'SCIENTIFIC_STUDY',
                      typeLabel: 'Sitio de Estudio del Corpus Científico',
                      title: f.data.articleTitle || f.data.name,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: 'Corpus Científico Cuenca del Orinoco (PostGIS + pgvector)',
                      severity: 'ALTO',
                      description: `Estudio "${f.data.articleTitle || f.data.name}" (${f.data.authors || 'Investigador'}, ${f.data.year || 2026}). Hallazgos: ${f.data.findings || 'Evaluación ecotoxicológica e hidroquímica'}.`,
                      details: f.data,
                    };
                  } else if (f.type === 'hexDensity') {
                    coords = { lat: f.data.center[0], lng: f.data.center[1] };
                    zoneName = `Celda de 25 km en ${f.data.states.join(' / ')}`;
                    overlap = f.data.nearestReference?.inside ? f.data.nearestReference.name : '';
                    const satCoords = `${coords.lat.toFixed(5)}°, ${coords.lng.toFixed(5)}° (WGS-84)`;
                    generatingEvent = {
                      type: 'THERMAL_ANOMALY',
                      typeLabel: 'Densidad de focos NASA FIRMS (hexágono de 25 km)',
                      title: zoneName,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: 'NASA FIRMS (VIIRS / MODIS)',
                      severity: f.data.byPriority.ALTA > 0 ? 'HIGH' : 'MEDIUM',
                      description: `${f.data.total} focos (${f.data.byPriority.ALTA} prioridad alta, ${f.data.byPriority.MEDIA} media) en ${f.data.areaKm2} km²; ${f.data.persistentPoints.length} puntos persistentes; FRP máximo ${f.data.maxFrpMw ?? 's/d'} MW.`,
                      details: { id: f.data.id, byPriority: f.data.byPriority, perDay: f.data.perDay },
                    };
                  } else if (f.type === 'heat') {
                    coords = { lat: f.data.latitude, lng: f.data.longitude };
                    zoneName = f.data.sector;
                    overlap = f.data.subBasin;
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'THERMAL_ANOMALY',
                      typeLabel: 'Foco Térmico Satelital (NASA FIRMS)',
                      title: f.data.sector,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: `NASA FIRMS (${f.data.satellite})`,
                      severity: f.data.confidence === 'high' ? 'HIGH' : 'MEDIUM',
                      description: `Foco de calor detectado el ${f.data.acqDate} ${f.data.acqTime} en el estado ${f.data.subBasin}. Temp. de brillo: ${f.data.brightnessTempK ?? 's/d'} K, FRP: ${f.data.frpMw ?? 's/d'} MW, confianza: ${f.data.confidence}.`,
                      details: f.data,
                    };
                  } else if (f.type === 'hydro') {
                    coords = { lat: f.data.coordinates[1], lng: f.data.coordinates[0] };
                    zoneName = f.data.name;
                    overlap = f.data.river;
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'HYDRO_ALERT',
                      typeLabel: 'Estación hidrométrica INAMEH',
                      title: f.data.name,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: 'Boletín diario INAMEH (regla limnimétrica)',
                      severity: f.data.status,
                      description: `Estación ${f.data.id} en el ${f.data.river}. Nivel: ${f.data.currentLevelM ?? 's/d'} msnm el ${f.data.readingDate ?? 's/f'}${f.data.isStale ? ' (boletín desactualizado)' : ''}. Cota de desborde: ${f.data.overflowLevelM ?? 'no publicada'}.`,
                      details: f.data,
                    };
                  } else if (f.type === 'protected') {
                    const featCoords = getFeatureLatLng(f);
                    coords = featCoords ? { lat: featCoords[0], lng: featCoords[1] } : { lat: 5.0, lng: -65.0 };
                    zoneName = f.data.name;
                    overlap = f.data.name;
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'PROTECTED_AREA',
                      typeLabel: 'Área Natural Protegida (ABRAE)',
                      title: f.data.name,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: 'Cartografía Oficial Instituto Geográfico Simón Bolívar / INPARQUES',
                      severity: 'REGIMEN_ESTRICTO',
                      description: `${f.data.name} (${f.data.designation || 'Área Bajo Régimen de Administración Especial'}). Superficie: ${f.data.surfaceHa?.toLocaleString() || 'N/A'} ha (polígono aproximado).`,
                      details: f.data,
                    };
                  } else if (f.type === 'incident') {
                    coords = { lat: f.data.latitude, lng: f.data.longitude };
                    zoneName = f.data.locationName;
                    overlap = f.data.title;
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'INCIDENT',
                      typeLabel: 'Incidente Táctico / Minuta Operacional',
                      title: f.data.title,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: 'Minuta de Campo Guardería Ambiental / KoboToolbox / DGCIM',
                      severity: f.data.severity || 'CRITICAL',
                      description: `${f.data.title} en ${f.data.locationName}. Categoría: ${f.data.category}. Estado: ${f.data.status}. ${f.data.description || ''}`,
                      details: f.data,
                    };
                  } else if (f.type === 'sentinelS2') {
                    coords = { lat: f.data.center[0], lng: f.data.center[1] };
                    zoneName = f.data.title;
                    overlap = '';
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'SENTINEL2_DETECTION',
                      typeLabel: 'Escena Sentinel-2 L2A disponible',
                      title: f.data.title,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: `Copernicus Sentinel-2 MSI (${f.data.satelliteCode})`,
                      severity: 'INFO',
                      description: `Escena ${f.data.productId} del ${f.data.sensingTime.slice(0, 10)} con ${f.data.cloudPixelPct ?? 's/d'}% de nubes sobre el cuadrante ${f.data.tileId}.`,
                      details: f.data,
                    };
                  } else if (f.type === 'communityReport') {
                    coords = { lat: f.data.latitude, lng: f.data.longitude };
                    zoneName = f.data.locationName;
                    overlap = f.data.communityName || 'Territorio de Veeduría Comunitaria';
                    const satCoords = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;
                    generatingEvent = {
                      type: 'INCIDENT',
                      typeLabel: 'Veeduría Ambiental Comunitaria',
                      title: f.data.title,
                      coordinates: coords,
                      satelliteCoordinates: satCoords,
                      satelliteSensor: 'Veeduría Ciudadana e Indígena en Terreno (GPS + Multimedia)',
                      severity: f.data.severity || 'HIGH',
                      description: `Denuncia comunitaria ${f.data.code} en ${f.data.locationName}. Categoría: ${f.data.category}. Relato: ${f.data.description}`,
                      details: f.data,
                    };
                  }

                  const formattedGpsZone = `${coords.lat >= 0 ? coords.lat.toFixed(5) + '° N' : Math.abs(coords.lat).toFixed(5) + '° S'}, ${coords.lng >= 0 ? coords.lng.toFixed(5) + '° E' : Math.abs(coords.lng).toFixed(5) + '° W'} (Datum WGS-84 / SIRGAS-REGVEN)`;

                  const contextPayload = {
                    zoneName: zoneName || 'Sector Táctico Identificado',
                    coordinates: coords,
                    generatingEvent: generatingEvent || {
                      type: 'EVENTO_CARTOGRAFICO',
                      typeLabel: 'Evento Cartográfico Táctico',
                      title: zoneName || 'Evento Detectado',
                      coordinates: coords,
                      satelliteCoordinates: formattedGpsZone,
                      satelliteSensor: 'Constelación Satelital Híbrida (VIIRS / Sentinel-1 / Sentinel-2 / Red In Situ)',
                      severity: 'ALERTA_ACTIVA',
                      description: 'Detección en cartografía táctica geoespacial',
                    },
                    satelliteCoordinates: formattedGpsZone,
                    satelliteLocation: {
                      latitude: coords.lat,
                      longitude: coords.lng,
                      formatted: formattedGpsZone,
                      geohashOrSector: zoneName,
                    },
                    thermalAnomalies: heatAnomalies.filter((h) => Math.abs(h.latitude - coords.lat) < 1.5 && Math.abs(h.longitude - coords.lng) < 1.5),
                    miningAlerts: miningClusters.filter((m) => Math.abs(m.latitude - coords.lat) < 1.5 && Math.abs(m.longitude - coords.lng) < 1.5),
                    waterQuality: f.type === 'hydro' ? {
                      levelMsnm: f.data.currentLevelM,
                      overflowLevelMsnm: f.data.overflowLevelM,
                      readingDate: f.data.readingDate,
                      status: f.data.status,
                    } : f.type === 'scientific' ? {
                      turbidity: f.data.turbidityNtu || 0,
                      mercuryPpm: f.data.heavyMetalsPpm || 0,
                      studyFindings: f.data.findings,
                      studyAuthors: f.data.authors,
                      studyTitle: f.data.articleTitle,
                      peerReviewed: f.data.peerReviewed,
                    } : undefined,
                    protectedAreaOverlap: overlap,
                    featureData: f.data,
                    featureType: f.type,
                  };

                  setSelectedFeature(null);
                  onTriggerAiAnalysis(contextPayload);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-sky-950/50 transition-all border border-sky-400/30 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-sky-200 animate-pulse" />
                <span className="font-semibold tracking-wide">Analítica de la Zona</span>
              </button>

              {/* Quick Operational Elevation for Community Reports */}
              {selectedFeature.type === 'communityReport' && onElevateCommunityReport && selectedFeature.data.status !== 'OPERATIVO_ENVIADO' && (
                <button
                  type="button"
                  onClick={() => {
                    onElevateCommunityReport(selectedFeature.data);
                    setSelectedFeature(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-900/90 hover:bg-purple-800 text-purple-200 border border-purple-600/50 rounded-lg font-semibold text-xs transition-colors shrink-0"
                  title="Elevar esta denuncia comunitaria a operativo oficial de interdicción"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-purple-300" />
                  <span>Elevar a Operativo</span>
                </button>
              )}

              <button
                onClick={() => setSelectedFeature(null)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-semibold text-xs border border-slate-700/40 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Zone Predictive and Perceptive Analytics Modal */}
      <ZoneAnalyticsModal
        isOpen={isZoneAnalyticsModalOpen}
        onClose={() => setIsZoneAnalyticsModalOpen(false)}
        result={zoneAnalyticsResult}
        isLoading={isZoneAnalyticsLoading}
        onRefresh={() => {
          if (selectedFeature) {
            const f = selectedFeature;
            const featCoords = getFeatureLatLng(f);
            const coords = featCoords ? { lat: featCoords[0], lng: featCoords[1] } : { lat: 5.0, lng: -65.0 };
            handleExecuteZonePredictiveAnalytics({
              zoneName: f.data?.name || f.data?.title || f.data?.locationName || 'Sector Cuenca',
              coordinates: coords,
            });
          }
        }}
        onCenterMap={(coords) => {
          if (mapInstanceRef.current && coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && !isNaN(coords.lat) && !isNaN(coords.lng)) {
            mapInstanceRef.current.setView([coords.lat, coords.lng], 10, { animate: true });
          }
        }}
        onGenerateIncident={(res) => {
          if (res?.coordinates && typeof res.coordinates.lat === 'number' && typeof res.coordinates.lng === 'number' && !isNaN(res.coordinates.lat) && !isNaN(res.coordinates.lng)) {
            onOpenNewIncident({ lat: res.coordinates.lat, lng: res.coordinates.lng });
          }
          setIsZoneAnalyticsModalOpen(false);
        }}
      />

      {/* Focos FIRMS: periodo, prioridad baja y leyenda */}
      {visibleLayers.heat && (
        <div className="absolute bottom-12 left-2 sm:left-4 z-10 w-[288px] max-w-[calc(100%-4rem)] bg-canvas/90 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-300 shadow-xl space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
            <button
              type="button"
              onClick={() => setIsFirmsPanelOpen((v) => !v)}
              aria-expanded={isFirmsPanelOpen}
              className="font-semibold text-white flex items-center gap-1 whitespace-nowrap hover:text-sky-300"
              title={isFirmsPanelOpen ? 'Plegar leyenda' : 'Mostrar leyenda'}
            >
              <Flame className="w-3.5 h-3.5 text-orange-400" /> Focos NASA FIRMS
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isFirmsPanelOpen ? '' : '-rotate-90'}`} />
            </button>
            <div className="flex gap-1 shrink-0">
              {DENSITY_PERIODS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => setDensityDays(p.days)}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono whitespace-nowrap border ${densityDays === p.days ? 'bg-orange-600 border-orange-500 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {isFirmsPanelOpen && (
            <>
          {densityError && <p className="text-amber-300">No se pudo cargar la densidad: {densityError}</p>}
          {density && (
            <p className="font-mono text-[10px] text-slate-400">
              {density.totals.hotspots} focos · <span style={{ color: PRIORITY_COLORS.ALTA }}>{density.totals.byPriority.ALTA} alta</span> ·{' '}
              <span style={{ color: PRIORITY_COLORS.MEDIA }}>{density.totals.byPriority.MEDIA} media</span> · {density.totals.byPriority.BAJA} baja
            </p>
          )}
          {!showHotspotPoints ? (
            <div>
              <p className="text-[10px] text-slate-400 mb-1">Focos prioritarios por 1.000 km² (hexágonos de 25 km)</p>
              <div className="flex items-center gap-1">
                {DENSITY_LEVEL_COLORS.slice(1).map((c, i) => (
                  <div key={c} className="flex-1 text-center">
                    <div className="h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                    <span className="text-[10px] font-mono text-slate-500">
                      {i === 0 ? `<${density?.levelThresholdsPer1000Km2[0] ?? 1}` : i === 3 ? `≥${density?.levelThresholdsPer1000Km2[2] ?? 6}` : `${density?.levelThresholdsPer1000Km2[i - 1]}-${density?.levelThresholdsPer1000Km2[i]}`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Borde claro: contiene focos de prioridad alta. Acerque el mapa para ver cada foco.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[10px]">
              {(['ALTA', 'MEDIA', 'BAJA'] as HotspotPriority[]).map((p) => (
                <span key={p} className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: PRIORITY_COLORS[p] }} />{PRIORITY_LABELS[p]}</span>
              ))}
              <span className="text-slate-500">borde blanco: persistente</span>
            </div>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showLowPriority} onChange={(e) => setShowLowPriority(e.target.checked)} />
            <span>Mostrar prioridad baja</span>
          </label>
          <p className="text-[10px] text-slate-500 leading-snug">
            Alta: fuego repetido en el mismo punto, o foco relevante en área protegida o a ≤25 km de zona minera. Media: confianza alta o FRP ≥ 10 MW.
          </p>
            </>
          )}
        </div>
      )}

      {/* Bottom Coordinate & Metric Ticker */}
      <div className="absolute bottom-2 left-2 right-12 sm:bottom-3 sm:left-4 sm:right-16 z-10 pointer-events-none">
        <div className="inline-flex items-center gap-2 sm:gap-4 bg-canvas/90 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-mono text-slate-300 shadow-xl pointer-events-auto max-w-full overflow-x-auto whitespace-nowrap scrollbar-none">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold shrink-0">
            <Compass className="w-3.5 h-3.5" />
            <span>AMAZONAS · BOLÍVAR · DELTA AMACURO · ESEQUIBO: [0.6°N - 10.1°N | 68.0°W - 57.8°W]</span>
          </div>
          <span className="text-slate-700 hidden sm:inline">|</span>
          <div className="text-slate-400 shrink-0">
            {selectedCoordinates ? (
              <span>Punto: <strong className="text-emerald-400">{selectedCoordinates[0].toFixed(4)}°N, {selectedCoordinates[1].toFixed(4)}°W</strong></span>
            ) : (
              <span className="hidden sm:inline">Haga clic en el mapa para inspección táctica</span>
            )}
          </div>
        </div>
      </div>

      {/* Media Lightbox Modal for Community Reports (High-res zoom & video playback) */}
      {activeLightboxMedia && (
        <MediaLightboxModal
          media={activeLightboxMedia}
          allMedia={lightboxMediaList}
          reportTitle={selectedFeature?.type === 'communityReport' ? selectedFeature.data.title : undefined}
          reportCode={selectedFeature?.type === 'communityReport' ? selectedFeature.data.code : undefined}
          onClose={() => setActiveLightboxMedia(null)}
        />
      )}
    </div>
  );
};
