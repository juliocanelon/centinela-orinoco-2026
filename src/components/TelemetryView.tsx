import React, { useEffect, useState } from 'react';
import {
  Droplets,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Waves,
  FlaskConical,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { HydrologicalStation } from '../types';

interface TelemetryViewProps {
  stations: HydrologicalStation[];
  onRefresh: () => void;
  onSelectStationOnMap?: (station: HydrologicalStation) => void;
}

interface HydroReading {
  station_code: string;
  reading_date: string;
  level_msnm: number;
  daily_change_m: number | null;
  trend: string | null;
  alert_status: string;
  is_stale: boolean;
}

const STATUS_LABELS: Record<HydrologicalStation['status'], string> = {
  OPTIMAL: 'Normal',
  ELEVATED: 'A menos de 2 m del desborde',
  ALERT_CRECIDA: 'Sobre la cota de desborde',
  SIN_REFERENCIA: 'Sin cota de referencia',
};

function statusClass(status: HydrologicalStation['status']): string {
  if (status === 'ALERT_CRECIDA') return 'bg-red-950 text-red-300 border border-red-800';
  if (status === 'ELEVATED') return 'bg-amber-950 text-amber-300 border border-amber-800';
  if (status === 'SIN_REFERENCIA') return 'bg-slate-900 text-slate-400 border border-slate-700';
  return 'bg-emerald-950 text-emerald-300 border border-emerald-800';
}

function TrendIcon({ change }: { change: number | null }) {
  if (change === null) return null;
  if (change > 0) return <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />;
  if (change < 0) return <ArrowDownRight className="w-3.5 h-3.5 text-sky-400" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

const formatLevel = (value: number | null) => (value === null ? 's/d' : `${value.toFixed(2)} msnm`);
const formatChange = (value: number | null) => (value === null ? 's/d' : `${value > 0 ? '+' : ''}${value.toFixed(2)} m`);

/**
 * Posición del nivel actual entre el mínimo y el máximo históricos publicados por INAMEH (0-100 %).
 */
function levelPercentage(station: HydrologicalStation): number | null {
  const { currentLevelM, historicalMinM, historicalMaxM } = station;
  if (currentLevelM === null || historicalMinM === null || historicalMaxM === null || historicalMaxM <= historicalMinM) return null;
  return Math.min(100, Math.max(0, ((currentLevelM - historicalMinM) / (historicalMaxM - historicalMinM)) * 100));
}

export const TelemetryView: React.FC<TelemetryViewProps> = ({
  stations,
  onRefresh,
  onSelectStationOnMap,
}) => {
  const [activeStationId, setActiveStationId] = useState<string>(stations[0]?.id || '');
  const [readings, setReadings] = useState<HydroReading[]>([]);
  const [readingsError, setReadingsError] = useState<string | null>(null);

  const currentStation = stations.find((s) => s.id === activeStationId) || stations[0];

  useEffect(() => {
    if (!currentStation) return;
    setReadingsError(null);
    fetch(`/api/telemetry/readings?stationCode=${encodeURIComponent(currentStation.id)}&limit=30`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setReadings(body.readings || []);
      })
      .catch((err) => {
        setReadings([]);
        setReadingsError(err?.message || String(err));
      });
  }, [currentStation?.id]);

  const overflowPct = currentStation && currentStation.overflowLevelM !== null && currentStation.historicalMinM !== null && currentStation.historicalMaxM !== null
    ? Math.min(100, Math.max(0, ((currentStation.overflowLevelM - currentStation.historicalMinM) / (currentStation.historicalMaxM - currentStation.historicalMinM)) * 100))
    : null;
  const pct = currentStation ? levelPercentage(currentStation) : null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-[#0b121c] p-4 rounded-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              Nivel del Río Orinoco (INAMEH)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Boletines diarios de las estaciones Puerto Ayacucho, Caicara, Ciudad Bolívar y Palúa
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
          <span>Actualizar</span>
        </button>
      </div>

      {stations.length === 0 && (
        <div className="bg-[#0b121c] border border-slate-800 rounded-xl p-6 text-sm text-slate-400">
          No hay lecturas de INAMEH cargadas. La tarea "Niveles del Río Orinoco" del planificador las obtiene de los boletines publicados.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Detailed Station Inspector */}
        {currentStation && (
          <div className="lg:col-span-1 bg-[#0b121c] border border-slate-800 rounded-xl p-5 space-y-5 shadow-xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase text-sky-400 tracking-wider">
                  Estación {currentStation.id} · {currentStation.state}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">{currentStation.name}</h3>
                <p className="text-xs text-slate-400">{currentStation.river}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold text-right ${statusClass(currentStation.status)}`}>
                {STATUS_LABELS[currentStation.status]}
              </span>
            </div>

            {currentStation.isStale && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/60 border border-amber-800 text-[11px] text-amber-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>INAMEH no ha actualizado el boletín de esta estación desde el {currentStation.readingDate ?? 'sin fecha'}.</span>
              </div>
            )}

            {/* Level */}
            <div className="bg-[#070b10] p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Waves className="w-4 h-4 text-sky-400" />
                  Nivel ({currentStation.readingDate ?? 'sin fecha'})
                </span>
                <span className="text-lg font-bold font-mono text-sky-400">
                  {formatLevel(currentStation.currentLevelM)}
                </span>
              </div>

              {pct !== null && (
                <div className="relative w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${currentStation.status === 'OPTIMAL' || currentStation.status === 'SIN_REFERENCIA' ? 'bg-gradient-to-r from-sky-600 to-emerald-500' : 'bg-gradient-to-r from-amber-500 to-red-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                  {overflowPct !== null && (
                    <div className="absolute top-0 h-full w-0.5 bg-red-400" style={{ left: `${overflowPct}%` }} title="Cota de desborde" />
                  )}
                </div>
              )}

              <div className="flex justify-between text-[10px] font-mono text-slate-400 pt-1 gap-2">
                <span>Mín. hist.: {formatLevel(currentStation.historicalMinM)}</span>
                <span className="text-red-400">Desborde: {currentStation.overflowLevelM === null ? 'no publicada' : formatLevel(currentStation.overflowLevelM)}</span>
                <span>Máx. hist.: {formatLevel(currentStation.historicalMaxM)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#070b10] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <TrendIcon change={currentStation.dailyChangeM} />
                  <span>Variación diaria</span>
                </div>
                <p className="text-base font-bold font-mono text-slate-100">{formatChange(currentStation.dailyChangeM)}</p>
              </div>
              <div className="bg-[#070b10] p-3 rounded-lg border border-slate-800">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Waves className="w-3.5 h-3.5 text-amber-400" />
                  <span>Margen al desborde</span>
                </div>
                <p className="text-base font-bold font-mono text-slate-100">
                  {currentStation.overflowLevelM === null || currentStation.currentLevelM === null
                    ? 's/d'
                    : `${(currentStation.overflowLevelM - currentStation.currentLevelM).toFixed(2)} m`}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#070b10] border border-slate-800 text-[11px] text-slate-400">
              <FlaskConical className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" />
              <span>
                Calidad del agua (turbidez, pH, conductividad, mercurio): no medida. INAMEH no la publica y no es observable desde satélite; requiere muestreo de campo.
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 gap-2 pt-1">
              <a href={currentStation.sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sky-400 hover:text-sky-300 hover:underline">
                <span>Boletín INAMEH</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              {onSelectStationOnMap && (
                <button
                  onClick={() => onSelectStationOnMap(currentStation)}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium hover:underline cursor-pointer"
                >
                  <span>Ver en Sala GIS</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right: Station Grid + history */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stations.map((station) => {
              const isSelected = station.id === currentStation?.id;
              return (
                <div
                  key={station.id}
                  onClick={() => setActiveStationId(station.id)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-[#0f1a29] border-sky-500/80 shadow-lg shadow-sky-950/40'
                      : 'bg-[#0b121c] border-slate-800/80 hover:border-slate-700 hover:bg-[#0d1624]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{station.id} · {station.state}</span>
                      <h4 className="text-sm font-bold text-white">{station.name}</h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${statusClass(station.status)}`}>
                      {station.status}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Nivel</span>
                      <strong className="text-sky-400">{station.currentLevelM === null ? 's/d' : station.currentLevelM.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Variación</span>
                      <strong className="text-slate-300">{formatChange(station.dailyChangeM)}</strong>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block">Boletín</span>
                      <strong className={station.isStale ? 'text-amber-400' : 'text-slate-300'}>{station.readingDate ?? 's/f'}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {currentStation && (
            <div className="bg-[#0b121c] border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Historial de lecturas · {currentStation.name}
              </h4>
              {readingsError && <p className="text-xs text-amber-300">No se pudo cargar el historial: {readingsError}</p>}
              {!readingsError && readings.length === 0 && <p className="text-xs text-slate-500">Sin lecturas almacenadas.</p>}
              {readings.length > 0 && (
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-slate-500 text-left">
                      <th className="py-1">Fecha</th>
                      <th>Nivel (msnm)</th>
                      <th>Variación</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readings.map((r) => (
                      <tr key={r.reading_date} className="border-t border-slate-800/60 text-slate-300">
                        <td className="py-1">{r.reading_date}{r.is_stale ? ' *' : ''}</td>
                        <td>{Number(r.level_msnm).toFixed(2)}</td>
                        <td>{formatChange(r.daily_change_m === null ? null : Number(r.daily_change_m))}</td>
                        <td>{r.alert_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <div className="bg-[#0b121c] border border-slate-800 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-300">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800 flex items-center justify-center text-sky-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-white block font-medium">Criterio de alerta</strong>
              <span className="text-slate-400 text-[11px]">
                Normal si el nivel está a más de 2 m de la cota de desborde publicada por INAMEH; elevado a 2 m o menos; crecida al alcanzarla.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
