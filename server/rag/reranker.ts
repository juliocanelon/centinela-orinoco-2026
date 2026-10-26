/**
 * Reranker de la memoria semántica (ecuación 1 del artículo):
 * score = 0,45·sim + 0,20·(1 − d/R) + 0,15·e^(−días/90) + 0,10·arbitrado + 0,10·severidad
 * Sin punto de consulta (o sin radio) no hay proximidad: su peso pasa a la similitud.
 * Los pesos son iniciales y no están calibrados con un conjunto etiquetado.
 */

export interface RerankCandidate {
  id: string;
  doc_type: string;
  similarity: number;
  distance_km: number | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

export interface RerankOptions {
  radiusKm?: number;
  topN?: number;
  now?: Date;
  weights?: Partial<RerankWeights>;
}

export interface RerankWeights {
  similarity: number;
  proximity: number;
  recency: number;
  peerReviewed: number;
  severity: number;
}

export const DEFAULT_WEIGHTS: RerankWeights = {
  similarity: 0.45,
  proximity: 0.2,
  recency: 0.15,
  peerReviewed: 0.1,
  severity: 0.1,
};

export const RECENCY_TAU_DAYS = 90;

const SEVERITY_SCORE: Record<string, number> = { LOW: 0.25, MEDIUM: 0.5, HIGH: 0.75, CRITICAL: 1 };
const FIRMS_CONFIDENCE_SCORE: Record<string, number> = { low: 0.25, nominal: 0.5, high: 0.75 };
const HYDRO_ALERT_SCORE: Record<string, number> = { ALERT_CRECIDA: 1, ELEVATED: 0.5, OPTIMAL: 0, SIN_REFERENCIA: 0 };

/** Severidad en [0, 1] según lo que trae cada tipo de documento; 0 si no hay dato. */
export function severityOf(metadata: Record<string, any> | null | undefined): number {
  if (!metadata) return 0;
  if (typeof metadata.severity === "string" && metadata.severity in SEVERITY_SCORE) return SEVERITY_SCORE[metadata.severity];
  if (typeof metadata.alert_status === "string" && metadata.alert_status in HYDRO_ALERT_SCORE) return HYDRO_ALERT_SCORE[metadata.alert_status];
  if (typeof metadata.confidence === "string" && metadata.confidence in FIRMS_CONFIDENCE_SCORE) return FIRMS_CONFIDENCE_SCORE[metadata.confidence];
  return 0;
}

export interface RerankedCandidate<T extends RerankCandidate> {
  candidate: T;
  score: number;
  components: { similarity: number; proximity: number; recency: number; peerReviewed: number; severity: number };
}

export function rerank<T extends RerankCandidate>(candidates: T[], options: RerankOptions = {}): RerankedCandidate<T>[] {
  const base = { ...DEFAULT_WEIGHTS, ...options.weights };
  const radius = options.radiusKm;
  const useProximity = Number.isFinite(radius) && (radius as number) > 0;
  const weights = useProximity ? base : { ...base, similarity: base.similarity + base.proximity, proximity: 0 };
  const now = (options.now ?? new Date()).getTime();

  return candidates
    .filter(c => Number.isFinite(c.similarity))
    .filter(c => !useProximity || c.distance_km === null || !Number.isFinite(c.distance_km) || c.distance_km <= (radius as number))
    .map(candidate => {
      const ageDays = Math.max(0, (now - Date.parse(candidate.created_at)) / 86_400_000);
      const components = {
        similarity: Math.min(1, Math.max(0, candidate.similarity)),
        proximity: useProximity && candidate.distance_km !== null && Number.isFinite(candidate.distance_km)
          ? Math.max(0, 1 - candidate.distance_km / (radius as number))
          : 0,
        recency: Number.isFinite(ageDays) ? Math.exp(-ageDays / RECENCY_TAU_DAYS) : 0,
        peerReviewed: candidate.metadata?.peer_reviewed === true ? 1 : 0,
        severity: severityOf(candidate.metadata),
      };
      const score =
        weights.similarity * components.similarity +
        weights.proximity * components.proximity +
        weights.recency * components.recency +
        weights.peerReviewed * components.peerReviewed +
        weights.severity * components.severity;
      return { candidate, score: Math.round(score * 10000) / 10000, components };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, options.topN ?? 8));
}
