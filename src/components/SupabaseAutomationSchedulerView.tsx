import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Satellite, 
  Radar, 
  Flame, 
  Database, 
  Terminal, 
  Play, 
  Pause, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  FileText, 
  Sparkles, 
  Droplets, 
  Layers, 
  ExternalLink, 
  Zap,
  Radio,
  ArrowRight,
  ShieldAlert,
  Cpu
} from 'lucide-react';
import { 
  SatelliteScheduledTask, 
  SchedulerLogEntry, 
  SchedulerStatusResponse 
} from '../types';
import { LivePipelineService } from '../services/liveDataPipelineService';

interface SupabaseAutomationSchedulerViewProps {
  onNavigateToRag?: () => void;
  onNavigateToSql?: () => void;
}

export const SupabaseAutomationSchedulerView: React.FC<SupabaseAutomationSchedulerViewProps> = ({
  onNavigateToRag,
  onNavigateToSql
}) => {
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [triggeringTaskKey, setTriggeringTaskKey] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [sqlScript, setSqlScript] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [triggerFeedback, setTriggerFeedback] = useState<Record<string, { ok: boolean; message: string }>>({});

  // Cargar estado inicial y refrescar cada segundo
  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const data = await LivePipelineService.getSchedulerStatus();
        if (isMounted) {
          setSchedulerStatus(data);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Error fetching scheduler status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);

    // Cargar script SQL
    LivePipelineService.getAutomationSql()
      .then(sql => { if (isMounted) setSqlScript(sql); })
      .catch(err => { if (isMounted) setSqlScript(`-- No se pudo cargar el SQL: ${err?.message || err}`); });

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleTriggerManual = async (taskKey: string) => {
    setTriggeringTaskKey(taskKey);
    try {
      const result = await LivePipelineService.triggerScheduledTask(taskKey);
      setTriggerFeedback(prev => ({ ...prev, [taskKey]: { ok: result.success, message: result.message } }));
      const updated = await LivePipelineService.getSchedulerStatus();
      setSchedulerStatus(updated);
    } catch (e: any) {
      setTriggerFeedback(prev => ({ ...prev, [taskKey]: { ok: false, message: e?.message || String(e) } }));
    } finally {
      setTriggeringTaskKey(null);
    }
  };

  const handleToggleRunning = async () => {
    try {
      const res = await LivePipelineService.toggleSchedulerRunning();
      setSchedulerStatus(prev => prev ? { ...prev, isRunning: res.isRunning } : null);
    } catch (e) {
      console.warn('Error toggling scheduler:', e);
    }
  };

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return 'En el próximo ciclo';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getSatelliteIcon = (key: string) => {
    switch (key) {
      case 'NASA_FIRMS':
        return <Flame className="w-5 h-5 text-amber-400" />;
      case 'SENTINEL_1_SAR':
        return <Radar className="w-5 h-5 text-sky-400" />;
      case 'SENTINEL_2_MSI':
        return <Satellite className="w-5 h-5 text-emerald-400" />;
      case 'SENTINEL_3_OLCI':
        return <Layers className="w-5 h-5 text-teal-400" />;
      case 'HYDRO_TELEMETRY':
        return <Droplets className="w-5 h-5 text-cyan-400" />;
      default:
        return <Radio className="w-5 h-5 text-violet-400" />;
    }
  };

  const getSatelliteBadgeColor = (key: string) => {
    switch (key) {
      case 'NASA_FIRMS':
        return 'bg-amber-950/80 text-amber-300 border-amber-800';
      case 'SENTINEL_1_SAR':
        return 'bg-sky-950/80 text-sky-300 border-sky-800';
      case 'SENTINEL_2_MSI':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
      case 'SENTINEL_3_OLCI':
        return 'bg-teal-950/80 text-teal-300 border-teal-800';
      case 'HYDRO_TELEMETRY':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
      default:
        return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };


  const technicalReportText = `# INFORME TÉCNICO: INGESTA AUTOMATIZADA DE DATOS SATELITALES E HIDROLÓGICOS
**Sistema "Centinela Orinoco"** · Generado: ${new Date().toLocaleDateString('es-VE')}

## 1. Fuentes y tareas programadas
| Tarea | Fuente | Frecuencia | Tabla en Supabase | Registros |
| :--- | :--- | :--- | :--- | :--- |
${(schedulerStatus?.activeTasks || []).map(t => `| ${t.name} | ${t.agency} | ${t.nominalCadenceText} | \`${t.supabaseTable}\` | ${t.totalIngested} |`).join('\n')}

## 2. Flujo de datos
1. **Planificador** en el servidor Node.js. Como AI Studio (Cloud Run) apaga la instancia sin tráfico, un cron externo llama a \`POST /api/scheduler/run-due\` con el token de ingesta.
2. **Conectores**: NASA FIRMS (CSV por área), Copernicus Sentinel-1/2 (STAC), Sentinel-3 (OData) e INAMEH (PDF del boletín). Las URLs salen del directorio de conexiones.
3. **Sin duplicados**: antes de insertar se consultan las claves existentes y se envían solo las nuevas; los índices únicos de cada tabla rechazan cualquier repetido.
4. **Supabase**: tablas por fuente (\`nasa_firms_hotspots\`, \`sentinel1_scenes\`, \`s2_product_tile\`, \`sentinel3_products\`, \`hydrological_telemetry_readings\`) y documentos de texto en \`environmental_rag_documents\` para los focos relevantes y las lecturas de INAMEH. Cada ejecución queda en \`ingestion_runs\`.
5. **Consumo**: el mapa (RPCs), el análisis de zonas, el boletín y el chat usan solo estos registros.

## 3. Limitaciones actuales
- Los catálogos Copernicus registran escenas, no detecciones. Turbidez (Nechad), NDVI y perturbaciones SAR requieren procesar píxeles (Nivel 2, con credenciales de Copernicus).
- Turbidez, pH, conductividad y mercurio no se miden: INAMEH publica solo el nivel y no son observables desde satélite.
- La búsqueda RAG es por coincidencia de texto: la tabla de documentos no tiene embeddings.`;

  return (
    <div className="flex-1 bg-canvas text-slate-200 overflow-y-auto p-6 flex flex-col gap-6">
      {/* Top Banner with Status, Modes and Controls */}
      <div className="bg-surface p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shadow-lg shadow-violet-950/50">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Orquestador de Ingesta Satelital Automatizada
                  </h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                    schedulerStatus?.isRunning 
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                      : 'bg-amber-950 text-amber-300 border-amber-700'
                  }`}>
                    {schedulerStatus?.isRunning ? 'PLANIFICADOR ACTIVO' : 'PAUSADO'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-violet-950 text-violet-300 border border-violet-800">
                    DATOS REALES · SIN DUPLICADOS
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  NASA FIRMS, Copernicus Sentinel-1/2/3 e INAMEH. Solo se insertan registros nuevos en Supabase.
                </p>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleToggleRunning}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                schedulerStatus?.isRunning
                  ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500'
              }`}
            >
              {schedulerStatus?.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{schedulerStatus?.isRunning ? 'Pausar Scheduler' : 'Reanudar Scheduler'}</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-violet-950/40 transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ver Informe Técnico</span>
            </button>

            <button
              onClick={() => setShowSqlModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all"
            >
              <Database className="w-3.5 h-3.5 text-sky-400" />
              <span>Migraciones SQL</span>
            </button>
          </div>
        </div>

        {/* Supabase Connection State Banner */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Destino Supabase:</span>
            <span className={`px-2 py-0.5 rounded font-semibold border ${
              schedulerStatus?.supabaseConnected 
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                : 'bg-indigo-950 text-indigo-300 border-indigo-800'
            }`}>
              {schedulerStatus?.supabaseConnected ? 'CONFIGURADO' : 'SUPABASE NO CONFIGURADO'}
            </span>
            <span className="text-slate-500 truncate max-w-xs">{schedulerStatus?.supabaseHost}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <div>
              <span className="text-slate-500 mr-1">Registros almacenados:</span>
              <span className="font-bold text-sky-400">{schedulerStatus?.totalSatelliteEventsIngested || 0}</span>
            </div>
            <div>
              <span className="text-slate-500 mr-1">Documentos RAG:</span>
              <span className="font-bold text-violet-400">{schedulerStatus?.vectorRagDocsCount || 0} docs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Scheduled Tasks for each Satellite */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Satellite className="w-4 h-4 text-sky-400" />
            <span>Tareas de ingesta programadas</span>
          </h3>
          <span className="text-xs text-slate-400">
            Ejecución manual: mínimo 15 min entre ejecuciones de la misma tarea
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {schedulerStatus?.activeTasks.map((task) => {
            const isTriggering = triggeringTaskKey === task.key;
            const progressPct = task.intervalSeconds > 0 
              ? Math.max(0, Math.min(100, Math.round(((task.intervalSeconds - task.countdownSeconds) / task.intervalSeconds) * 100)))
              : 100;

            return (
              <div 
                key={task.key}
                className="bg-surface rounded-xl border border-slate-800 p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      {getSatelliteIcon(task.key)}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getSatelliteBadgeColor(task.key)}`}>
                      {task.nominalCadenceText}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-3 group-hover:text-sky-300 transition-colors">
                    {task.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {task.satelliteMission}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Agencia: {task.agency}
                  </p>

                  {/* Countdown Timer */}
                  <div className="mt-4 p-2.5 rounded-lg bg-canvas border border-slate-800/80">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Próxima Ingesta:
                      </span>
                      <span className="font-mono font-bold text-white">
                        {formatCountdown(task.countdownSeconds)}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-sky-500 h-full transition-all duration-1000"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1.5">
                      <span>Progreso: {progressPct}%</span>
                      <span>Tabla: {task.supabaseTable.replace('public.', '')}</span>
                    </div>
                  </div>

                  {/* Metrics and Status */}
                  <div className="mt-3 flex items-center justify-between text-xs border-t border-slate-800/60 pt-2 font-mono">
                    <span className="text-slate-400">En la tabla:</span>
                    <span className="font-bold text-emerald-400">{task.totalIngested} registros</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-500">Última ejecución:</span>
                    <span className="text-slate-300">
                      {task.lastInserted === null ? 'sin ejecutar' : `${task.lastInserted} nuevos · ${task.lastSkipped} omitidos`}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 font-mono">
                    {task.lastRunAt ? new Date(task.lastRunAt).toLocaleString('es-VE') : '—'}
                  </div>

                  <div className={`mt-1 text-[10px] truncate ${task.status === 'ERROR' ? 'text-red-400' : 'text-slate-400'}`} title={task.lastMessage}>
                    <span className="text-slate-500">Detalle:</span> {task.lastMessage || 'Pendiente'}
                  </div>
                  {task.endpointUrl && (
                    <div className="mt-1 text-[10px] text-slate-500 font-mono truncate" title={task.endpointUrl}>
                      URL: {task.endpointUrl}
                    </div>
                  )}
                  {triggerFeedback[task.key] && (
                    <div className={`mt-2 text-[10px] p-1.5 rounded border ${triggerFeedback[task.key].ok ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800' : 'bg-amber-950/50 text-amber-300 border-amber-800'}`}>
                      {triggerFeedback[task.key].message}
                    </div>
                  )}
                </div>

                {/* Trigger Button */}
                <div className="mt-4 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => handleTriggerManual(task.key)}
                    disabled={isTriggering}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 text-amber-400 ${isTriggering ? 'animate-spin' : ''}`} />
                    <span>{isTriggering ? 'Consultando la fuente...' : 'Ejecutar ahora'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Step-by-Step Architecture Diagram */}
      <div className="bg-surface rounded-xl border border-slate-800 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-400" />
              <span>Flujo de ingesta hacia Supabase</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cómo las tareas programadas guardan datos reales sin duplicados
            </p>
          </div>
          <button
            onClick={() => onNavigateToRag && onNavigateToRag()}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-950/40 px-3 py-1 rounded border border-sky-800/60 transition-all"
          >
            <span>Explorar RAG Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Step 1 */}
          <div className="p-3.5 rounded-lg bg-canvas border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center mb-2">
                1
              </div>
              <h5 className="text-xs font-bold text-white">Planificador + cron</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                FIRMS cada 3 h, INAMEH cada 6 h, Sentinel-1 cada 12 h, Sentinel-2 y 3 cada 24 h. Un cron externo cubre los periodos sin tráfico.
              </p>
            </div>
            <span className="text-[10px] font-mono text-amber-400/80 mt-2">/api/scheduler/run-due</span>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-lg bg-canvas border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-md bg-sky-500/20 text-sky-400 font-mono font-bold text-xs flex items-center justify-center mb-2">
                2
              </div>
              <h5 className="text-xs font-bold text-white">Conectores</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                CSV de FIRMS, catálogos STAC/OData de Copernicus y PDF del boletín INAMEH, con las URLs del directorio.
              </p>
            </div>
            <span className="text-[10px] font-mono text-sky-400/80 mt-2">server/ingestion</span>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-lg bg-canvas border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center mb-2">
                3
              </div>
              <h5 className="text-xs font-bold text-white">Sin duplicados</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Se consultan las claves existentes y se envían solo las nuevas; los índices únicos rechazan cualquier repetido.
              </p>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/80 mt-2">ON CONFLICT DO NOTHING</span>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-lg bg-canvas border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-md bg-violet-500/20 text-violet-400 font-mono font-bold text-xs flex items-center justify-center mb-2">
                4
              </div>
              <h5 className="text-xs font-bold text-white">Supabase</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Tablas por fuente con geometría PostGIS, documentos de texto para la IA y registro de cada ejecución.
              </p>
            </div>
            <span className="text-[10px] font-mono text-violet-400/80 mt-2">ingestion_runs</span>
          </div>

          {/* Step 5 */}
          <div className="p-3.5 rounded-lg bg-canvas border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-md bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center mb-2">
                5
              </div>
              <h5 className="text-xs font-bold text-white">Consumo</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Mapa (RPCs), análisis de zonas, boletín y chat usan solo estos registros. La búsqueda RAG es por texto.
              </p>
            </div>
            <span className="text-[10px] font-mono text-cyan-400/80 mt-2">Gemini + datos reales</span>
          </div>
        </div>
      </div>

      {/* Live Scheduler Logs Console */}
      <div className="bg-surface rounded-xl border border-slate-800 p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Últimas ejecuciones del planificador</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {schedulerStatus?.recentLogs.length || 0} registros (tabla ingestion_runs)
          </span>
        </div>

        <div className="bg-canvas rounded-lg border border-slate-800/80 p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1.5">
          {schedulerStatus?.recentLogs && schedulerStatus.recentLogs.length > 0 ? (
            schedulerStatus.recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 text-slate-300 border-b border-slate-900/60 pb-1">
                <span className="text-slate-500 shrink-0">[{new Date(log.timestamp).toLocaleString('es-VE')}]</span>
                <span className={`px-1 rounded text-[10px] shrink-0 font-semibold ${
                  log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  log.status === 'ERROR' ? 'bg-red-950 text-red-400 border border-red-800' :
                  log.status === 'WARNING' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                  'bg-sky-950 text-sky-400 border border-sky-800'
                }`}>
                  {log.taskKey}
                </span>
                <span className="text-slate-200 flex-1">{log.message}</span>
                {log.supabaseSynced && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1 rounded border border-emerald-800/40">
                    GUARDADO
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic text-center py-4">
              Sin ejecuciones registradas todavía.
            </div>
          )}
        </div>
      </div>

      {/* Technical Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-canvas">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-bold text-white">
                  Informe técnico: ingesta automatizada
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(technicalReportText);
                    setCopiedReport(true);
                    setTimeout(() => setCopiedReport(false), 2000);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-all"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedReport ? 'Copiado' : 'Copiar Informe'}</span>
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto font-sans text-sm text-slate-200 leading-relaxed space-y-4">
              <pre className="font-mono text-xs whitespace-pre-wrap bg-canvas p-4 rounded-xl border border-slate-800 text-slate-300 select-text">
                {technicalReportText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SQL Supabase Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-canvas">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-sky-400" />
                <h3 className="text-base font-bold text-white">
                  Migraciones SQL aplicadas en Supabase
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sqlScript);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-all"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'Copiado' : 'Copiar SQL'}</span>
                </button>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-200">
              <pre className="whitespace-pre-wrap bg-canvas p-4 rounded-xl border border-slate-800 text-emerald-300/90 select-text">
                {sqlScript}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
