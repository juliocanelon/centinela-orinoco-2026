import { test } from "node:test";
import assert from "node:assert/strict";
import { rerank, RerankCandidate, severityOf } from "../server/rag/reranker";

const NOW = new Date("2026-10-25T00:00:00Z");

const candidate = (over: Partial<RerankCandidate> & { id: string }): RerankCandidate => ({
  doc_type: "NASA_FIRMS",
  similarity: 0.8,
  distance_km: 10,
  created_at: NOW.toISOString(),
  metadata: null,
  ...over,
});

test("ordena por puntaje compuesto", () => {
  const result = rerank([
    candidate({ id: "lejano", similarity: 0.8, distance_km: 90 }),
    candidate({ id: "cercano", similarity: 0.8, distance_km: 5 }),
  ], { radiusKm: 100, now: NOW });
  assert.deepEqual(result.map(r => r.candidate.id), ["cercano", "lejano"]);
});

test("aplica la ecuación del artículo", () => {
  const [r] = rerank([
    candidate({ id: "a", similarity: 0.9, distance_km: 25, metadata: { peer_reviewed: true, severity: "HIGH" } }),
  ], { radiusKm: 50, now: NOW });
  // 0,45·0,9 + 0,20·0,5 + 0,15·1 + 0,10·1 + 0,10·0,75
  assert.equal(r.score, 0.83);
});

test("descarta candidatos fuera del radio y similitudes no numéricas", () => {
  const result = rerank([
    candidate({ id: "fuera", distance_km: 120 }),
    candidate({ id: "nan", similarity: Number.NaN }),
    candidate({ id: "dentro", distance_km: 50 }),
  ], { radiusKm: 100, now: NOW });
  assert.deepEqual(result.map(r => r.candidate.id), ["dentro"]);
});

test("sin radio, el peso de la proximidad pasa a la similitud", () => {
  const [r] = rerank([candidate({ id: "a", similarity: 1, distance_km: null })], { now: NOW });
  assert.equal(r.components.proximity, 0);
  assert.equal(r.score, 0.65 + 0.15);
});

test("documento sin coordenadas conserva su lugar con proximidad 0", () => {
  const result = rerank([candidate({ id: "sin-geo", distance_km: null })], { radiusKm: 50, now: NOW });
  assert.equal(result.length, 1);
  assert.equal(result[0].components.proximity, 0);
});

test("la recencia decae con vida media de unos 62 días", () => {
  const old = new Date(NOW.getTime() - 62.4 * 86_400_000).toISOString();
  const [r] = rerank([candidate({ id: "a", created_at: old })], { radiusKm: 50, now: NOW });
  assert.ok(Math.abs(r.components.recency - 0.5) < 0.01);
});

test("topN limita los resultados", () => {
  const many = Array.from({ length: 12 }, (_, i) => candidate({ id: String(i) }));
  assert.equal(rerank(many, { topN: 5, now: NOW }).length, 5);
});

test("severidad según el tipo de documento", () => {
  assert.equal(severityOf({ severity: "CRITICAL" }), 1);
  assert.equal(severityOf({ alert_status: "ELEVATED" }), 0.5);
  assert.equal(severityOf({ confidence: "high" }), 0.75);
  assert.equal(severityOf({ confidence: "desconocida" }), 0);
  assert.equal(severityOf(null), 0);
});
