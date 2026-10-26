import { test } from "node:test";
import assert from "node:assert/strict";
import { CandidateFetcher, hybridSearch, RagDocument, VectorMatchRow } from "../server/ragSearch";
import { embedPendingDocuments } from "../server/embeddingWorker";

const textDoc: RagDocument = {
  id: "texto-1",
  doc_type: "INCIDENT_REPORT",
  source_reference_id: null,
  title: "Balsa minera en el río Ventuari",
  location_name: "Ventuari",
  sub_basin: null,
  latitude: 4.5,
  longitude: -66.3,
  content_chunk: "Balsa de aluvión activa.",
  created_at: "2026-10-20T00:00:00Z",
};

const vectorRow: VectorMatchRow = {
  id: "vector-1",
  doc_type: "SCIENTIFIC_CORPUS",
  source_reference_id: "ART-1",
  title: "Mercurio en sedimentos del Caura",
  location_name: "Caura",
  sub_basin: "Caura",
  latitude: 6.0,
  longitude: -64.5,
  content_chunk: "Concentraciones de mercurio.",
  metadata: { peer_reviewed: true },
  created_at: "2026-10-20T00:00:00Z",
  similarity: 0.82,
  distance_km: 12,
};

const fetchText: CandidateFetcher = async () => [textDoc];

test("usa la búsqueda vectorial cuando hay coincidencias", async () => {
  const result = await hybridSearch({
    embedQuery: async () => [1, 0, 0],
    matchDocuments: async () => [vectorRow],
    fetchCandidates: fetchText,
  }, { query: "contaminación por mercurio", filterLat: 6, filterLng: -64.5, radiusKm: 50 });
  assert.equal(result.method, "vector");
  assert.equal(result.matches[0].id, "vector-1");
  assert.equal(result.matches[0].similarity, 0.82);
  assert.equal(result.matches[0].distanceKmFromQueryTarget, 12);
});

test("vuelve a la búsqueda de texto si falla el embedding de la consulta", async () => {
  const result = await hybridSearch({
    embedQuery: async () => { throw new Error("429 sin cuota"); },
    matchDocuments: async () => [vectorRow],
    fetchCandidates: fetchText,
  }, { query: "balsa minera Ventuari" });
  assert.equal(result.method, "text-fallback");
  assert.match(result.fallbackReason || "", /429/);
  assert.equal(result.matches[0].id, "texto-1");
});

test("vuelve a la búsqueda de texto si no hay vectores sobre el umbral", async () => {
  const result = await hybridSearch({
    embedQuery: async () => [1, 0, 0],
    matchDocuments: async () => [],
    fetchCandidates: fetchText,
  }, { query: "balsa minera" });
  assert.equal(result.method, "text-fallback");
  assert.match(result.fallbackReason || "", /similitud/);
});

test("consulta vacía no llama a Gemini", async () => {
  let called = false;
  const result = await hybridSearch({
    embedQuery: async () => { called = true; return []; },
    matchDocuments: async () => [],
    fetchCandidates: fetchText,
  }, { query: "   " });
  assert.equal(called, false);
  assert.equal(result.matches.length, 0);
});

/** Supabase simulado: solo lo que usa embedPendingDocuments. */
function fakeSupabase(pendingDocs: Record<string, any>[], updateError: string | null = null) {
  const updates: Record<string, any>[] = [];
  const builder = (state: { mode?: string; payload?: any }) => {
    const chain: any = {
      select: (_cols: string, opts?: any) => { state.mode = opts?.head ? "count" : "select"; return chain; },
      is: () => chain,
      not: () => chain,
      order: () => chain,
      limit: async () => ({ data: pendingDocs.splice(0, pendingDocs.length), error: null }),
      update: (payload: any) => { state.payload = payload; return chain; },
      eq: async () => {
        if (!updateError) updates.push(state.payload);
        return { error: updateError ? { message: updateError } : null };
      },
      then: (resolve: any) => resolve({ count: pendingDocs.length, error: null }),
    };
    return chain;
  };
  return { client: { from: () => builder({}) } as any, updates };
}

const okEmbeddings = {
  models: { embedContent: async (p: any) => ({ embeddings: p.contents.map(() => ({ values: Array(768).fill(1) })) }) },
} as any;

test("el worker guarda un embedding por documento pendiente", async () => {
  const { client, updates } = fakeSupabase([
    { id: "1", title: "A", content_chunk: "a" },
    { id: "2", title: "B", content_chunk: "b" },
  ]);
  const result = await embedPendingDocuments(client, okEmbeddings, { pauseMs: 0 });
  assert.equal(result.embedded, 2);
  assert.equal(updates[0].embedding_model, "gemini-embedding-001");
  assert.match(updates[0].embedding, /^\[/);
});

test("el worker se detiene sin romper si Gemini no responde", async () => {
  const { client } = fakeSupabase([{ id: "1", title: "A", content_chunk: "a" }]);
  const result = await embedPendingDocuments(client, null, { pauseMs: 0 });
  assert.equal(result.embedded, 0);
  assert.match(result.stoppedReason || "", /GEMINI_API_KEY/);
});

test("el worker corta la pasada si Supabase rechaza todas las actualizaciones", async () => {
  const { client } = fakeSupabase([{ id: "1", title: "A", content_chunk: "a" }], "disk IO");
  const result = await embedPendingDocuments(client, okEmbeddings, { pauseMs: 0 });
  assert.equal(result.failed, 1);
  assert.match(result.stoppedReason || "", /ningún embedding/);
});
