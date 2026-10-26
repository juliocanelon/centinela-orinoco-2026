import { test } from "node:test";
import assert from "node:assert/strict";
import {
  documentEmbeddingText,
  EMBEDDING_DIMENSIONS,
  EmbeddingUnavailableError,
  embedTexts,
  normalizeVector,
  suggestedRetryDelayMs,
  toPgVector,
} from "../server/embeddings";

const vector = (fill: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => fill);

/** Cliente simulado: devuelve las respuestas (o lanza los errores) en orden. */
function fakeClient(responses: Array<number[][] | Error>) {
  const calls: any[] = [];
  const client = {
    models: {
      embedContent: async (params: any) => {
        calls.push(params);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return { embeddings: (next || []).map(values => ({ values })) };
      },
    },
  };
  return { client: client as any, calls };
}

test("normalizeVector deja norma 1", () => {
  const v = normalizeVector(vector(2));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test("normalizeVector rechaza dimensiones incorrectas, NaN y vector nulo", () => {
  assert.throws(() => normalizeVector([1, 2, 3]), /dimensiones/);
  assert.throws(() => normalizeVector([...vector(1).slice(1), Number.NaN]), /no numéricos/);
  assert.throws(() => normalizeVector(vector(0)), /norma 0/);
});

test("toPgVector produce el formato de texto de pgvector", () => {
  assert.equal(toPgVector([0.5, -1, 0]), "[0.5,-1,0]");
});

test("documentEmbeddingText une campos, omite vacíos y recorta", () => {
  assert.equal(
    documentEmbeddingText({ title: "Foco", location_name: null, sub_basin: " Caura ", content_chunk: "texto" }),
    "Foco\nCaura\ntexto"
  );
  assert.equal(documentEmbeddingText({ content_chunk: "x".repeat(5000) }).length, 2000);
});

test("embedTexts pide 768 dimensiones con el tipo de tarea y normaliza", async () => {
  const { client, calls } = fakeClient([[vector(3), vector(4)]]);
  const result = await embedTexts(client, ["a", "b"], "RETRIEVAL_DOCUMENT");
  assert.equal(result.length, 2);
  assert.equal(calls[0].config.outputDimensionality, 768);
  assert.equal(calls[0].config.taskType, "RETRIEVAL_DOCUMENT");
  assert.ok(Math.abs(result[0][0] - 1 / Math.sqrt(EMBEDDING_DIMENSIONS)) < 1e-9);
});

test("embedTexts reintenta ante 429 y luego responde", async () => {
  const { client, calls } = fakeClient([new Error("429 RESOURCE_EXHAUSTED"), [vector(1)]]);
  const result = await embedTexts(client, ["a"], "RETRIEVAL_QUERY", { baseDelayMs: 1 });
  assert.equal(result.length, 1);
  assert.equal(calls.length, 2);
});

test("embedTexts no reintenta errores no recuperables", async () => {
  const { client, calls } = fakeClient([new Error("400 INVALID_ARGUMENT"), [vector(1)]]);
  await assert.rejects(embedTexts(client, ["a"], "RETRIEVAL_QUERY", { baseDelayMs: 1 }), EmbeddingUnavailableError);
  assert.equal(calls.length, 1);
});

test("embedTexts falla si Gemini devuelve menos vectores que textos", async () => {
  const { client } = fakeClient([[vector(1)]]);
  await assert.rejects(embedTexts(client, ["a", "b"], "RETRIEVAL_DOCUMENT", { retries: 0 }), EmbeddingUnavailableError);
});

test("embedTexts sin cliente lanza EmbeddingUnavailableError", async () => {
  await assert.rejects(embedTexts(null, ["a"], "RETRIEVAL_QUERY"), EmbeddingUnavailableError);
  assert.deepEqual(await embedTexts(null, [], "RETRIEVAL_QUERY"), []);
});

test("suggestedRetryDelayMs lee la espera que sugiere Gemini", () => {
  assert.equal(suggestedRetryDelayMs(new Error("Please retry in 25.7s.")), 26700);
  assert.equal(suggestedRetryDelayMs(new Error('{"retryDelay": "300s"}')), 65000);
  assert.equal(suggestedRetryDelayMs(new Error("otro error")), null);
});

test("cuota diaria agotada: no reintenta e informa cuánto esperar", async () => {
  const daily = new Error('{"quotaId":"EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier","retryDelay": "21510s"}');
  const { client, calls } = fakeClient([daily, [vector(1)]]);
  await assert.rejects(embedTexts(client, ["a"], "RETRIEVAL_DOCUMENT", { baseDelayMs: 1 }), (err: any) => {
    assert.ok(err instanceof EmbeddingUnavailableError);
    assert.equal(err.retryAfterMs, 21_510_000);
    return true;
  });
  assert.equal(calls.length, 1);
});
