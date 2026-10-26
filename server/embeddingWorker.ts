import type { SupabaseClient } from "@supabase/supabase-js";
import {
  documentEmbeddingText,
  EMBEDDING_MODEL,
  EmbeddingClient,
  EmbeddingUnavailableError,
  embedTexts,
  toPgVector,
} from "./embeddings";

/**
 * Vectoriza los documentos de environmental_rag_documents que aún no tienen embedding.
 * La ingesta inserta sin vector; este worker los completa por lotes, así un fallo de
 * cuota en Gemini nunca bloquea la ingesta: lo pendiente se completa en la próxima pasada.
 */

const TABLE = "environmental_rag_documents";
/**
 * El plan gratuito de Gemini cuenta cada texto como una petición (100 por minuto):
 * lotes de 45 cada 30 s quedan en ~90 textos por minuto.
 */
const DEFAULT_BATCH_SIZE = 45;
const PAUSE_BETWEEN_BATCHES_MS = 30_000;
/** Actualizaciones simultáneas por lote (cuida el Disk IO del plan gratuito de Supabase). */
const UPDATE_CONCURRENCY = 10;

export interface EmbeddingRunResult {
  embedded: number;
  failed: number;
  pending: number | null;
  stoppedReason?: string;
  /** Gemini pidió esperar (cuota diaria): no conviene reintentar antes. */
  retryAfterMs?: number | null;
}

export interface EmbeddingWorkerStats {
  running: boolean;
  model: string;
  embeddedDocs: number | null;
  pendingDocs: number | null;
  /** Pausado hasta esta hora por cuota diaria agotada. */
  pausedUntil: string | null;
  lastRunAt: string | null;
  lastRunEmbedded: number;
  lastError: string | null;
}

interface PendingDoc {
  id: string;
  title: string | null;
  location_name: string | null;
  sub_basin: string | null;
  content_chunk: string | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function countDocs(client: SupabaseClient, pending: boolean): Promise<number | null> {
  const query = client.from(TABLE).select("id", { count: "exact", head: true });
  const { count, error } = pending ? await query.is("embedding", null) : await query.not("embedding", "is", null);
  return error ? null : count;
}

/** Una pasada: vectoriza hasta maxBatches lotes de documentos pendientes. */
export async function embedPendingDocuments(
  client: SupabaseClient,
  embeddingClient: EmbeddingClient | null,
  options: { batchSize?: number; maxBatches?: number; pauseMs?: number } = {}
): Promise<EmbeddingRunResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const maxBatches = options.maxBatches ?? 100;
  const pauseMs = options.pauseMs ?? PAUSE_BETWEEN_BATCHES_MS;
  let embedded = 0;
  let failed = 0;
  let stoppedReason: string | undefined;
  let retryAfterMs: number | null = null;

  for (let batch = 0; batch < maxBatches; batch++) {
    const { data, error } = await client
      .from(TABLE)
      .select("id,title,location_name,sub_basin,content_chunk")
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);
    if (error) {
      stoppedReason = `No se pudieron leer documentos pendientes: ${error.message}`;
      break;
    }
    const docs = (data as PendingDoc[]) || [];
    if (docs.length === 0) break;

    let vectors: number[][];
    try {
      vectors = await embedTexts(embeddingClient, docs.map(documentEmbeddingText), "RETRIEVAL_DOCUMENT");
    } catch (err: any) {
      stoppedReason = err instanceof EmbeddingUnavailableError ? err.message : `Error de embeddings: ${err?.message || err}`;
      retryAfterMs = err instanceof EmbeddingUnavailableError ? err.retryAfterMs : null;
      break;
    }

    const embeddedAt = new Date().toISOString();
    for (let i = 0; i < docs.length; i += UPDATE_CONCURRENCY) {
      const slice = docs.slice(i, i + UPDATE_CONCURRENCY);
      const results = await Promise.all(slice.map((doc, j) =>
        client
          .from(TABLE)
          .update({ embedding: toPgVector(vectors[i + j]), embedding_model: EMBEDDING_MODEL, embedded_at: embeddedAt })
          .eq("id", doc.id)
      ));
      for (const r of results) r.error ? failed++ : embedded++;
    }

    // Un lote que no logró guardar nada se repetiría para siempre: se corta la pasada.
    if (failed > 0 && embedded === 0) {
      stoppedReason = "No se pudo guardar ningún embedding en Supabase.";
      break;
    }
    if (docs.length < batchSize) break;
    await sleep(pauseMs);
  }

  return { embedded, failed, pending: await countDocs(client, true), stoppedReason, retryAfterMs };
}

/** Ejecuta embedPendingDocuments sin solaparse; un pedido durante una pasada agenda otra al final. */
export class EmbeddingWorker {
  private running = false;
  private rerunRequested = false;
  private stats: EmbeddingWorkerStats = {
    running: false,
    model: EMBEDDING_MODEL,
    embeddedDocs: null,
    pendingDocs: null,
    pausedUntil: null,
    lastRunAt: null,
    lastRunEmbedded: 0,
    lastError: null,
  };

  constructor(
    private readonly getSupabase: () => SupabaseClient | null,
    private readonly getEmbeddingClient: () => EmbeddingClient | null
  ) {}

  public getStats(): EmbeddingWorkerStats {
    return { ...this.stats, running: this.running };
  }

  /** Recalcula los conteos de vectorizados y pendientes. */
  public async refreshCounts(): Promise<void> {
    const client = this.getSupabase();
    if (!client) return;
    const [embeddedDocs, pendingDocs] = await Promise.all([countDocs(client, false), countDocs(client, true)]);
    this.stats.embeddedDocs = embeddedDocs;
    this.stats.pendingDocs = pendingDocs;
  }

  public async run(): Promise<EmbeddingRunResult | null> {
    if (this.running) {
      this.rerunRequested = true;
      return null;
    }
    if (this.stats.pausedUntil && Date.now() < Date.parse(this.stats.pausedUntil)) return null;
    const client = this.getSupabase();
    if (!client) return null;

    this.running = true;
    let result: EmbeddingRunResult | null = null;
    try {
      do {
        this.rerunRequested = false;
        result = await embedPendingDocuments(client, this.getEmbeddingClient());
        this.stats.lastRunAt = new Date().toISOString();
        this.stats.lastRunEmbedded = result.embedded;
        this.stats.lastError = result.stoppedReason || null;
        this.stats.pausedUntil = result.retryAfterMs ? new Date(Date.now() + result.retryAfterMs).toISOString() : null;
        if (result.embedded > 0 || result.stoppedReason) {
          console.log(`[Embeddings] ${result.embedded} documentos vectorizados, ${result.pending ?? "?"} pendientes.${result.stoppedReason ? ` Detenido: ${result.stoppedReason}` : ""}`);
        }
      } while (this.rerunRequested && !result.stoppedReason);
      await this.refreshCounts();
    } catch (err: any) {
      this.stats.lastError = err?.message || String(err);
      console.warn("[Embeddings] Error en el worker:", this.stats.lastError);
    } finally {
      this.running = false;
    }
    return result;
  }
}
