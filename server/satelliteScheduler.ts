import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getApiConnectionForTask } from "../src/data/satelliteApiDirectory";
import { createSupabaseStore, insertOnlyNew, IngestionStore } from "./ingestion/persistence";
import {
  FIRMS_CONFLICT_COLUMNS,
  fetchFirmsHotspots,
  firmsKey,
  firmsRagDocument,
  FirmsHotspotRow,
  isRelevantHotspot,
} from "./ingestion/firms";
import { fetchSentinel1Scenes, fetchSentinel2Products } from "./ingestion/stac";
import { fetchSentinel3Products } from "./ingestion/sentinel3";
import { bulletinToRows, fetchInamehBulletins, HydroReadingRow, hydroRagDocument } from "./ingestion/inameh";

export type TaskKey = "NASA_FIRMS" | "SENTINEL_1_SAR" | "SENTINEL_2_MSI" | "SENTINEL_3_OLCI" | "HYDRO_TELEMETRY";
export type RunTrigger = "SCHEDULED" | "MANUAL" | "CRON";

export interface ScheduledTaskConfig {
  key: TaskKey;
  name: string;
  satelliteMission: string;
  agency: string;
  nominalCadenceText: string;
  nominalIntervalHours: number;
  intervalSeconds: number;
  lastRunAt: string | null;
  nextRunAt: string;
  countdownSeconds: number;
  status: "IDLE" | "RUNNING" | "SUCCESS" | "ERROR";
  totalIngested: number;
  supabaseTable: string;
  endpointUrl: string;
  lastInserted: number | null;
  lastSkipped: number | null;
  lastMessage?: string;
}

export interface SchedulerLogEntry {
  id: string;
  timestamp: string;
  taskKey: string;
  satelliteMission: string;
  status: "SUCCESS" | "ERROR" | "RUNNING" | "WARNING";
  recordsCount: number;
  skippedCount: number;
  supabaseSynced: boolean;
  message: string;
}

export interface TaskRunResult {
  success: boolean;
  message: string;
  received: number;
  inserted: number;
  skipped: number;
  ragInserted: number;
}

/** Tiempo máximo de cada petición a Supabase desde el servidor. */
const SUPABASE_REQUEST_TIMEOUT_MS = 30_000;
/** Tiempo máximo para recuperar el estado inicial antes de aceptar ejecuciones. */
const RESTORE_STATE_TIMEOUT_MS = 45_000;

// Lazy Supabase Server Client
let supabaseClientInstance: SupabaseClient | null = null;
export function getSupabaseServerClient(): SupabaseClient | null {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!rawUrl || !key || rawUrl.includes("your-project") || key.includes("your-anon-key")) {
    return null;
  }

  // Remove trailing /rest/v1 or slashes to ensure standard Supabase client URL format
  const cleanUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  if (!supabaseClientInstance) {
    try {
      supabaseClientInstance = createClient(cleanUrl, key, {
        auth: { persistSession: false },
        // Sin tiempo máximo, una base pausada o saturada dejaría colgadas las peticiones.
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS) }),
        },
      });
      console.log("[Supabase Server] Cliente inicializado exitosamente para host:", new URL(cleanUrl).hostname);
    } catch (e: any) {
      console.warn("[Supabase Server] Error inicializando cliente Supabase:", e?.message);
      return null;
    }
  }

  return supabaseClientInstance;
}

interface TaskDefinition {
  key: TaskKey;
  name: string;
  satelliteMission: string;
  agency: string;
  intervalHours: number;
  supabaseTable: string;
}

const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    key: "NASA_FIRMS",
    name: "Anomalías Térmicas NASA FIRMS (VIIRS/MODIS)",
    satelliteMission: "VIIRS NOAA-20 / Suomi-NPP / MODIS Terra-Aqua",
    agency: "NASA EOSDIS / LANCE",
    intervalHours: 3,
    supabaseTable: "nasa_firms_hotspots",
  },
  {
    key: "SENTINEL_1_SAR",
    name: "Catálogo Radar SAR Sentinel-1 (escenas GRD)",
    satelliteMission: "Sentinel-1C / Sentinel-1D (Banda C GRD)",
    agency: "ESA / Copernicus Data Space Ecosystem",
    intervalHours: 12,
    supabaseTable: "sentinel1_scenes",
  },
  {
    key: "SENTINEL_2_MSI",
    name: "Catálogo Multiespectral Sentinel-2 MSI (L2A)",
    satelliteMission: "Sentinel-2A / Sentinel-2B / Sentinel-2C (MSI L2A)",
    agency: "ESA / Copernicus Data Space Ecosystem",
    intervalHours: 24,
    supabaseTable: "s2_product_tile",
  },
  {
    key: "SENTINEL_3_OLCI",
    name: "Catálogo Sentinel-3 OLCI / SLSTR (agua)",
    satelliteMission: "Sentinel-3A / Sentinel-3B (OLCI WFR, SLSTR WST)",
    agency: "ESA / EUMETSAT / Copernicus",
    intervalHours: 24,
    supabaseTable: "sentinel3_products",
  },
  {
    key: "HYDRO_TELEMETRY",
    name: "Niveles del Río Orinoco (boletines INAMEH)",
    satelliteMission: "Estaciones hidrométricas INAMEH (0850, 0855, 0870, 0875)",
    agency: "INAMEH",
    intervalHours: 6,
    supabaseTable: "hydrological_telemetry_readings",
  },
];

/** Al arrancar sin historial, las tareas se escalonan para no consultar todas las fuentes a la vez. */
const FIRST_RUN_STAGGER_SECONDS = 90;
const TIMER_TICK_MS = 60_000;
const RAG_CONFLICT_COLUMNS = ["doc_type", "source_reference_id", "content_hash"];

const LOG_STATUS_BY_RUN_STATUS: Record<string, SchedulerLogEntry["status"]> = { SUCCESS: "SUCCESS", PARTIAL: "WARNING", ERROR: "ERROR" };

// md5 coincide con content_hash (columna generada en Postgres); no se usa con fines de seguridad.
const md5 = (text: string) => createHash("md5").update(text).digest("hex");
const ragKey = (row: Record<string, any>) =>
  [row.doc_type, row.source_reference_id, row.content_hash ?? md5(row.content_chunk ?? "")].join("|");

function cadenceText(hours: number): string {
  return hours === 1 ? "Cada 1 hora" : `Cada ${hours} horas`;
}

interface RunOutcome {
  received: number;
  inserted: number;
  skipped: number;
  ragInserted: number;
  errors: string[];
  endpointUrl: string;
  note?: string;
}

/** Registros recientes en memoria para el análisis de IA (se recargan tras cada ingesta). */
export interface SchedulerCache {
  hotspots: Record<string, any>[];
  sentinel1Scenes: Record<string, any>[];
  sentinel2Products: Record<string, any>[];
  sentinel3Products: Record<string, any>[];
  hydroStations: Record<string, any>[];
  sarDisturbances: Record<string, any>[];
  loadedAt: string | null;
}

export class SatelliteAutomatedScheduler {
  private isRunning = true;
  private tasks = new Map<TaskKey, ScheduledTaskConfig>();
  private runningTasks = new Set<TaskKey>();
  private logs: SchedulerLogEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private ragDocsCount = 0;
  private initialized: Promise<void>;

  public cache: SchedulerCache = {
    hotspots: [],
    sentinel1Scenes: [],
    sentinel2Products: [],
    sentinel3Products: [],
    hydroStations: [],
    sarDisturbances: [],
    loadedAt: null,
  };

  constructor(private storeOverride?: IngestionStore) {
    TASK_DEFINITIONS.forEach((def, i) => {
      const firstRun = new Date(Date.now() + (i + 1) * FIRST_RUN_STAGGER_SECONDS * 1000);
      this.tasks.set(def.key, {
        key: def.key,
        name: def.name,
        satelliteMission: def.satelliteMission,
        agency: def.agency,
        nominalCadenceText: cadenceText(def.intervalHours),
        nominalIntervalHours: def.intervalHours,
        intervalSeconds: def.intervalHours * 3600,
        lastRunAt: null,
        nextRunAt: firstRun.toISOString(),
        countdownSeconds: 0,
        status: "IDLE",
        totalIngested: 0,
        supabaseTable: `public.${def.supabaseTable}`,
        endpointUrl: getApiConnectionForTask(def.key)?.activeUrl || "",
        lastInserted: null,
        lastSkipped: null,
        lastMessage: "Pendiente de la primera ejecución",
      });
    });
    this.initialized = Promise.race([
      this.restoreState(),
      new Promise<void>(resolve => setTimeout(() => {
        this.addLog({ taskKey: "SCHEDULER_CORE", satelliteMission: "Planificador", status: "WARNING", recordsCount: 0, skippedCount: 0, supabaseSynced: false,
          message: "Supabase no respondió al recuperar el estado inicial; el planificador continúa con valores por defecto." });
        resolve();
      }, RESTORE_STATE_TIMEOUT_MS).unref?.()),
    ]);
    this.startTimerLoop();
  }

  private getStore(): IngestionStore | null {
    if (this.storeOverride) return this.storeOverride;
    const client = getSupabaseServerClient();
    return client ? createSupabaseStore(client) : null;
  }

  /** Recupera la última ejecución de cada tarea, los conteos y el caché desde Supabase. */
  private async restoreState() {
    const store = this.getStore();
    if (!store) {
      this.addLog({ taskKey: "SCHEDULER_CORE", satelliteMission: "Planificador", status: "WARNING", recordsCount: 0, skippedCount: 0, supabaseSynced: false,
        message: "Supabase no está configurado: las tareas no pueden guardar datos." });
      return;
    }
    try {
      for (const task of this.tasks.values()) {
        const [last] = await store.selectLatest("ingestion_runs",
          ["finished_at", "status", "records_inserted", "records_skipped", "message"], "started_at", 1, { eq: { task_key: task.key } });
        if (last) {
          task.lastRunAt = last.finished_at;
          task.lastInserted = last.records_inserted;
          task.lastSkipped = last.records_skipped;
          task.lastMessage = last.message || undefined;
          task.status = last.status === "ERROR" ? "ERROR" : "SUCCESS";
          const due = new Date(new Date(last.finished_at).getTime() + task.intervalSeconds * 1000);
          // Si ya venció, se ejecuta en el próximo ciclo (manteniendo el escalonamiento inicial).
          if (due.getTime() > Date.parse(task.nextRunAt)) task.nextRunAt = due.toISOString();
        }
        task.totalIngested = await store.count(task.supabaseTable.replace("public.", ""));
      }
      this.ragDocsCount = await store.count("environmental_rag_documents");

      const recentRuns = await store.selectLatest("ingestion_runs",
        ["id", "task_key", "status", "finished_at", "records_inserted", "records_skipped", "message"], "started_at", 25);
      this.logs = recentRuns.map(r => ({
        id: r.id,
        timestamp: r.finished_at,
        taskKey: r.task_key,
        satelliteMission: this.tasks.get(r.task_key as TaskKey)?.satelliteMission || r.task_key,
        status: LOG_STATUS_BY_RUN_STATUS[r.status] || "SUCCESS",
        recordsCount: r.records_inserted,
        skippedCount: r.records_skipped,
        supabaseSynced: true,
        message: r.message || "",
      }));
      await this.refreshCache(store);
    } catch (err: any) {
      this.addLog({ taskKey: "SCHEDULER_CORE", satelliteMission: "Planificador", status: "ERROR", recordsCount: 0, skippedCount: 0, supabaseSynced: false,
        message: `No se pudo recuperar el estado desde Supabase: ${err?.message || err}` });
    }
  }

  /** Se resuelve cuando terminó la carga inicial del estado y del caché (o venció su tiempo máximo). */
  public whenReady(): Promise<void> {
    return this.initialized;
  }

  public async refreshCache(store = this.getStore()) {
    if (!store) return;
    const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    const [hotspots, s1, s2, s3, stations, sar] = await Promise.all([
      store.selectLatest("nasa_firms_hotspots",
        ["firms_id", "satellite", "latitude", "longitude", "brightness_temp_k", "frp_mw", "confidence", "acq_date", "acq_time", "day_night", "state_name", "sector_name", "source_product"],
        // Solo focos dentro de los estados monitoreados: 7 días completos caben en memoria.
        "acq_date", 6000, { gte: ["acq_date", since(7)], notNull: "state_name" }),
      store.selectLatest("sentinel1_scenes",
        ["scene_id", "platform", "acquired_at", "instrument_mode", "polarizations", "orbit_state", "relative_orbit", "center_lat", "center_lon", "stac_item_url"],
        "acquired_at", 300),
      store.selectLatest("s2_product_tile",
        ["product_id", "tile_id", "spacecraft_name", "sensing_time", "cloud_pixel_pct", "relative_orbit", "center_lat", "center_lon", "stac_item_url"],
        "sensing_time", 500),
      store.selectLatest("sentinel3_products",
        ["product_id", "product_name", "platform", "instrument", "product_type", "sensing_start", "center_lat", "center_lon", "odata_url"],
        "sensing_start", 200),
      store.selectLatest("environmental_monitoring_stations",
        ["station_code", "name", "river", "state", "latitude", "longitude", "overflow_level_msnm", "historical_max_msnm", "historical_min_msnm",
         "latest_reading_date", "latest_level_msnm", "latest_change_m", "latest_trend", "latest_alert_status", "latest_is_stale", "page_url", "updated_at"],
        "station_code", 50),
      store.selectLatest("copernicus_sar_disturbances",
        ["code", "sector_name", "sub_basin", "centroid_lat", "centroid_lng", "backscatter_diff_db", "affected_area_ha", "severity", "created_at"],
        "created_at", 100),
    ]);
    stations.sort((x, y) => String(x.station_code).localeCompare(String(y.station_code)));
    this.cache = {
      hotspots,
      sentinel1Scenes: s1,
      sentinel2Products: s2,
      sentinel3Products: s3,
      hydroStations: stations,
      sarDisturbances: sar,
      loadedAt: new Date().toISOString(),
    };
  }

  private startTimerLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.isRunning) void this.runDueTasks("SCHEDULED");
    }, TIMER_TICK_MS);
    this.timer.unref?.();
  }

  private addLog(entry: Omit<SchedulerLogEntry, "id" | "timestamp">) {
    this.logs.unshift({ ...entry, id: `LOG-${Date.now()}-${this.logs.length}`, timestamp: new Date().toISOString() });
    if (this.logs.length > 60) this.logs.pop();
  }

  /** Ejecuta las tareas cuya próxima ejecución ya venció. Las ejecuta en serie para limitar la carga. */
  public async runDueTasks(trigger: RunTrigger): Promise<Record<string, TaskRunResult | "NOT_DUE">> {
    await this.initialized;
    const results: Record<string, TaskRunResult | "NOT_DUE"> = {};
    for (const task of this.tasks.values()) {
      if (Date.parse(task.nextRunAt) <= Date.now() && !this.runningTasks.has(task.key)) {
        results[task.key] = await this.executeTask(task.key, trigger);
      } else {
        results[task.key] = "NOT_DUE";
      }
    }
    return results;
  }

  public async executeTask(taskKey: string, trigger: RunTrigger = "MANUAL"): Promise<TaskRunResult> {
    await this.initialized;
    const task = this.tasks.get(taskKey as TaskKey);
    const empty = { received: 0, inserted: 0, skipped: 0, ragInserted: 0 };
    if (!task) return { success: false, message: `Tarea ${taskKey} no encontrada en el planificador.`, ...empty };
    if (this.runningTasks.has(task.key)) return { success: false, message: `La tarea ${task.key} ya se está ejecutando.`, ...empty };

    const store = this.getStore();
    if (!store) {
      task.status = "ERROR";
      task.lastMessage = "Supabase no está configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).";
      return { success: false, message: task.lastMessage, ...empty };
    }

    this.runningTasks.add(task.key);
    task.status = "RUNNING";
    const startedAt = new Date();

    let outcome: RunOutcome;
    try {
      outcome = await this.runConnector(task.key, store);
    } catch (err: any) {
      outcome = { ...empty, errors: [err?.message || String(err)], endpointUrl: task.endpointUrl };
    }

    const finishedAt = new Date();
    const failed = outcome.errors.length > 0 && outcome.received === 0;
    let runStatus: "SUCCESS" | "PARTIAL" | "ERROR" = "SUCCESS";
    if (failed) runStatus = "ERROR";
    else if (outcome.errors.length > 0) runStatus = "PARTIAL";
    const message = [
      `${outcome.inserted} nuevos, ${outcome.skipped} repetidos omitidos (de ${outcome.received} recibidos).`,
      outcome.ragInserted > 0 ? `${outcome.ragInserted} documentos RAG.` : "",
      outcome.note || "",
      outcome.errors.length > 0 ? `Errores: ${outcome.errors.join(" | ")}` : "",
    ].filter(Boolean).join(" ");

    task.status = failed ? "ERROR" : "SUCCESS";
    task.lastRunAt = finishedAt.toISOString();
    task.nextRunAt = new Date(finishedAt.getTime() + task.intervalSeconds * 1000).toISOString();
    task.lastInserted = outcome.inserted;
    task.lastSkipped = outcome.skipped;
    task.totalIngested += outcome.inserted;
    task.lastMessage = message;
    this.ragDocsCount += outcome.ragInserted;
    this.runningTasks.delete(task.key);

    let recorded = true;
    try {
      await store.insert("ingestion_runs", {
        task_key: task.key,
        trigger,
        status: runStatus,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        records_received: outcome.received,
        records_inserted: outcome.inserted,
        records_skipped: outcome.skipped,
        rag_documents_inserted: outcome.ragInserted,
        message: message.slice(0, 2000),
        endpoint_url: outcome.endpointUrl,
      });
    } catch (err: any) {
      recorded = false;
      console.warn(`[Scheduler] No se pudo registrar la ejecución de ${task.key}:`, err?.message || err);
    }

    this.addLog({
      taskKey: task.key,
      satelliteMission: task.satelliteMission,
      status: LOG_STATUS_BY_RUN_STATUS[runStatus],
      recordsCount: outcome.inserted,
      skippedCount: outcome.skipped,
      supabaseSynced: recorded && !failed,
      message: `[${trigger}] ${task.name}: ${message}`,
    });

    if (outcome.inserted > 0) {
      await this.refreshCache(store).catch(err => console.warn("[Scheduler] Error recargando caché:", err?.message || err));
    }

    return { success: !failed, message, received: outcome.received, inserted: outcome.inserted, skipped: outcome.skipped, ragInserted: outcome.ragInserted };
  }

  private async insertRagDocuments(store: IngestionStore, docs: Record<string, any>[]): Promise<number> {
    if (docs.length === 0) return 0;
    const result = await insertOnlyNew(store, "environmental_rag_documents", docs, {
      conflictColumns: RAG_CONFLICT_COLUMNS,
      keyOf: ragKey,
      prefilterColumn: "source_reference_id",
    });
    return result.inserted;
  }

  private async runConnector(taskKey: TaskKey, store: IngestionStore): Promise<RunOutcome> {
    switch (taskKey) {
      case "NASA_FIRMS": {
        const { rows, discardedOutside, errors, urls } = await fetchFirmsHotspots();
        const result = await insertOnlyNew(store, "nasa_firms_hotspots", rows, {
          conflictColumns: FIRMS_CONFLICT_COLUMNS,
          keyOf: firmsKey,
          prefilterColumn: "acq_date",
        });
        const relevant = (result.sent as FirmsHotspotRow[]).filter(isRelevantHotspot);
        const ragInserted = await this.insertRagDocuments(store, relevant.map(firmsRagDocument));
        return { ...result, ragInserted, errors, endpointUrl: urls[0] || "",
          note: `${relevant.length} focos relevantes (confianza alta o FRP ≥ 10 MW). ${discardedOutside} focos fuera de Amazonas, Bolívar, Delta Amacuro y Guayana Esequiba descartados.` };
      }
      case "SENTINEL_1_SAR": {
        const { rows, url, truncated } = await fetchSentinel1Scenes();
        const result = await insertOnlyNew(store, "sentinel1_scenes", rows, {
          conflictColumns: ["scene_id"], keyOf: r => r.scene_id, prefilterColumn: "scene_id",
        });
        return { ...result, ragInserted: 0, errors: [], endpointUrl: url,
          note: truncated ? "Se alcanzó el máximo de páginas; las restantes entran en la próxima ejecución." : undefined };
      }
      case "SENTINEL_2_MSI": {
        const { rows, url, truncated } = await fetchSentinel2Products();
        const result = await insertOnlyNew(store, "s2_product_tile", rows, {
          conflictColumns: ["product_id"], keyOf: r => r.product_id, prefilterColumn: "product_id",
        });
        return { ...result, ragInserted: 0, errors: [], endpointUrl: url,
          note: truncated ? "Se alcanzó el máximo de páginas; las restantes entran en la próxima ejecución." : undefined };
      }
      case "SENTINEL_3_OLCI": {
        const { rows, urls, truncated } = await fetchSentinel3Products();
        const result = await insertOnlyNew(store, "sentinel3_products", rows, {
          conflictColumns: ["product_id"], keyOf: r => r.product_id, prefilterColumn: "product_id",
        });
        return { ...result, ragInserted: 0, errors: [], endpointUrl: urls[0] || "",
          note: truncated ? "Se alcanzó el máximo de páginas; las restantes entran en la próxima ejecución." : undefined };
      }
      case "HYDRO_TELEMETRY":
        return this.runHydro(store);
    }
  }

  private async runHydro(store: IngestionStore): Promise<RunOutcome> {
    const { bulletins, errors } = await fetchInamehBulletins();
    const stations = await store.selectWhereIn("environmental_monitoring_stations",
      ["station_code", "name", "river", "latitude", "longitude", "overflow_level_msnm"],
      "station_code", bulletins.map(b => b.stationCode));
    const stationByCode = new Map(stations.map(s => [s.station_code, s]));

    const rows: HydroReadingRow[] = bulletins.flatMap(b => {
      const station = stationByCode.get(b.stationCode);
      const overflow = station?.overflow_level_msnm == null ? null : Number(station.overflow_level_msnm);
      return bulletinToRows(b, overflow);
    });

    const result = await insertOnlyNew(store, "hydrological_telemetry_readings", rows, {
      conflictColumns: ["station_code", "reading_date"],
      keyOf: r => `${r.station_code}|${String(r.reading_date).slice(0, 10)}`,
      prefilterColumn: "station_code",
    });

    // Estado más reciente de cada estación (una actualización por estación).
    for (const b of bulletins) {
      const latest = rows.find(r => r.station_code === b.stationCode && r.reading_date === b.readingDate);
      if (!latest) continue;
      await store.update("environmental_monitoring_stations", "station_code", b.stationCode, {
        latest_reading_date: latest.reading_date,
        latest_level_msnm: latest.level_msnm,
        latest_change_m: latest.daily_change_m,
        latest_trend: latest.trend,
        latest_alert_status: latest.alert_status,
        latest_is_stale: latest.is_stale,
        updated_at: new Date().toISOString(),
      });
    }

    const docs = (result.sent as HydroReadingRow[]).map(r => {
      const s = stationByCode.get(r.station_code);
      return hydroRagDocument(r, s?.name || r.station_code, s?.river || "Río Orinoco", Number(s?.latitude), Number(s?.longitude));
    });
    const ragInserted = await this.insertRagDocuments(store, docs);
    const stale = rows.filter(r => r.is_stale && bulletins.some(b => b.readingDate === r.reading_date && b.stationCode === r.station_code));

    return {
      ...result,
      ragInserted,
      errors,
      endpointUrl: getApiConnectionForTask("HYDRO_TELEMETRY")?.baseUrlTemplate || "",
      note: stale.length > 0 ? `Boletines desactualizados: ${stale.map(r => `${r.station_code} (${r.reading_date})`).join(", ")}.` : undefined,
    };
  }

  public toggleRunning() {
    this.isRunning = !this.isRunning;
    this.addLog({
      taskKey: "SCHEDULER_CORE",
      satelliteMission: "Planificador",
      status: "WARNING",
      recordsCount: 0,
      skippedCount: 0,
      supabaseSynced: !!this.getStore(),
      message: this.isRunning ? "Planificador reanudado." : "Planificador pausado (el cron externo sigue pudiendo ejecutar tareas).",
    });
    return { isRunning: this.isRunning };
  }

  public getStatus() {
    const now = Date.now();
    const activeTasks = Array.from(this.tasks.values()).map(task => ({
      ...task,
      countdownSeconds: Math.max(0, Math.round((Date.parse(task.nextRunAt) - now) / 1000)),
    }));
    return {
      isRunning: this.isRunning,
      mode: "PRODUCTION_CADENCE" as const,
      supabaseConnected: !!this.getStore(),
      supabaseHost: (() => {
        const raw = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        try { return raw ? new URL(raw).hostname : "Supabase no configurado"; } catch { return "Supabase no configurado"; }
      })(),
      activeTasks,
      recentLogs: this.logs.slice(0, 25),
      totalSatelliteEventsIngested: activeTasks.reduce((sum, t) => sum + t.totalIngested, 0),
      vectorRagDocsCount: this.ragDocsCount,
    };
  }

  /** SQL de las migraciones aplicadas en Supabase (supabase/migrations). */
  public getAutomationSqlScript(): string {
    const candidates = [path.join(process.cwd(), "supabase", "migrations")];
    // __dirname solo existe en el bundle CJS de producción (en desarrollo corre como ESM).
    if (typeof __dirname !== "undefined") candidates.push(path.join(__dirname, "..", "supabase", "migrations"));
    const dir = candidates.find(d => fs.existsSync(d));
    if (!dir) return "-- No se encontró la carpeta supabase/migrations en el servidor.";
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b))
      .map(f => `-- ===== ${f} =====\n${fs.readFileSync(path.join(dir, f), "utf8")}`)
      .join("\n\n");
  }
}
