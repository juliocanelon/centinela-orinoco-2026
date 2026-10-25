import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Terminal, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Code, 
  Copy, 
  Check, 
  RefreshCw,
  Server,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  ExternalLink,
  X
} from 'lucide-react';
import { isSupabaseConfigured, supabase, supabaseUrl } from '../lib/supabaseClient';
import { LivePipelineService } from '../services/liveDataPipelineService';

interface RpcDefinition {
  name: string;
  description: string;
  returnType: string;
  defaultParams: Record<string, any>;
}

const RPC_DEFINITIONS: RpcDefinition[] = [
  {
    name: 'get_heat_anomalies_geojson',
    description: 'Focos de calor NASA FIRMS (VIIRS / MODIS) de los últimos 7 días, desde public.nasa_firms_hotspots',
    returnType: 'JSON (GeoJSON FeatureCollection de puntos)',
    defaultParams: {
      p_min_confidence: 'nominal',
      p_limit: 50,
    },
  },
  {
    name: 'get_mining_clusters_geojson',
    description: 'Perturbaciones medidas por radar Sentinel-1 (public.copernicus_sar_disturbances). Vacío hasta el Nivel 2',
    returnType: 'JSON (GeoJSON FeatureCollection de puntos)',
    defaultParams: {
      p_basin_id: null,
      p_min_severity: 'LOW',
    },
  },
  {
    name: 'get_hydrological_telemetry',
    description: 'Estaciones INAMEH del Orinoco con el nivel (msnm), variación y cota de desborde de su último boletín',
    returnType: 'JSON[] (estaciones)',
    defaultParams: {
      p_station_id: null,
      p_hours: 24,
    },
  },
  {
    name: 'get_protected_areas_geojson',
    description: 'Polígonos de áreas protegidas (aún sin cargar en la base: devuelve una colección vacía)',
    returnType: 'JSON (GeoJSON FeatureCollection)',
    defaultParams: {},
  },
  {
    name: 'calculate_basin_risk_index',
    description: 'Conteos reales de focos FIRMS (7 días) y perturbaciones SAR por estado. El índice compuesto requiere el Nivel 2',
    returnType: 'JSON { riskScore: null, note, breakdown: { firms_hotspots_7d, firms_high_confidence_7d, sar_disturbances } }',
    defaultParams: {
      p_basin_id: 'Bolívar',
    },
  },
  {
    name: 'register_incident_report',
    description: 'Inserta un nuevo incidente en la base de datos PostgreSQL y despacha alerta a la sala de situación',
    returnType: 'JSON { success: boolean, incident_id: string }',
    defaultParams: {
      p_title: 'Detección balsa minera en Río Ventuari',
      p_category: 'MINERIA_ILEGAL',
      p_severity: 'HIGH',
      p_lat: 4.882,
      p_lng: -65.221,
      p_description: 'Reporte satelital SAR con balsa de aluvión activa.',
      p_reported_by: 'Centinela SAR Satelital',
    },
  },
];

export const SupabaseRpcConsole: React.FC = () => {
  const [selectedRpc, setSelectedRpc] = useState<RpcDefinition>(RPC_DEFINITIONS[0]);
  const [paramsInput, setParamsInput] = useState<string>(JSON.stringify(RPC_DEFINITIONS[0].defaultParams, null, 2));
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionStatus, setExecutionStatus] = useState<'idle' | 'running' | 'success' | 'warning' | 'error'>('idle');
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlScript, setSqlScript] = useState<string>('');

  // Diagnostic state
  const [liveStatus, setLiveStatus] = useState<{
    connected: boolean;
    host: string | null;
    authStatus: string;
    authMessage?: string;
    tables?: Record<string, boolean>;
    rpcReady?: boolean;
    checking: boolean;
  }>({
    connected: isSupabaseConfigured,
    host: supabaseUrl ? new URL(supabaseUrl).hostname : null,
    authStatus: isSupabaseConfigured ? 'VALID_AUTHENTICATED' : 'LOCAL_MODE',
    checking: false
  });

  // Verify live connection on mount
  const checkLiveConnection = async () => {
    setLiveStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const data = await res.json();
        setLiveStatus({
          connected: Boolean(data.connected),
          host: data.host,
          authStatus: data.authStatus || (data.connected ? 'VALID_AUTHENTICATED' : 'ERROR'),
          authMessage: data.authMessage,
          tables: data.tables,
          rpcReady: data.rpcReady,
          checking: false
        });
      } else {
        setLiveStatus(prev => ({ ...prev, checking: false }));
      }
    } catch {
      setLiveStatus(prev => ({ ...prev, checking: false }));
    }
  };

  useEffect(() => {
    checkLiveConnection();
    LivePipelineService.getAutomationSql().then(sql => setSqlScript(sql));
  }, []);

  // Switch RPC
  const handleSelectRpc = (rpc: RpcDefinition) => {
    setSelectedRpc(rpc);
    setParamsInput(JSON.stringify(rpc.defaultParams, null, 2));
    setExecutionResult(null);
    setExecutionStatus('idle');
  };

  // Run RPC Test with backend proxy & client fallback
  const handleExecuteRpc = async () => {
    setExecutionStatus('running');
    const start = performance.now();

    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(paramsInput);
      } catch (err) {
        throw new Error('Parámetros JSON no válidos.');
      }

      // Try server-side RPC proxy first to guarantee no CORS/iframe network restrictions
      try {
        const proxyRes = await fetch('/api/supabase/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rpcName: selectedRpc.name,
            params: parsedParams
          })
        });

        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          const elapsed = Math.round(performance.now() - start);
          setExecutionTime(elapsed);

          if (proxyData.success && proxyData.data) {
            setExecutionResult(proxyData.data);
            setExecutionStatus('success');
            return;
          }

          if (proxyData.needsSqlMigration) {
            // Function not yet created in PostgreSQL (PGRST202), but credentials are 100% valid!
            setExecutionResult({
              database_status: "CONEXIÓN AUTENTICADA Y ACTIVA",
              host: proxyData.host || liveStatus.host || "ftnmwfugfcoldllkompp.supabase.co",
              autenticacion: "VÁLIDA (API Keys aceptadas por el API Gateway)",
              rpc_status: "FUNCIÓN PENDIENTE EN POSTGRESQL (PGRST202)",
              mensaje: `La conexión con Supabase es completamente válida. Sin embargo, la función stored procedure '${selectedRpc.name}' aún no ha sido creada en la base de datos PostgreSQL.`,
              solucion: "Aplique las migraciones de la carpeta supabase/migrations (botón 'Ver Script SQL') en el SQL Editor de Supabase."
            });
            setExecutionStatus('warning');
            return;
          }
        }
      } catch (proxyErr) {
        console.warn('Proxy RPC warning, evaluando cliente directo:', proxyErr);
      }

      // Fallback to client-side supabase if available
      if (supabase) {
        const { data, error } = await supabase.rpc(selectedRpc.name, parsedParams);
        const elapsed = Math.round(performance.now() - start);
        setExecutionTime(elapsed);

        if (error) {
          if (error.code === 'PGRST202' || error.message.includes('not found')) {
            setExecutionResult({
              database_status: "CONEXIÓN AUTENTICADA Y ACTIVA",
              host: liveStatus.host || "ftnmwfugfcoldllkompp.supabase.co",
              autenticacion: "VÁLIDA",
              rpc_status: "FUNCIÓN PENDIENTE EN POSTGRESQL",
              mensaje: `La función '${selectedRpc.name}' no está compilada aún en PostgreSQL.`
            });
            setExecutionStatus('warning');
          } else {
            setExecutionResult({ error: error.message, details: error.details, hint: error.hint });
            setExecutionStatus('error');
          }
        } else {
          setExecutionResult(data);
          setExecutionStatus('success');
        }
      } else {
        // Sin Supabase no hay datos que mostrar (no se emulan respuestas).
        setExecutionTime(Math.round(performance.now() - start));
        setExecutionResult({ error: 'Supabase no está configurado en este navegador ni en el servidor.' });
        setExecutionStatus('error');
      }
    } catch (err: any) {
      setExecutionTime(Math.round(performance.now() - start));
      setExecutionResult({
        error: err.message,
        hint: "Verifique que el servidor backend esté corriendo y que la función esté creada en Supabase."
      });
      setExecutionStatus('error');
    }
  };

  const handleCopyResult = () => {
    if (!executionResult) return;
    navigator.clipboard.writeText(JSON.stringify(executionResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySql = () => {
    if (!sqlScript) return;
    navigator.clipboard.writeText(sqlScript);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      {/* Status Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 pb-5 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            <h2 className="font-display text-xl font-semibold text-white">
              Inspector de Funciones Almacenadas (RPCs) PostgreSQL / Supabase
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Test bench interactivo y validación de endpoints GeoJSON compilados en la base de datos
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-canvas border border-slate-800 text-xs">
            <span className={`w-2 h-2 rounded-full ${liveStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-slate-400">Estado:</span>
            <strong className={liveStatus.connected ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
              {liveStatus.connected ? 'Postgres en vivo, autenticado' : 'Modo local de contingencia'}
            </strong>
            {liveStatus.host && (
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                ({liveStatus.host})
              </span>
            )}
          </div>

          <button
            onClick={checkLiveConnection}
            disabled={liveStatus.checking}
            title="Verificar conexión en vivo con Supabase"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-canvas hover:bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${liveStatus.checking ? 'animate-spin' : ''}`} />
            <span>{liveStatus.checking ? 'Verificando...' : 'Verificar Conexión'}</span>
          </button>

          <button
            onClick={() => setShowSqlModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 border border-sky-800 text-xs text-sky-300 hover:text-white transition-colors cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span>Ver Script SQL Supabase</span>
          </button>
        </div>
      </div>

      {/* Main Grid: RPC List & Interactive Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: RPC List */}
        <div className="lg:col-span-1 space-y-2">
          <label className="text-[10px] text-slate-400 block px-1">
            RPCs Compiladas en PostgreSQL ({RPC_DEFINITIONS.length})
          </label>

          {RPC_DEFINITIONS.map((rpc) => {
            const isSelected = selectedRpc.name === rpc.name;
            return (
              <div
                key={rpc.name}
                onClick={() => handleSelectRpc(rpc)}
                className={`cursor-pointer p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-raised border-sky-500/80 shadow-md shadow-sky-950/40'
                    : 'bg-surface border-slate-800/80 hover:border-slate-700 hover:bg-surface'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    <code className="text-xs font-bold text-white font-mono">{rpc.name}</code>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300">
                    RPC
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{rpc.description}</p>
                <div className="mt-2 text-[10px] font-mono text-slate-500">
                  Retorna: <span className="text-emerald-400">{rpc.returnType}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Interactive Execution Panel */}
        <div className="lg:col-span-2 bg-surface border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-bold text-sky-400 font-mono">
                  rpc/{selectedRpc.name}()
                </code>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedRpc.description}</p>
            </div>

            <button
              onClick={handleExecuteRpc}
              disabled={executionStatus === 'running'}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-950/50 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{executionStatus === 'running' ? 'Ejecutando RPC...' : 'Ejecutar en Postgres'}</span>
            </button>
          </div>

          {/* Parameters Editor */}
          <div>
            <label className="text-xs text-slate-300 block mb-1.5 font-semibold">
              Parámetros de Entrada (JSON Object)
            </label>
            <textarea
              rows={4}
              value={paramsInput}
              onChange={(e) => setParamsInput(e.target.value)}
              className="w-full bg-canvas border border-slate-800 rounded-lg p-3 sm:p-3.5 text-xs sm:text-sm md:text-base font-mono text-sky-300 outline-none focus:border-sky-500 resize-y transition-colors"
            />
          </div>

          {/* Output Console */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-[10px] text-slate-400">
                  Respuesta GeoJSON / SQL Output
                </label>
                {executionStatus === 'success' && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    200 OK ({executionTime}ms)
                  </span>
                )}
                {executionStatus === 'warning' && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Autenticado; RPC pendiente en Supabase ({executionTime}ms)
                  </span>
                )}
                {executionStatus === 'error' && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                    <XCircle className="w-3 h-3" />
                    ERROR ({executionTime}ms)
                  </span>
                )}
              </div>

              {executionResult && (
                <button
                  onClick={handleCopyResult}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar JSON'}</span>
                </button>
              )}
            </div>

            <div className="w-full h-80 bg-canvas border border-slate-800 rounded-lg p-3 font-mono text-xs overflow-auto text-slate-300">
              {executionResult ? (
                <pre className="text-[11px] leading-relaxed">
                  {JSON.stringify(executionResult, null, 2)}
                </pre>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  Haga clic en &quot;Ejecutar en Postgres&quot; para enviar la llamada RPC.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
          <div className="my-auto bg-surface border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm sm:text-base">
                  Script SQL de Funciones Almacenadas (RPCs) y Tablas Supabase
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  {sqlCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{sqlCopied ? '¡Copiado!' : 'Copiar Script SQL'}</span>
                </button>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 bg-canvas border-b border-slate-800 text-xs text-slate-300 space-y-1">
              <p>
                <strong>Instrucciones:</strong> Copie este script, ábralo en la consola de Supabase (<strong>SQL Editor &gt; New Query</strong>) y haga clic en <strong>RUN</strong>.
              </p>
              <p className="text-slate-400">
                Esto compilará las 6 funciones RPC (<code className="text-sky-300 font-mono">get_mining_clusters_geojson</code>, <code className="text-sky-300 font-mono">get_heat_anomalies_geojson</code>, etc.) y las tablas con soporte PostGIS y pgvector.
              </p>
            </div>

            <div className="p-4 overflow-auto flex-1 font-mono text-xs bg-canvas text-sky-200">
              <pre className="whitespace-pre">{sqlScript}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

