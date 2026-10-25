import React, { useState, useRef, useEffect } from 'react';
import { 
  Layers, 
  Flame, 
  Pickaxe, 
  Droplets, 
  Shield, 
  AlertTriangle, 
  Building2, 
  MapPin, 
  Waves, 
  Navigation, 
  Globe, 
  Flag,
  Download,
  Satellite,
  Filter,
  ChevronDown,
  Check,
  CheckSquare,
  Square,
  X,
  SlidersHorizontal,
  BookOpen,
  Users
} from 'lucide-react';
import { VisibleLayersState, BaseLayerType } from '../types';

interface GeospatialLayerToolbarProps {
  visibleLayers: VisibleLayersState;
  onToggleLayer: (layerKey: keyof VisibleLayersState) => void;
  activeBaseLayer: BaseLayerType;
  onChangeBaseLayer: (layer: BaseLayerType) => void;
  miningCount: number;
  heatCount: number;
  hydroCount: number;
  protectedCount: number;
  incidentsCount: number;
  communityReportsCount?: number;
  sentinelS2Count?: number;
  scientificCount?: number;
  onFocusVenezuela?: () => void;
  onExportGeoJSON?: () => void;
  onOpenSatelliteApis?: () => void;
}

export const GeospatialLayerToolbar: React.FC<GeospatialLayerToolbarProps> = ({
  visibleLayers,
  onToggleLayer,
  activeBaseLayer,
  onChangeBaseLayer,
  miningCount,
  heatCount,
  hydroCount,
  protectedCount,
  incidentsCount,
  communityReportsCount = 0,
  sentinelS2Count = 0,
  scientificCount = 0,
  onFocusVenezuela,
  onExportGeoJSON,
  onOpenSatelliteApis,
}) => {
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const layerOptions: {
    key: keyof VisibleLayersState;
    name: string;
    count?: number;
    countLabel?: string;
    icon: React.ElementType;
    color: string;
    desc: string;
  }[] = [
    { key: 'mining', name: 'Zonas de Vigilancia Minera', count: miningCount, icon: Pickaxe, color: 'text-red-400', desc: 'Sectores mineros de referencia y perturbaciones SAR medidas (Nivel 2)' },
    { key: 'sentinelS2', name: 'Escenas Sentinel-2 útiles', count: sentinelS2Count, icon: Satellite, color: 'text-emerald-400', desc: 'Pasadas L2A reales con menos de 20% de nubes' },
    { key: 'heat', name: 'Focos de Calor (NASA FIRMS)', count: heatCount, icon: Flame, color: 'text-amber-400', desc: 'Densidad en hexágonos de 25 km; focos por prioridad al acercar' },
    { key: 'firmsWms', name: 'Capa WMS NASA GIBS (VIIRS)', countLabel: 'WMS', icon: Flame, color: 'text-orange-400', desc: 'Composición diaria de focos térmicos VIIRS 375 m' },
    { key: 'hydro', name: 'Estaciones Hidrométricas INAMEH', count: hydroCount, icon: Droplets, color: 'text-sky-400', desc: 'Nivel del Orinoco y cota de desborde (boletín diario)' },
    { key: 'protected', name: 'Áreas Protegidas (ABRAE)', count: protectedCount, icon: Shield, color: 'text-emerald-400', desc: 'Polígonos aproximados de referencia' },
    { key: 'incidents', name: 'Incidentes y Alertas Operativas', count: incidentsCount, icon: AlertTriangle, color: 'text-purple-400', desc: 'Minutas de patrullaje militar e interdicción fluvial' },
    { key: 'communityReports', name: 'Denuncias Ambientales Comunitarias', count: communityReportsCount, icon: Users, color: 'text-violet-400', desc: 'Alertas de pueblos indígenas y ribereños con GPS y fotos' },
    { key: 'scientific', name: 'Corpus Científico Georreferenciado', count: scientificCount, icon: BookOpen, color: 'text-teal-400', desc: 'Sitios de estudio publicados (valores de la literatura)' },
    { key: 'venezuela', name: 'Frontera Nacional Oficial (VE)', countLabel: 'Soberanía', icon: Flag, color: 'text-sky-300', desc: 'Límite Soberano Integral + Guayana Esequiba' },
    { key: 'amazonasBolivarDelta', name: 'Límites Territoriales (Fronteras Internas GeoJSON)', countLabel: 'Estados', icon: Building2, color: 'text-white', desc: 'Líneas limítrofes reales y fronteras internas según tabla GeoJSON' },
    { key: 'municipalities', name: 'Municipios y Distritos (ADM2)', countLabel: '18 ADM2', icon: MapPin, color: 'text-slate-300', desc: 'Divisiones político-administrativas municipales' },
    { key: 'rivers', name: 'Red Fluvial y Nombres de Ríos', countLabel: 'Hidro', icon: Waves, color: 'text-sky-400', desc: 'Toponimia e hidrografía del Orinoco y afluentes' },
    { key: 'sectors', name: 'Sectores y Comunidades', countLabel: 'Poblados', icon: Navigation, color: 'text-amber-300', desc: 'Asentamientos indígenas, puertos y bases' },
  ];

  const activeLayersCount = Object.values(visibleLayers).filter(Boolean).length;

  const handleSelectAll = () => {
    layerOptions.forEach(opt => {
      if (!visibleLayers[opt.key]) {
        onToggleLayer(opt.key);
      }
    });
  };

  const handleDeselectAll = () => {
    layerOptions.forEach(opt => {
      if (visibleLayers[opt.key]) {
        onToggleLayer(opt.key);
      }
    });
  };

  return (
    <div 
      id="geospatial-layer-toolbar"
      className="relative z-30 flex min-h-12 items-center justify-between gap-3 border-b border-slate-800/70 bg-[#09161e]/95 px-3 py-1.5 shadow-[0_5px_14px_rgba(0,0,0,.18)] select-none backdrop-blur-md sm:px-5"
    >
      {/* Left: Base Map Selector & Focus Venezuela (Horizontally Scrollable) */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto py-0.5 touch-pan-x scrollbar-none">
          {/* Base Map Switcher */}
          <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[.08] bg-black/15 px-1.5 py-1">
            <div className="mr-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Capas:</span>
            </div>

            <div className="flex items-center gap-0.5 rounded-md bg-slate-950/50 p-0.5 text-[10px] font-medium">
              <button
                id="base-layer-satellite-btn"
                onClick={() => onChangeBaseLayer('satellite')}
                className={`px-2 py-0.5 rounded transition-all ${
                  activeBaseLayer === 'satellite'
                    ? 'bg-emerald-400/18 text-emerald-100 font-semibold shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
                title="Mapa Base Satelital de Alta Resolución"
              >
                Satelital
              </button>
              <button
                id="base-layer-dark-btn"
                onClick={() => onChangeBaseLayer('dark')}
                className={`px-2 py-0.5 rounded transition-all ${
                  activeBaseLayer === 'dark'
                    ? 'bg-emerald-400/18 text-emerald-100 font-semibold shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
                title="Mapa Base Táctico Militar Oscuro"
              >
                Táctico
              </button>
              <button
                id="base-layer-topo-btn"
                onClick={() => onChangeBaseLayer('topo')}
                className={`px-2 py-0.5 rounded transition-all ${
                  activeBaseLayer === 'topo'
                    ? 'bg-emerald-400/18 text-emerald-100 font-semibold shadow-sm'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
                title="Mapa Base Topográfico y Relieve"
              >
                Topo
              </button>
            </div>
          </div>

          {/* Quick Focus Venezuela */}
          {onFocusVenezuela && (
            <button
              id="btn-focus-venezuela-toolbar"
              onClick={onFocusVenezuela}
              title="Enfocar República Bolivariana de Venezuela + Guayana Esequiba"
              className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[.08] bg-white/[.045] px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[.09]"
            >
              <span>🇻🇪</span>
              <span className="hidden md:inline">Venezuela</span>
            </button>
          )}
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px shrink-0 bg-white/[.09]" />

        {/* 🌟 FILTER BUTTON WITH UNCLIPPED FLOATING DROPDOWN MENU 🌟 */}
        <div className="shrink-0" ref={filterRef}>
          <button
            id="btn-geospatial-layer-filter"
            onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
              isFilterDropdownOpen || activeLayersCount > 0
                ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/15'
                : 'border-white/[.08] bg-white/[.045] text-slate-300 hover:bg-white/[.08]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-300" />
            <span className="hidden xs:inline">Capas</span>
            <span className="xs:hidden">Capas</span>
            <span className="ml-0.5 rounded-full bg-emerald-400/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-100">
              {activeLayersCount}/{layerOptions.length}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFilterDropdownOpen ? 'rotate-180 text-sky-300' : 'text-slate-400'}`} />
          </button>

          {/* FILTER DROPDOWN OVERLAY PANEL - 11 GEOSPATIAL LAYERS */}
          {isFilterDropdownOpen && (
            <div 
              id="layer-filter-dropdown-menu"
              className="absolute right-2 sm:right-3 top-full mt-2 z-50 w-[290px] xs:w-[345px] sm:w-[390px] max-w-[calc(100vw-24px)] bg-[#070c14]/95 border border-sky-500/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-3 text-slate-200 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150"
              onWheel={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Menu Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Capas y Vectores Geoespaciales (12)
                  </span>
                </div>
                <button
                  onClick={() => setIsFilterDropdownOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Select / Deselect All */}
              <div className="flex items-center justify-between mb-2 px-1 text-[11px]">
                <span className="text-slate-400 font-mono">
                  {activeLayersCount} de {layerOptions.length} capas activas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                  >
                    Activar Todas
                  </button>
                  <span className="text-slate-700">|</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Desactivar
                  </button>
                </div>
              </div>

              {/* Options List */}
              <div className="space-y-1 max-h-[180px] xs:max-h-[220px] sm:max-h-[280px] md:max-h-[360px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {layerOptions.map((opt) => {
                  const IconComponent = opt.icon;
                  const isActive = visibleLayers[opt.key];

                  return (
                    <button
                      key={opt.key}
                      id={`layer-option-${opt.key}`}
                      onClick={() => onToggleLayer(opt.key)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all ${
                        isActive
                          ? 'bg-slate-900/90 border-sky-500/50 text-white shadow-sm ring-1 ring-sky-500/20'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className={`p-1.5 rounded-md ${isActive ? 'bg-slate-800' : 'bg-slate-900'}`}>
                          <IconComponent className={`w-4 h-4 ${opt.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                            <span>{opt.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {opt.desc}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {opt.count !== undefined ? (
                          <span className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            isActive ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {opt.count}
                          </span>
                        ) : opt.countLabel ? (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[9px] ${
                            isActive ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {opt.countLabel}
                          </span>
                        ) : null}

                        <div className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isActive ? 'bg-sky-500 border-sky-400 text-white' : 'border-slate-700 bg-slate-900'
                        }`}>
                          {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Quick Tools (APIs Satelitales & Export GeoJSON) */}
      <div className="flex shrink-0 items-center gap-1.5">
        {onOpenSatelliteApis && (
          <button
            id="btn-toolbar-satellite-apis"
            onClick={onOpenSatelliteApis}
            title="Ver URLs Oficiales de Conexiones Satelitales (NASA FIRMS, Copernicus, INPE)"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-cyan-300/15 bg-cyan-400/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-400/18 whitespace-nowrap"
          >
            <Satellite className="h-3.5 w-3.5 text-cyan-300" />
            <span className="hidden sm:inline">APIs Satelitales</span>
            <span className="hidden xs:inline sm:hidden">APIs</span>
          </button>
        )}

        {onExportGeoJSON && (
          <button
            id="btn-export-geojson-toolbar"
            onClick={onExportGeoJSON}
            title="Exportar todas las capas tácticas a GeoJSON estándar"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-white/[.08] bg-white/[.045] px-2 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/[.09] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">GeoJSON</span>
          </button>
        )}
      </div>
    </div>
  );
};
