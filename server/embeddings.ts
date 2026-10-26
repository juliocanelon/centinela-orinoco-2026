import type { GoogleGenAI } from "@google/genai";

/**
 * Embeddings de Gemini para la memoria semántica (pgvector, 768 dimensiones).
 * Documentos: RETRIEVAL_DOCUMENT. Consultas: RETRIEVAL_QUERY.
 */

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
/** Texto máximo por documento; los content_chunk actuales no pasan de ~1.000 caracteres. */
export const MAX_EMBEDDING_TEXT_CHARS = 2000;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Lo mínimo del SDK que se usa; permite inyectar un cliente simulado en las pruebas. */
export type EmbeddingClient = Pick<GoogleGenAI, "models">;

export class EmbeddingUnavailableError extends Error {
  /** Si Gemini agotó la cuota del día, cuánto falta para que se renueve. */
  constructor(message: string, public readonly retryAfterMs: number | null = null) {
    super(message);
    this.name = "EmbeddingUnavailableError";
  }
}

/** Normaliza a norma 1 (con menos de 3072 dimensiones Gemini no entrega vectores normalizados). */
export function normalizeVector(values: number[]): number[] {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding con ${values.length} dimensiones; se esperaban ${EMBEDDING_DIMENSIONS}.`);
  }
  if (!values.every(Number.isFinite)) throw new Error("Embedding con valores no numéricos.");
  const norm = Math.sqrt(values.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) throw new Error("Embedding nulo (norma 0).");
  return values.map(v => v / norm);
}

/** Formato de texto que acepta una columna vector de pgvector: "[0.1,0.2,...]". */
export function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

/** Texto que representa a un documento RAG en el espacio vectorial. */
export function documentEmbeddingText(doc: {
  title?: string | null;
  location_name?: string | null;
  sub_basin?: string | null;
  content_chunk?: string | null;
}): string {
  return [doc.title, doc.location_name, doc.sub_basin, doc.content_chunk]
    .map(s => (s || "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_EMBEDDING_TEXT_CHARS);
}

/** Cuota diaria agotada (el plan gratuito permite 1.000 textos por día): no tiene sentido reintentar. */
export function isDailyQuotaError(err: any): boolean {
  return /PerDay|per day/i.test(String(err?.message || ""));
}

/** Segundos de espera que indica Gemini en retryDelay ("21510s"), sin tope. */
export function quotaRetryAfterMs(err: any): number | null {
  const match = String(err?.message || "").match(/"retryDelay":\s*"(\d+)s"/i);
  return match ? Number(match[1]) * 1000 : null;
}

const isRetryable = (err: any): boolean => {
  if (isDailyQuotaError(err)) return false;
  const status = Number(err?.status ?? err?.code ?? err?.response?.status);
  const msg = String(err?.message || "");
  return status === 429 || status >= 500 || /429|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|timeout|ECONNRESET/i.test(msg);
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Espera que sugiere Gemini en un 429 ("retry in 25.7s" o retryDelay "25s"), con tope de 65 s. */
export function suggestedRetryDelayMs(err: any): number | null {
  const match = String(err?.message || "").match(/retry in ([\d.]+)s|"retryDelay":\s*"(\d+)s"/i);
  const seconds = match ? Number(match[1] ?? match[2]) : NaN;
  return Number.isFinite(seconds) ? Math.min(65_000, Math.ceil(seconds * 1000) + 1000) : null;
}

/**
 * Vectoriza varios textos en una sola petición. Reintenta ante 429 o 5xx con espera
 * exponencial; si sigue fallando lanza EmbeddingUnavailableError.
 */
export async function embedTexts(
  client: EmbeddingClient | null,
  texts: string[],
  taskType: EmbeddingTaskType,
  options: { retries?: number; baseDelayMs?: number } = {}
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!client) throw new EmbeddingUnavailableError("GEMINI_API_KEY no está configurada.");

  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 2000;
  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: texts,
        config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
      });
      const embeddings = response.embeddings || [];
      if (embeddings.length !== texts.length) {
        throw new Error(`Gemini devolvió ${embeddings.length} embeddings para ${texts.length} textos.`);
      }
      return embeddings.map(e => normalizeVector(e.values || []));
    } catch (err: any) {
      lastError = err;
      if (attempt === retries || !isRetryable(err)) break;
      await sleep(suggestedRetryDelayMs(err) ?? baseDelayMs * 2 ** attempt);
    }
  }
  if (isDailyQuotaError(lastError)) {
    throw new EmbeddingUnavailableError("Cuota diaria de embeddings de Gemini agotada.", quotaRetryAfterMs(lastError));
  }
  throw new EmbeddingUnavailableError(`No se pudieron calcular embeddings: ${lastError?.message || lastError}`);
}
