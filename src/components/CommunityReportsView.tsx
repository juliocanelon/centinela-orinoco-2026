import React, { useState } from 'react';
import { 
  Users, 
  PlusCircle, 
  Search, 
  Filter, 
  MapPin, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Camera, 
  Video, 
  Radio, 
  ExternalLink, 
  ChevronRight, 
  Sparkles,
  SlidersHorizontal,
  Flame,
  Droplets,
  Layers,
  Eye,
  Maximize2,
  Play,
  X
} from 'lucide-react';
import { 
  CommunityReport, 
  CommunityReportCategory, 
  CommunityReportStatus, 
  AlertSeverity,
  CommunityReportMedia 
} from '../types';
import { MediaLightboxModal } from './MediaLightboxModal';

interface CommunityReportsViewProps {
  reports: CommunityReport[];
  onOpenNewReportModal: () => void;
  onFocusOnMap: (lat: number, lng: number, report: CommunityReport) => void;
  onElevateToIncident: (report: CommunityReport) => void;
  onUpdateStatus: (id: string, status: CommunityReportStatus) => void;
}

export const CommunityReportsView: React.FC<CommunityReportsViewProps> = ({
  reports,
  onOpenNewReportModal,
  onFocusOnMap,
  onElevateToIncident,
  onUpdateStatus,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Modal Lightbox for Media Zoom and Video Playback
  const [activeMediaModal, setActiveMediaModal] = useState<{
    media: CommunityReportMedia;
    allMedia: CommunityReportMedia[];
    reportTitle: string;
    reportCode: string;
  } | null>(null);

  // Filtered reports
  const filteredReports = reports.filter((rep) => {
    const matchesSearch = 
      rep.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rep.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rep.communityName && rep.communityName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      rep.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || rep.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || rep.category === categoryFilter;
    const matchesSeverity = severityFilter === 'ALL' || rep.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesSeverity;
  });

  // Metrics
  const totalCount = reports.length;
  const criticalCount = reports.filter((r) => r.severity === 'CRITICAL').length;
  const pendingCount = reports.filter((r) => r.status === 'PENDIENTE_VALIDACION').length;
  const elevatedCount = reports.filter((r) => r.status === 'OPERATIVO_ENVIADO').length;

  const getCategoryBadge = (cat: CommunityReportCategory) => {
    const map: Record<CommunityReportCategory, { label: string; color: string }> = {
      MINERIA_ILEGAL: { label: 'Minería Ilegal', color: 'text-amber-400 bg-amber-950/80 border-amber-800' },
      CONTAMINACION_HIDRICA: { label: 'Contaminación Hídrica', color: 'text-cyan-400 bg-cyan-950/80 border-cyan-800' },
      DERRAME_HIDROCARBUROS: { label: 'Derrame Combustible', color: 'text-orange-400 bg-orange-950/80 border-orange-800' },
      DEFORESTACION: { label: 'Deforestación', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-800' },
      AFECTACION_FAUNA_FLORA: { label: 'Fauna / Flora', color: 'text-lime-400 bg-lime-950/80 border-lime-800' },
      INVASION_ABRAE: { label: 'Invasión ABRAE', color: 'text-purple-400 bg-purple-950/80 border-purple-800' },
      OTRO: { label: 'Otro Ilícito', color: 'text-slate-400 bg-slate-900 border-slate-700' },
    };
    return map[cat] || map.OTRO;
  };

  const getStatusBadge = (status: CommunityReportStatus) => {
    const map: Record<CommunityReportStatus, { label: string; color: string }> = {
      PENDIENTE_VALIDACION: { label: 'Pendiente Validación', color: 'bg-amber-950 text-amber-300 border-amber-800' },
      CONFIRMADA_EN_TERRENO: { label: 'Confirmada en Terreno', color: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
      OPERATIVO_ENVIADO: { label: 'Elevada a Interdicción', color: 'bg-purple-950 text-purple-300 border-purple-800' },
      DESESTIMADA: { label: 'Desestimada', color: 'bg-slate-900 text-slate-400 border-slate-800' },
    };
    return map[status] || map.PENDIENTE_VALIDACION;
  };

  return (
    <div id="community-reports-view" className="flex flex-col h-full bg-canvas text-slate-200 overflow-y-auto">
      {/* Top Banner / Hero */}
      <div className="bg-canvas border-b border-slate-800/80 px-4 sm:px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800 font-mono text-xs font-semibold uppercase">
                Veeduría Ambiental Comunitaria
              </span>
              <span className="text-slate-500 text-xs">·</span>
              <span className="text-slate-400 text-xs">Pueblos Indígenas & Ribereños del Orinoco</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Centro de Denuncias y Veeduría Territorial
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Canal de alerta temprana ciudadana. Las denuncias remitidas con GPS y fotografías se integran de forma inmediata a la cartografía táctica para contraste con radar Sentinel-1 y patrullaje de Guardería Ambiental.
            </p>
          </div>

          {/* Quick Action Button */}
          <button
            id="btn-new-community-report-view"
            onClick={onOpenNewReportModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-lg shadow-sky-950/60 border border-sky-400/40 transition-all shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Registrar Nueva Denuncia</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Row */}
      <div className="px-4 sm:px-6 py-3 bg-canvas border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Total Denuncias</span>
              <span className="text-xl font-bold font-mono text-white tabular-nums">{totalCount}</span>
            </div>
            <div className="p-2 bg-slate-800 rounded-lg text-sky-400">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-amber-400 block font-medium">Pendientes Validación</span>
              <span className="text-xl font-bold font-mono text-amber-300 tabular-nums">{pendingCount}</span>
            </div>
            <div className="p-2 bg-amber-950/80 rounded-lg text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-red-400 block font-medium">Impacto Crítico</span>
              <span className="text-xl font-bold font-mono text-red-300 tabular-nums">{criticalCount}</span>
            </div>
            <div className="p-2 bg-red-950/80 rounded-lg text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-purple-400 block font-medium">Elevadas a Interdicción</span>
              <span className="text-xl font-bold font-mono text-purple-300 tabular-nums">{elevatedCount}</span>
            </div>
            <div className="p-2 bg-purple-950/80 rounded-lg text-purple-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Filters + List */}
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* Filter Bar */}
        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, título, río, comunidad o descripción..."
              className="w-full pl-9 pr-3 py-1.5 bg-canvas border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDIENTE_VALIDACION">Pendiente Validación</option>
              <option value="CONFIRMADA_EN_TERRENO">Confirmada en Terreno</option>
              <option value="OPERATIVO_ENVIADO">Elevada a Operativo</option>
              <option value="DESESTIMADA">Desestimada</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Todas las Categorías</option>
              <option value="MINERIA_ILEGAL">Minería Ilegal</option>
              <option value="CONTAMINACION_HIDRICA">Contaminación Hídrica</option>
              <option value="DERRAME_HIDROCARBUROS">Derrame Combustible</option>
              <option value="DEFORESTACION">Deforestación</option>
              <option value="AFECTACION_FAUNA_FLORA">Fauna / Flora</option>
              <option value="INVASION_ABRAE">Invasión ABRAE</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-canvas border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Toda Severidad</option>
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
          </div>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
            <Users className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-300">No se encontraron denuncias comunitarias</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No hay reportes que coincidan con los filtros seleccionados o la búsqueda actual.
            </p>
            <button
              onClick={onOpenNewReportModal}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow transition-colors"
            >
              Registrar Primera Denuncia
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReports.map((report) => {
              const catBadge = getCategoryBadge(report.category);
              const statusBadge = getStatusBadge(report.status);

              return (
                <div
                  key={report.id}
                  className="bg-surface border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between shadow-sm transition-all space-y-3"
                >
                  {/* Top Bar: Code, Status & Date */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                          {report.code}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${catBadge.color}`}>
                          {catBadge.label}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {new Date(report.timestamp).toLocaleDateString('es-VE', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-white line-clamp-2 mb-1.5">
                      {report.title}
                    </h3>

                    {/* Location & Community */}
                    <div className="text-xs text-slate-300 space-y-1 mb-2">
                      <div className="flex items-center gap-1.5 text-sky-300 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">{report.locationName}</span>
                        <span className="text-slate-500 font-mono text-[11px] shrink-0">
                          ({report.latitude.toFixed(3)}°N, {report.longitude.toFixed(3)}°W)
                        </span>
                      </div>

                      {report.communityName && (
                        <div className="flex items-center gap-1.5 text-amber-300/90 text-[11px]">
                          <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Comunidad: {report.communityName}</span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed mb-3">
                      {report.description}
                    </p>

                    {/* Reporter Privacy Tag */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3 pb-2 border-b border-slate-800/80">
                      {report.isAnonymous ? (
                        <div className="flex items-center gap-1 text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Denuncia Anónima Protegida</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>Vocero: <strong>{report.reporterName}</strong> {report.reporterContact ? `(${report.reporterContact})` : ''}</span>
                        </div>
                      )}
                    </div>

                    {/* Evidence Gallery Thumbnails */}
                    {report.media && report.media.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                          <Camera className="w-3 h-3 text-emerald-400" />
                          Evidencias ({report.media.length} adjunto(s)):
                        </span>
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                          {report.media.map((med) => (
                            <button
                              type="button"
                              key={med.id}
                              onClick={() => setActiveMediaModal({
                                media: med,
                                allMedia: report.media,
                                reportTitle: report.title,
                                reportCode: report.code,
                              })}
                              className="group relative h-16 w-24 shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer shadow hover:border-sky-400 hover:ring-2 hover:ring-sky-500/30 transition-all"
                              title={med.type === 'video' ? `Reproducir video: ${med.name}` : `Ver foto ampliada: ${med.name}`}
                            >
                              {med.type === 'video' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-sky-400 relative group-hover:bg-slate-900 transition-colors">
                                  <div className="w-6 h-6 rounded-full bg-sky-950/90 border border-sky-400 flex items-center justify-center text-sky-300 shadow group-hover:scale-110 transition-transform mb-0.5">
                                    <Play className="w-3 h-3 ml-0.5" />
                                  </div>
                                  <span className="text-[8px] font-mono uppercase font-bold text-sky-300">Video</span>
                                </div>
                              ) : (
                                <img
                                  src={med.url}
                                  alt={med.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Maximize2 className="w-4 h-4" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                    {/* View on Tactical Map */}
                    <button
                      onClick={() => onFocusOnMap(report.latitude, report.longitude, report)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-sky-950/90 hover:bg-sky-900 text-sky-300 border border-sky-700/60 rounded-lg text-xs font-medium transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                      <span>Ver en Mapa Táctico</span>
                    </button>

                    {/* Operational Elevation or State Toggle */}
                    <div className="flex items-center gap-1.5">
                      {report.status !== 'OPERATIVO_ENVIADO' && (
                        <button
                          onClick={() => onElevateToIncident(report)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-950/90 hover:bg-purple-900 text-purple-300 border border-purple-700/60 rounded-lg text-xs font-semibold transition-colors"
                          title="Elevar esta denuncia comunitaria a operativo oficial de interdicción militar/ambiental"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                          <span className="hidden sm:inline">Elevar a </span>Operativo
                        </button>
                      )}

                      {report.status === 'PENDIENTE_VALIDACION' && (
                        <button
                          onClick={() => onUpdateStatus(report.id, 'CONFIRMADA_EN_TERRENO')}
                          className="px-2.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-medium transition-colors"
                          title="Confirmar presencia física en terreno"
                        >
                          Validar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Media Lightbox Modal for high-res photo zoom and video playback */}
      {activeMediaModal && (
        <MediaLightboxModal
          media={activeMediaModal.media}
          allMedia={activeMediaModal.allMedia}
          reportTitle={activeMediaModal.reportTitle}
          reportCode={activeMediaModal.reportCode}
          onClose={() => setActiveMediaModal(null)}
        />
      )}
    </div>
  );
};
