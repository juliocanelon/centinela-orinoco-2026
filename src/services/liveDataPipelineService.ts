import {
  FirmsDensityResponse,
  IngestionFeed,
  IngestionOverview,
  KoboFieldPatrolReport,
  RagIntelligenceSynthesis,
  S2ProductTile,
  SchedulerStatusResponse,
} from '../types';

/** Error con el mensaje que devuelve la API (o el estado HTTP si no hay mensaje). */
async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `HTTP ${res.status} en ${url}`);
  }
  return body as T;
}

const jsonPost = (body?: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/**
 * Cliente de la API de ingesta. Todas las respuestas provienen del servidor y de Supabase;
 * si la API falla, el error se propaga (no hay datos de respaldo simulados).
 */
export const LivePipelineService = {
  async getConnectorStatus(): Promise<IngestionOverview> {
    const json = await apiRequest<{ status: IngestionOverview }>('/api/ingestion/status');
    return json.status;
  },

  /** Registros reales recientes: focos FIRMS, escenas Sentinel, estaciones INAMEH. */
  async getIngestionFeed(): Promise<IngestionFeed> {
    return apiRequest<IngestionFeed>('/api/ingestion/feed');
  },

  /** Densidad de focos FIRMS en hexágonos de 25 km para el periodo indicado (1, 3 o 7 días). */
  async getFirmsDensity(days: 1 | 3 | 7): Promise<FirmsDensityResponse> {
    return apiRequest<FirmsDensityResponse>(`/api/firms/density?days=${days}`);
  },

  async getS2ProductTiles(maxCloud?: number): Promise<S2ProductTile[]> {
    const query = maxCloud === undefined ? '' : `?maxCloud=${maxCloud}`;
    return apiRequest<S2ProductTile[]>(`/api/s2/tiles${query}`);
  },

  /** Envía una minuta de campo al webhook Kobo. Las mediciones solo se incluyen si el usuario las ingresa. */
  async dispatchKoboWebhook(payload: Partial<KoboFieldPatrolReport>): Promise<{ success: boolean; report: KoboFieldPatrolReport; message?: string }> {
    return apiRequest('/api/webhooks/kobo', jsonPost(payload));
  },

  async executeVectorRagQuery(params: {
    query: string;
    filterLat?: number;
    filterLng?: number;
    radiusKm?: number;
    maxMatches?: number;
  }): Promise<RagIntelligenceSynthesis> {
    return apiRequest<RagIntelligenceSynthesis>('/api/rag/vector-search', jsonPost(params));
  },

  async getSchedulerStatus(): Promise<SchedulerStatusResponse> {
    return apiRequest<SchedulerStatusResponse>('/api/scheduler/status');
  },

  /** Ejecuta una tarea ahora. El servidor exige 15 min entre ejecuciones manuales de la misma tarea. */
  async triggerScheduledTask(taskKey: string): Promise<{ success: boolean; message: string; inserted?: number; skipped?: number }> {
    const res = await fetch(`/api/scheduler/trigger/${taskKey}`, { method: 'POST' });
    const body = await res.json().catch(() => null);
    return {
      success: res.ok && Boolean(body?.success),
      message: body?.message || `HTTP ${res.status}`,
      inserted: body?.inserted,
      skipped: body?.skipped,
    };
  },

  async toggleSchedulerRunning(): Promise<{ isRunning: boolean }> {
    return apiRequest<{ isRunning: boolean }>('/api/scheduler/toggle', { method: 'POST' });
  },

  /** SQL de las migraciones aplicadas en Supabase (carpeta supabase/migrations). */
  async getAutomationSql(): Promise<string> {
    const data = await apiRequest<{ sql: string }>('/api/scheduler/sql-automation');
    return data.sql;
  },
};
