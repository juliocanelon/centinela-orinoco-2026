import React, { useState, useEffect } from 'react';
import {
  Radio,
  Satellite,
  Radar,
  Smartphone,
  Database,
  Sparkles,
  Search,
  RefreshCw,
  Send,
  AlertTriangle,
  Flame,
  Layers,
  Copy,
  Check,
  Download,
  Droplets,
  MapPin,
  ExternalLink,
  Activity,
  Workflow,
  Clock,
} from 'lucide-react';
import { SupabaseAutomationSchedulerView } from './SupabaseAutomationSchedulerView';
import {
  IngestionFeed,
  IngestionOverview,
  KoboFieldPatrolReport,
  RagIntelligenceSynthesis,
  SatelliteScheduledTask,
} from '../types';
import { LivePipelineService } from '../services/liveDataPipelineService';
import { SATELLITE_API_CONNECTIONS, SatelliteApiConnection, MONITORING_BBOX } from '../data/satelliteApiDirectory';

interface LiveIngestionPipelineViewProps {
  onNavigateToMapWithCoords?: (lat: number, lng: number, zoom?: number) => void;
  onAddIncident?: (incident: any) => void;
}

type TabKey = 'AUTOMATION_SCHEDULER' | 'CONNECTORS' | 'SATELLITE_APIS' | 'RAG_STUDIO' | 'LIVE_FEED' | 'POSTGIS_SQL' | 'SENTINEL_S2';
type FeedFilter = 'NASA_FIRMS' | 'SENTINEL_1' | 'SENTINEL_2' | 'SENTINEL_3' | 'INAMEH' | 'KOBO';

const TASK_ICONS: Record<SatelliteScheduledTask['key'], React.ReactNode> = {
  NASA_FIRMS: <Flame className="w-4 h-4 text-amber-400" />,
  SENTINEL_1_SAR: <Radar className="w-4 h-4 text-sky-400" />,
  SENTINEL_2_MSI: <Satellite className="w-4 h-4 text-emerald-400" />,
  SENTINEL_3_OLCI: <Layers className="w-4 h-4 text-teal-400" />,
  HYDRO_TELEMETRY: <Droplets className="w-4 h-4 text-cyan-400" />,
};

const AVAILABILITY_STYLES: Record<SatelliteApiConnection['availability'], { label: string; className: string }> = {
  ACTIVE: { label: 'EN USO', className: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  REFERENCE_ONLY: { label: 'REFERENCIA', className: 'bg-slate-800 text-slate-300 border-slate-700' },
  UNAVAILABLE: { label: 'NO DISPONIBLE', className: 'bg-red-950 text-red-300 border-red-800' },
};

const PRESET_QUERIES = [
  'Focos de calor en Bolívar',
  'Nivel del Orinoco en Puerto Ayacucho',
  'Focos de confianza alta en Amazonas',
  'Guayana Esequiba focos de calor',
];

const formatDateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('es-VE') : '—');

export const LiveIngestionPipelineView: React.FC<LiveIngestionPipelineViewProps> = ({
  onNavigateToMapWithCoords,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('AUTOMATION_SCHEDULER');
  const [overview, setOverview] = useState<IngestionOverview | null>(null);
  const [feed, setFeed] = useState<IngestionFeed | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('NASA_FIRMS');
  const [s2MaxCloud, setS2MaxCloud] = useState<number>(20);
  const [sqlScript, setSqlScript] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);

  // Kobo (minutas de campo enviadas en esta sesión)
  const [koboReports, setKoboReports] = useState<KoboFieldPatrolReport[]>([]);
  const [koboModalOpen, setKoboModalOpen] = useState(false);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [koboError, setKoboError] = useState<string | null>(null);
  const [webhookOfficer, setWebhookOfficer] = useState('');
  const [webhookUnit, setWebhookUnit] = useState('');
  const [webhookRiver, setWebhookRiver] = useState('');
  const [webhookCategory, setWebhookCategory] = useState<KoboFieldPatrolReport['category']>('MINERIA_ILEGAL');
  const [webhookLat, setWebhookLat] = useState('');
  const [webhookLng, setWebhookLng] = useState('');
  const [webhookTurbidity, setWebhookTurbidity] = useState('');
  const [webhookMercury, setWebhookMercury] = useState('');
  const [webhookDredges, setWebhookDredges] = useState('');
  const [webhookNarrative, setWebhookNarrative] = useState('');

  // Búsqueda RAG
  const [ragQuery, setRagQuery] = useState(PRESET_QUERIES[0]);
  const [ragRadiusKm, setRagRadiusKm] = useState(0);
  const [ragCenterLat, setRagCenterLat] = useState('');
  const [ragCenterLng, setRagCenterLng] = useState('');
  const [isExecutingRag, setIsExecutingRag] = useState(false);
  const [ragResult, setRagResult] = useState<RagIntelligenceSynthesis | null>(null);
  const [ragError, setRagError] = useState<string | null>(null);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const [status, data] = await Promise.all([
        LivePipelineService.getConnectorStatus(),
        LivePipelineService.getIngestionFeed(),
      ]);
      setOverview(status);
      setFeed(data);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || String(err));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    LivePipelineService.getAutomationSql()
      .then(setSqlScript)
      .catch((err) => setSqlScript(`-- No se pudo cargar el SQL: ${err?.message || err}`));
  }, []);

  const handleDispatchKoboWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const latitude = Number.parseFloat(webhookLat);
    const longitude = Number.parseFloat(webhookLng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setKoboError('Ingrese latitud y longitud válidas.');
      return;
    }
    const optional = (v: string) => (v.trim() === '' ? undefined : Number(v));
    setIsSendingWebhook(true);
    setKoboError(null);
    try {
      const res = await LivePipelineService.dispatchKoboWebhook({
        officerName: webhookOfficer,
        patrolUnit: webhookUnit,
        riverOrSubBasin: webhookRiver,
        sectorName: webhookRiver,
        latitude,
        longitude,
        category: webhookCategory,
        severity: 'HIGH',
        mercuryDetectedPpm: optional(webhookMercury),
        turbidityNtu: optional(webhookTurbidity),
        dredgesConfiscatedCount: optional(webhookDredges),
        narrative: webhookNarrative,
      });
      setKoboReports((prev) => [res.report, ...prev]);
      setKoboModalOpen(false);
    } catch (err: any) {
      setKoboError(err?.message || String(err));
    } finally {
      setIsSendingWebhook(false);
    }
  };

  const handleExecuteRag = async () => {
    if (!ragQuery.trim()) return;
    const lat = Number.parseFloat(ragCenterLat);
    const lng = Number.parseFloat(ragCenterLng);
    const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
    setIsExecutingRag(true);
    setRagError(null);
    try {
      const synthesis = await LivePipelineService.executeVectorRagQuery({
        query: ragQuery,
        filterLat: hasCenter ? lat : undefined,
        filterLng: hasCenter ? lng : undefined,
        radiusKm: hasCenter && ragRadiusKm > 0 ? ragRadiusKm : undefined,
        maxMatches: 8,
      });
      setRagResult(synthesis);
    } catch (err: any) {
      setRagError(err?.message || String(err));
    } finally {
      setIsExecutingRag(false);
    }
  };

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const downloadSqlScript = () => {
    const blob = new Blob([sqlScript], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'centinela_orinoco_migraciones.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const focusOnMap = (lat: number | null | undefined, lng: number | null | undefined, zoom = 9) => {
    if (onNavigateToMapWithCoords && typeof lat === 'number' && typeof lng === 'number') {
      onNavigateToMapWithCoords(lat, lng, zoom);
    }
  };

  const tasks = overview?.tasks || [];
  const tasksOk = tasks.filter((t) => t.status === 'SUCCESS').length;
  const s2Filtered = (feed?.sentinel2Products || []).filter((p) => p.cloudPixelPct !== null && p.cloudPixelPct <= s2MaxCloud);
  const feedCounts: Record<FeedFilter, number> = {
    NASA_FIRMS: feed?.hotspots.length || 0,
    SENTINEL_1: feed?.sentinel1Scenes.length || 0,
    SENTINEL_2: feed?.sentinel2Products.length || 0,
    SENTINEL_3: feed?.sentinel3Products.length || 0,
    INAMEH: feed?.hydroStations.length || 0,
    KOBO: koboReports.length,
  };

  const tabButton = (key: TabKey, label: React.ReactNode, icon: React.ReactNode) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
        activeTab === key ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex-1 bg-canvas text-slate-200 overflow-y-auto flex flex-col">
      {/* Header Banner */}
      <div className="bg-surface border-b border-slate-800/80 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-600 p-[1px] shadow-lg shadow-sky-950/50">
              <div className="w-full h-full bg-surface rounded-[11px] flex items-center justify-center">
                <Workflow className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide font-sans">
                  Ingesta de Datos Satelitales e Hidrológicos
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                  DATOS REALES
                </span>
              </div>
              <p className="text-xs text-slate-400">
                NASA FIRMS, Copernicus Sentinel-1/2/3 e INAMEH, almacenados en Supabase sin duplicados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-950/80 hover:bg-sky-900/80 text-sky-300 text-xs font-medium rounded-lg border border-sky-800 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Actualizando...' : 'Actualizar datos'}</span>
            </button>
            <button
              onClick={() => { setKoboError(null); setKoboModalOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg shadow-md shadow-emerald-950/40 transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Registrar minuta de campo</span>
            </button>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 mt-4 max-w-7xl mx-auto border-t border-slate-800/60 pt-3 flex-wrap">
          <button
            onClick={() => setActiveTab('AUTOMATION_SCHEDULER')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'AUTOMATION_SCHEDULER'
                ? 'bg-violet-600 text-white shadow-md shadow-violet-950/50 ring-1 ring-violet-400'
                : 'text-violet-300 hover:text-white hover:bg-violet-950/40 border border-violet-900/50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-violet-300" />
            <span>Tareas programadas</span>
          </button>
          {tabButton('CONNECTORS', `Conectores (${tasksOk}/${tasks.length} con última ejecución correcta)`, <Radio className="w-3.5 h-3.5" />)}
          {tabButton('SATELLITE_APIS', `Directorio de URLs (${SATELLITE_API_CONNECTIONS.length})`, <Satellite className="w-3.5 h-3.5 text-cyan-400" />)}
          {tabButton('RAG_STUDIO', 'Búsqueda en documentos', <Sparkles className="w-3.5 h-3.5" />)}
          {tabButton('LIVE_FEED', 'Registros recientes', <Activity className="w-3.5 h-3.5" />)}
          {tabButton('POSTGIS_SQL', 'Migraciones SQL', <Database className="w-3.5 h-3.5" />)}
          {tabButton('SENTINEL_S2', `Catálogo Sentinel-2 (${feed?.sentinel2Products.length || 0})`, <Satellite className="w-3.5 h-3.5" />)}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loadError && activeTab !== 'AUTOMATION_SCHEDULER' && (
          <div className="mb-4 p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-xs text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>No se pudieron cargar los datos de ingesta: {loadError}</span>
          </div>
        )}

        {/* TAB 0: AUTOMATION SCHEDULER */}
        {activeTab === 'AUTOMATION_SCHEDULER' && (
          <SupabaseAutomationSchedulerView
            onNavigateToRag={() => setActiveTab('RAG_STUDIO')}
            onNavigateToSql={() => setActiveTab('POSTGIS_SQL')}
          />
        )}

        {/* TAB 1: CONNECTORS */}
        {activeTab === 'CONNECTORS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tasks.map((task) => (
                <div key={task.key} className="bg-surface border border-slate-800 rounded-xl p-4 space-y-2 shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">{TASK_ICONS[task.key]}</span>
                      <h3 className="text-sm font-bold text-white">{task.name}</h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      task.status === 'ERROR' ? 'bg-red-950 text-red-300 border-red-800'
                        : task.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{task.satelliteMission} · {task.nominalCadenceText}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-canvas p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">EN LA TABLA</span>
                      <span className="text-emerald-400 font-bold">{task.totalIngested}</span>
                    </div>
                    <div className="bg-canvas p-2 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">ÚLTIMA EJECUCIÓN</span>
                      <span className="text-slate-200">{task.lastInserted === null ? '—' : `+${task.lastInserted} / ${task.lastSkipped} omit.`}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">{task.supabaseTable} · {formatDateTime(task.lastRunAt)}</p>
                </div>
              ))}

              <div className="bg-surface border border-slate-800 rounded-xl p-4 space-y-2 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-900 border border-slate-800"><Smartphone className="w-4 h-4 text-emerald-400" /></span>
                  <h3 className="text-sm font-bold text-white">Webhook KoboToolbox / ODK</h3>
                </div>
                <p className="text-[11px] text-slate-400">Minutas de patrullaje con mediciones de campo (opcionales). Se conservan en la memoria del servidor.</p>
                <p className="text-xs font-mono text-slate-300">{overview?.kobo.totalSubmissions ?? 0} minutas · {overview?.kobo.webhookPath}</p>
              </div>

              <div className="bg-surface border border-slate-800 rounded-xl p-4 space-y-2 shadow-md">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-slate-900 border border-slate-800"><Database className="w-4 h-4 text-violet-400" /></span>
                  <h3 className="text-sm font-bold text-white">Supabase (PostgreSQL + PostGIS)</h3>
                </div>
                <p className="text-xs font-mono text-slate-300">{overview?.supabaseConnected ? 'Configurado' : 'No configurado'} · {overview?.supabaseHost}</p>
                <p className="text-[11px] text-slate-400">{overview?.ragDocumentsCount ?? 0} documentos de texto para la IA · caché actualizado {formatDateTime(overview?.cacheLoadedAt)}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1.5: SATELLITE API CONNECTIONS DIRECTORY */}
        {activeTab === 'SATELLITE_APIS' && (
          <div className="bg-surface border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-700/60 text-cyan-400">
                  <Satellite className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Directorio de conexiones y URLs de consumo</h3>
                  <p className="text-xs text-slate-400">Fuente única de las URLs que usan las tareas de ingesta.</p>
                </div>
              </div>
              <span className="px-2.5 py-1 text-xs font-mono bg-slate-900 border border-slate-700 text-slate-300 rounded-lg">
                Cobertura Amazonas, Bolívar, Delta Amacuro y Esequibo: [{MONITORING_BBOX.bboxString}]
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-4">
              {SATELLITE_API_CONNECTIONS.map((conn) => {
                const isCopied = copiedUrlId === conn.id;
                const availability = AVAILABILITY_STYLES[conn.availability];
                return (
                  <div key={conn.id} className="p-4 rounded-xl bg-surface border border-slate-800 hover:border-slate-700 transition-all shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{conn.name}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-mono rounded border ${availability.className}`}>{availability.label}</span>
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">{conn.agency}</span>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded">{conn.updateFrequency}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{conn.description}</p>
                        {conn.availabilityNote && <p className="text-[11px] text-amber-300/90 mt-1">{conn.availabilityNote}</p>}
                      </div>
                      {conn.documentationUrl.startsWith('http') && (
                        <a
                          href={conn.documentationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-cyan-400 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-800/50 rounded-lg transition-colors"
                        >
                          Documentación
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="space-y-1.5 mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>URL DE CONSUMO:</span>
                        <span className="text-cyan-400">Formato: {conn.payloadFormat}</span>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-canvas border border-slate-800 rounded-lg font-mono text-xs text-cyan-300 overflow-x-auto">
                        <span className="select-all flex-1 whitespace-nowrap">{conn.activeUrl}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(conn.activeUrl);
                            setCopiedUrlId(conn.id);
                            setTimeout(() => setCopiedUrlId(null), 2500);
                          }}
                          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded flex items-center gap-1 shrink-0 font-sans"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{isCopied ? 'Copiado' : 'Copiar URL'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-800/70 text-xs">
                      <span className="text-[10px] text-slate-400 font-mono block mb-1">COMANDO CURL:</span>
                      <div className="font-mono text-[10px] text-slate-400 break-all select-all">{conn.sampleCurlCommand}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: RAG SEARCH */}
        {activeTab === 'RAG_STUDIO' && (
          <div className="space-y-6">
            <div className="bg-surface border border-slate-800 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2"><Search className="w-4 h-4 text-sky-400" />Búsqueda en documentos almacenados</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Busca por coincidencia de texto en environmental_rag_documents (focos FIRMS relevantes, boletines INAMEH, corpus e incidentes) y resume con IA solo lo encontrado. La tabla no tiene embeddings, así que no hay similitud vectorial.
                </p>
              </div>
              <textarea
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                rows={2}
                className="w-full bg-canvas border border-slate-700 rounded-lg p-3 text-sm text-white"
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_QUERIES.map((q) => (
                  <button key={q} onClick={() => setRagQuery(q)} className="px-2.5 py-1 text-[11px] rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700">
                    {q}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
                <label className="block">
                  <span className="text-slate-400 font-mono block mb-1">LATITUD (opcional)</span>
                  <input value={ragCenterLat} onChange={(e) => setRagCenterLat(e.target.value)} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </label>
                <label className="block">
                  <span className="text-slate-400 font-mono block mb-1">LONGITUD (opcional)</span>
                  <input value={ragCenterLng} onChange={(e) => setRagCenterLng(e.target.value)} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </label>
                <label className="block">
                  <span className="text-slate-400 font-mono block mb-1">RADIO km (0 = sin límite)</span>
                  <input type="number" min={0} value={ragRadiusKm} onChange={(e) => setRagRadiusKm(Number(e.target.value) || 0)} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </label>
                <button
                  onClick={handleExecuteRag}
                  disabled={isExecutingRag}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg disabled:opacity-50"
                >
                  <Search className={`w-4 h-4 ${isExecutingRag ? 'animate-spin' : ''}`} />
                  <span>{isExecutingRag ? 'Buscando...' : 'Buscar'}</span>
                </button>
              </div>
              {ragError && <p className="text-xs text-amber-300">{ragError}</p>}
            </div>

            {ragResult && (
              <div className="space-y-4">
                <div className="text-xs text-slate-400 font-mono">
                  {ragResult.matchesFoundCount} documentos · términos: {(ragResult.terms || []).join(', ')} · {ragResult.searchMethod}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ragResult.topMatches.map((match) => (
                    <div key={match.id} className="bg-surface border border-slate-800 rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">{match.source}</span>
                        <span className="text-[10px] font-mono text-sky-400">
                          coincidencia {Math.round(match.relevanceScore * 100)}%{match.distanceKmFromQueryTarget !== undefined ? ` · ${match.distanceKmFromQueryTarget} km` : ''}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{match.title}</h4>
                      <p className="text-[11px] text-slate-400">{match.contentSnippet}</p>
                      {match.latitude !== null && match.longitude !== null && (
                        <button onClick={() => focusOnMap(match.latitude, match.longitude)} className="text-[11px] text-sky-400 hover:underline flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Ver en el mapa
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="bg-surface border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-slate-500 block">Deforestación</span><span className="text-amber-300">{ragResult.threatMatrix.deforestationRisk}</span></div>
                    <div><span className="text-slate-500 block">Mercurio</span><span className="text-slate-300">{ragResult.threatMatrix.mercuryExposureRisk}</span></div>
                    <div><span className="text-slate-500 block">Territorio indígena</span><span className="text-slate-300">{ragResult.threatMatrix.indigenousTerritoryOverlap}</span></div>
                    <div><span className="text-slate-500 block">Zona prioritaria</span><span className="text-emerald-300">{ragResult.threatMatrix.immediateInterdictionZone}</span></div>
                  </div>
                  <pre className="whitespace-pre-wrap text-xs text-slate-200 font-sans leading-relaxed">{ragResult.synthesisMarkdown}</pre>
                  <p className="text-xs text-emerald-200 border-t border-slate-800 pt-2">{ragResult.tacticalRecommendation}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: LIVE FEED */}
        {activeTab === 'LIVE_FEED' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {([
                ['NASA_FIRMS', 'Focos FIRMS (7 días, estados monitoreados)'],
                ['SENTINEL_1', 'Escenas Sentinel-1'],
                ['SENTINEL_2', 'Escenas Sentinel-2'],
                ['SENTINEL_3', 'Productos Sentinel-3'],
                ['INAMEH', 'Estaciones INAMEH'],
                ['KOBO', 'Minutas Kobo (sesión)'],
              ] as [FeedFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFeedFilter(key)}
                  className={`px-3 py-1.5 rounded-md border ${feedFilter === key ? 'bg-sky-600 text-white border-sky-500' : 'text-slate-400 border-slate-800 hover:text-white'}`}
                >
                  {label} ({feedCounts[key]})
                </button>
              ))}
              <span className="text-slate-500 font-mono ml-auto">Datos al {formatDateTime(feed?.loadedAt)}</span>
            </div>

            <div className="bg-surface border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-xs">
                <tbody className="font-mono">
                  {feedFilter === 'NASA_FIRMS' && (feed?.hotspots || []).map((h) => (
                    <tr key={h.id} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                      <td className="p-2 text-amber-300">{h.satellite}</td>
                      <td className="p-2">{h.acqDate} {h.acqTime}</td>
                      <td className="p-2">{h.state}</td>
                      <td className="p-2">{h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}</td>
                      <td className="p-2">FRP {h.frpMw ?? 's/d'} MW</td>
                      <td className="p-2">{h.confidence}</td>
                      <td className="p-2"><button onClick={() => focusOnMap(h.latitude, h.longitude, 11)} className="text-sky-400 hover:underline">mapa</button></td>
                    </tr>
                  ))}
                  {feedFilter === 'SENTINEL_1' && (feed?.sentinel1Scenes || []).map((s) => (
                    <tr key={s.sceneId} className="border-b border-slate-800/60">
                      <td className="p-2 text-sky-300">{s.platform}</td>
                      <td className="p-2">{formatDateTime(s.acquiredAt)}</td>
                      <td className="p-2">{s.instrumentMode} · {(s.polarizations || []).join('+')}</td>
                      <td className="p-2">órbita {s.relativeOrbit} ({s.orbitState})</td>
                      <td className="p-2 truncate max-w-xs" title={s.sceneId}>{s.sceneId}</td>
                      <td className="p-2">{s.stacItemUrl && <a href={s.stacItemUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">STAC</a>}</td>
                    </tr>
                  ))}
                  {feedFilter === 'SENTINEL_2' && (feed?.sentinel2Products || []).map((p) => (
                    <tr key={p.productId} className="border-b border-slate-800/60">
                      <td className="p-2 text-emerald-300">{p.satelliteCode}</td>
                      <td className="p-2">{formatDateTime(p.sensingTime)}</td>
                      <td className="p-2">{p.tileId}</td>
                      <td className="p-2">nubes {p.cloudPixelPct ?? 's/d'}%</td>
                      <td className="p-2">{p.stacItemUrl && <a href={p.stacItemUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">STAC</a>}</td>
                    </tr>
                  ))}
                  {feedFilter === 'SENTINEL_3' && (feed?.sentinel3Products || []).map((p) => (
                    <tr key={p.productId} className="border-b border-slate-800/60">
                      <td className="p-2 text-teal-300">{p.platform} {p.instrument}</td>
                      <td className="p-2">{p.productType}</td>
                      <td className="p-2">{formatDateTime(p.sensingStart)}</td>
                      <td className="p-2 truncate max-w-md" title={p.productName}>{p.productName}</td>
                      <td className="p-2"><a href={p.odataUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">OData</a></td>
                    </tr>
                  ))}
                  {feedFilter === 'INAMEH' && (feed?.hydroStations || []).map((s) => (
                    <tr key={s.id} className="border-b border-slate-800/60">
                      <td className="p-2 text-cyan-300">{s.id}</td>
                      <td className="p-2">{s.name}</td>
                      <td className="p-2">{s.currentLevelM ?? 's/d'} msnm</td>
                      <td className="p-2">{s.readingDate ?? 's/f'}{s.isStale ? ' (desactualizado)' : ''}</td>
                      <td className="p-2">{s.status}</td>
                    </tr>
                  ))}
                  {feedFilter === 'KOBO' && koboReports.map((r) => (
                    <tr key={r.id} className="border-b border-slate-800/60">
                      <td className="p-2 text-emerald-300">{r.submissionTime}</td>
                      <td className="p-2">{r.officerName}</td>
                      <td className="p-2">{r.category}</td>
                      <td className="p-2">{r.latitude}, {r.longitude}</td>
                      <td className="p-2">{r.mercuryDetectedPpm === undefined ? 'Hg no medido' : `Hg ${r.mercuryDetectedPpm} ppm (campo)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {feedCounts[feedFilter] === 0 && (
                <p className="p-6 text-center text-xs text-slate-500">Sin registros. Ejecute la tarea correspondiente desde "Tareas programadas".</p>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SQL */}
        {activeTab === 'POSTGIS_SQL' && (
          <div className="bg-surface border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-white text-base">Migraciones SQL aplicadas</h3>
                <p className="text-xs text-slate-400">Contenido de la carpeta supabase/migrations del repositorio.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copySqlToClipboard} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold">
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copiado' : 'Copiar'}</span>
                </button>
                <button onClick={downloadSqlScript} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700">
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap bg-canvas p-4 rounded-xl border border-slate-800 text-emerald-300/90 font-mono text-xs max-h-[70vh] overflow-y-auto">{sqlScript}</pre>
          </div>
        )}

        {/* TAB 5: SENTINEL-2 CATALOG */}
        {activeTab === 'SENTINEL_S2' && (
          <div className="space-y-4">
            <div className="bg-surface border border-slate-800 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-bold text-white text-base">Catálogo Sentinel-2 L2A (últimos 4 días de ingesta)</h3>
                <p className="text-xs text-slate-400">Escenas reales del catálogo STAC de Copernicus. El análisis de bandas (NDVI, turbidez) es parte del Nivel 2.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                Nubosidad máxima
                <input type="range" min={0} max={100} step={5} value={s2MaxCloud} onChange={(e) => setS2MaxCloud(Number(e.target.value))} />
                <span className="font-mono w-10">{s2MaxCloud}%</span>
              </label>
            </div>
            <div className="bg-surface border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-500 text-left border-b border-slate-800">
                    <th className="p-2">Satélite</th>
                    <th className="p-2">Adquisición</th>
                    <th className="p-2">Cuadrante</th>
                    <th className="p-2">Nubes</th>
                    <th className="p-2">Órbita</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {s2Filtered.map((p) => (
                    <tr key={p.productId} className="border-b border-slate-800/60 hover:bg-slate-900/40">
                      <td className="p-2 text-emerald-300">{p.satelliteCode}</td>
                      <td className="p-2">{formatDateTime(p.sensingTime)}</td>
                      <td className="p-2">{p.tileId}</td>
                      <td className="p-2">{p.cloudPixelPct}%</td>
                      <td className="p-2">{p.relativeOrbit ?? 's/d'}</td>
                      <td className="p-2 flex gap-2">
                        <button onClick={() => focusOnMap(p.centerLat, p.centerLon, 8)} className="text-sky-400 hover:underline">mapa</button>
                        {p.stacItemUrl && <a href={p.stacItemUrl} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">STAC</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s2Filtered.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No hay escenas con nubosidad menor o igual a {s2MaxCloud}%.</p>}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: minuta de campo Kobo / ODK */}
      {koboModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <Smartphone className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-white text-sm">Minuta de campo (webhook Kobo / ODK)</h3>
                  <span className="text-[10px] text-slate-400 font-mono">POST a /api/webhooks/kobo</span>
                </div>
              </div>
              <button onClick={() => setKoboModalOpen(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleDispatchKoboWebhook} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-slate-400 font-mono mb-1">OFICIAL:</span>
                  <input type="text" value={webhookOfficer} onChange={(e) => setWebhookOfficer(e.target.value)} required className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white" />
                </label>
                <label className="block">
                  <span className="block text-slate-400 font-mono mb-1">UNIDAD:</span>
                  <input type="text" value={webhookUnit} onChange={(e) => setWebhookUnit(e.target.value)} required className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white" />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="block sm:col-span-2">
                  <span className="block text-slate-400 font-mono mb-1">RÍO / SECTOR:</span>
                  <input type="text" value={webhookRiver} onChange={(e) => setWebhookRiver(e.target.value)} required className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white" />
                </label>
                <label className="block">
                  <span className="block text-slate-400 font-mono mb-1">LATITUD:</span>
                  <input type="text" value={webhookLat} onChange={(e) => setWebhookLat(e.target.value)} required className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </label>
                <label className="block">
                  <span className="block text-slate-400 font-mono mb-1">LONGITUD:</span>
                  <input type="text" value={webhookLng} onChange={(e) => setWebhookLng(e.target.value)} required className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </label>
              </div>

              <label className="block">
                <span className="block text-slate-400 font-mono mb-1">CATEGORÍA:</span>
                <select value={webhookCategory} onChange={(e) => setWebhookCategory(e.target.value as KoboFieldPatrolReport['category'])} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white">
                  <option value="MINERIA_ILEGAL">Minería ilegal</option>
                  <option value="DEFORESTACION">Deforestación</option>
                  <option value="CONTAMINACION_MERCURIO">Contaminación por mercurio</option>
                  <option value="PISTA_CLANDESTINA">Pista clandestina</option>
                  <option value="PATRULLAJE_DE_RUTINA">Patrullaje de rutina</option>
                </select>
              </label>

              <div>
                <span className="block text-slate-400 font-mono mb-1">MEDICIONES DE CAMPO (opcionales, solo si se midieron):</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="number" step="0.001" placeholder="Mercurio (ppm)" value={webhookMercury} onChange={(e) => setWebhookMercury(e.target.value)} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                  <input type="number" step="0.1" placeholder="Turbidez (NTU)" value={webhookTurbidity} onChange={(e) => setWebhookTurbidity(e.target.value)} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                  <input type="number" placeholder="Dragas retenidas" value={webhookDredges} onChange={(e) => setWebhookDredges(e.target.value)} className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white font-mono" />
                </div>
              </div>

              <label className="block">
                <span className="block text-slate-400 font-mono mb-1">NARRATIVA:</span>
                <textarea rows={3} value={webhookNarrative} onChange={(e) => setWebhookNarrative(e.target.value)} required className="w-full bg-canvas border border-slate-700 rounded-lg p-2 text-white text-xs" />
              </label>

              {koboError && <p className="text-amber-300">{koboError}</p>}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button type="button" onClick={() => setKoboModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={isSendingWebhook} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center gap-2 shadow disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingWebhook ? 'Enviando...' : 'Enviar minuta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
