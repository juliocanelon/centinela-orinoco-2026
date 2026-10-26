# Plan de implementación: embeddings y búsqueda vectorial espacial (RAG)

**Proyecto:** Centinela Orinoco 2026
**Fecha:** 25/10/2026
**Base:** revisión del código (`server.ts`, `server/ragSearch.ts`, `server/satelliteScheduler.ts`) y consulta de solo lectura a Supabase de producción.

---

## 1. Objetivo

Que la memoria semántica sea **vectorial de verdad**:

- Cada documento de `environmental_rag_documents` tiene su embedding guardado en Supabase (pgvector).
- La búsqueda RAG combina en **una sola consulta SQL** la similitud coseno y el filtro por distancia (`ST_DWithin`), como describe el artículo.
- Un reranker ordena los resultados con el puntaje compuesto de la ecuación (1) del artículo.
- Si Gemini no responde, la búsqueda vuelve a la coincidencia de texto actual (degradación controlada).
- Los textos de la interfaz y del artículo dicen solo lo que el sistema hace.

## 2. Diagnóstico (25/10/2026)

| Qué | Estado actual |
|---|---|
| Documentos en `environmental_rag_documents` | ~1.216 (1.181 NASA_FIRMS, 17 SCIENTIFIC_CORPUS, 9 HYDRO_TELEMETRY, 2 INCIDENT_REPORT). Todos con latitud y longitud |
| Tamaño del texto (`content_chunk`) | Promedio 334 caracteres, máximo 1.009 |
| Columna `embedding` | **No existe** |
| Columna `geom` | **No existe** (solo `latitude` y `longitude`) |
| Función de búsqueda vectorial | **No existe**. El SQL de `getAutomationSqlScript()` (`match_spatial_environmental_rag`) es texto de ejemplo y nunca se ejecutó |
| Llamadas a embeddings | **Ninguna**. `server.ts:2307-2360` solo escribe mensajes como "Generando vector de 768-D" |
| Búsqueda actual | `server/ragSearch.ts`: fracción de palabras encontradas + distancia haversine |
| SDK | `@google/genai` 2.30.0, que trae `embedContent` con `taskType` y `outputDimensionality` |
| `GEMINI_API_KEY` en `.env` local | Vacía. En producción está en los Secrets de AI Studio |

## 3. Decisiones de diseño

1. **Modelo:** `gemini-embedding-001` con `outputDimensionality: 768`. Se usa `taskType: RETRIEVAL_DOCUMENT` para los documentos y `RETRIEVAL_QUERY` para las consultas. Los vectores se normalizan a norma 1. Se descarta `text-embedding-004` (retirado) y no se agrega Voyage, para no sumar otra clave ni otra dependencia.
2. **Vectorización asíncrona con un "worker" de pendientes.** Los documentos se siguen insertando como hoy, con `embedding = null`. Un proceso toma los pendientes por lotes, calcula sus embeddings y los guarda. Ventajas:
   - Ningún flujo de ingesta se cae si Gemini no tiene cuota.
   - Los 1.216 documentos existentes se rellenan con el mismo mecanismo.
   - Coincide con la tarea `embed_new_docs` del DAG del artículo.
3. **Texto a vectorizar:** `title + location_name + sub_basin + content_chunk`, recortado a 2.000 caracteres.
4. **Columna `geom` generada** desde latitud y longitud, con índice GiST, para que el filtro espacial use índice.
5. **Índice HNSW** (`vector_cosine_ops`, m=16, ef_construction=64).
6. **Disk IO del plan gratuito:** actualizaciones por lotes de 50 documentos; las consultas existentes que usan `select("*")` pasan a columnas explícitas para no descargar los vectores sin necesidad.
7. **Un solo nombre de función:** `match_environmental_documents`, el mismo del informe y del artículo. El SQL de ejemplo del scheduler se alinea con él.

---

## 4. Plan por fases

### Fase 1: Migración de base de datos

Archivo nuevo: `supabase/migrations/202610260001_rag_vector_search.sql`

- [ ] `create extension if not exists vector with schema extensions;`
- [ ] `alter table environmental_rag_documents add column embedding vector(768)`, `embedding_model text`, `embedded_at timestamptz`.
- [ ] `add column geom geometry(Point,4326) generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)) stored` + índice GiST.
- [ ] Índice HNSW sobre `embedding` con `vector_cosine_ops`.
- [ ] Índice parcial `where embedding is null` para encontrar pendientes rápido.
- [ ] Función `match_environmental_documents(query_embedding, p_lat, p_lng, p_radius_km, p_threshold, p_k)` que devuelve `id, doc_type, title, location_name, content_chunk, latitude, longitude, metadata, created_at, similarity, distance_km`. El filtro espacial es opcional: si `p_lat` es nulo, busca en toda la tabla. `security definer` con `search_path` fijo y `grant execute` solo a `service_role`.

**Aplicación:** la migración se ejecuta una vez en Supabase de producción (ver §6, decisión 1).

### Fase 2: Servicio de embeddings

Archivo nuevo: `server/embeddings.ts`

- [ ] `embedTexts(texts, taskType)`: llama a `ai.models.embedContent` con varios textos por petición, normaliza y devuelve `number[][]`.
- [ ] Reintento con espera exponencial ante HTTP 429 o 5xx (3 intentos). Si sigue fallando, lanza un error que el llamador trata como "sin embeddings por ahora".
- [ ] `toPgVector(v)`: convierte el vector al formato texto de pgvector (`[0.1,0.2,...]`).
- [ ] Reusa el cliente de `GoogleGenAI` de `aiModelManager.ts` (misma `GEMINI_API_KEY`), sin duplicar la configuración.

### Fase 3: Worker de vectorización y relleno inicial

Archivo nuevo: `server/embeddingWorker.ts`

- [ ] `embedPendingDocuments(client, { batchSize: 50, maxBatches })`: toma documentos con `embedding is null`, los vectoriza y actualiza `embedding`, `embedding_model` y `embedded_at`. Devuelve `{ embedded, pending, failed }`.
- [ ] Se ejecuta:
  - al arrancar el servidor (relleno inicial de los ~1.216 documentos, unas 25 peticiones);
  - al final de cada ejecución del scheduler que haya insertado documentos RAG;
  - al ingresar un documento al corpus (`/api/corpus/ingest`), para que quede buscable de inmediato.
- [ ] Bloqueo en memoria para que no corran dos workers a la vez.
- [ ] Contador visible: `GET /api/scheduler/status` agrega `ragDocsEmbedded` y `ragDocsPendingEmbedding`.
- [ ] Script `npm run rag:embed` (`tsx server/scripts/embedPending.ts`) para correr el relleno a mano.

### Fase 4: Búsqueda vectorial espacial y reranker

Archivos: `server/ragSearch.ts`, archivo nuevo `server/rag/reranker.ts`, `server.ts` (`/api/rag/vector-search`)

- [ ] `vectorSearch(client, params)`: vectoriza la consulta (`RETRIEVAL_QUERY`), llama a la RPC `match_environmental_documents` con k=20 y umbral 0,65, y aplica el reranker.
- [ ] `rerank()` con la ecuación (1) del artículo: `0,45·sim + 0,20·(1 − d/R) + 0,15·e^(−días/90) + 0,10·arbitrado + 0,10·severidad`.
  - `arbitrado` sale de `metadata.peer_reviewed` (solo el corpus).
  - `severidad` sale de la confianza o la potencia radiativa del foco FIRMS y del estado de la lectura hidrológica. Si no hay dato, vale 0.
  - Sin punto de consulta, el término de proximidad vale 0 y se reparte su peso en la similitud.
- [ ] `/api/rag/vector-search` intenta primero la búsqueda vectorial. Si falla el embedding de la consulta, la RPC, o no hay documentos vectorizados, usa la búsqueda de texto actual. La respuesta informa `searchMethod: "vector"` o `"text-fallback"`, y `similarity` y `rerankScore` por resultado.
- [ ] El análisis de zona y el chat siguen como están (no usan RAG hoy); se deja anotado como siguiente paso.

### Fase 5: Textos honestos en la interfaz

- [ ] `server.ts`: quitar los mensajes falsos de vectorización del corpus. Registrar lo que pasó: "documento guardado; embedding calculado" o "embedding pendiente (sin cuota)".
- [ ] `ScientificCorpusReader.tsx`: el texto "Vectorizando resumen con embeddings Voyage…" pasa a Gemini; el informe técnico embebido deja de mencionar Voyage y 12 modelos.
- [ ] `LiveIngestionPipelineView.tsx` y `satelliteApiDirectory.ts`: quitar "La tabla no tiene embeddings" y describir la búsqueda vectorial con respaldo de texto.
- [ ] `getAutomationSqlScript()`: alinear con la migración real o reemplazarlo por el contenido de la migración.
- [ ] Mostrar en el panel de ingesta los documentos vectorizados y pendientes.

### Fase 6: Pruebas

Sin dependencias nuevas: `node:test` ejecutado con `tsx --test`. Script `npm test`.

- [ ] `tests/reranker.test.ts`: orden por puntaje, umbral, radio, recencia, documento sin coordenadas, valores no numéricos.
- [ ] `tests/embeddings.test.ts`: normalización, formato pgvector, vector con NaN rechazado, reintento ante 429 (cliente simulado).
- [ ] `tests/ragFallback.test.ts`: si el embedding de la consulta falla, la búsqueda devuelve resultados por texto.
- [ ] Prueba de punta a punta en local contra Supabase (requiere `GEMINI_API_KEY` en `.env`): rellenar, buscar "balsas dragas en el río Atabapo" cerca de 3,99°N −67,68°O y comprobar que aparecen documentos cercanos sin compartir palabras exactas.

### Fase 7: Despliegue y documentación

- [ ] Rama `feature/rag-vectorial`, PR a `main`.
- [ ] Aplicar la migración en Supabase **antes** de publicar el código nuevo (el código viejo ignora las columnas nuevas, así que el orden es seguro).
- [ ] Push a `main` y sincronización manual en AI Studio. Al arrancar, el worker rellena los embeddings.
- [ ] Verificar en producción: `GET /api/scheduler/status` muestra `ragDocsPendingEmbedding = 0` y `/api/rag/vector-search` responde con `searchMethod: "vector"`.
- [ ] Actualizar el artículo IEEE (tabla de estado, sección V y limitaciones) y el informe preliminar con las cifras reales.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cuota gratuita de Gemini embeddings | Lotes de 50, reintentos con espera; lo que falte queda pendiente y se completa en la siguiente pasada |
| Disk IO del plan gratuito de Supabase | ~3 KB por vector (~4 MB en total); actualizaciones por lote; `select` sin la columna `embedding` |
| Umbral 0,65 demasiado alto o bajo para este modelo | Se mide con 5–10 consultas de prueba y se ajusta; queda documentado |
| El reranker no está calibrado | Se declara así en el artículo; los pesos son configurables |
| Producción y local desalineados | Migración idempotente (`if not exists`) y verificación después de cada paso |

## 6. Decisiones pendientes

1. **Cómo aplicar la migración en producción.** Opción A: la pegas en el SQL Editor de Supabase. Opción B: la aplico yo con `SUPABASE_DB_URL` del `.env`, agregando `postgres` como dependencia de desarrollo y un script `npm run db:migrate`.
2. **`GEMINI_API_KEY` en el `.env` local** para la prueba de punta a punta. Sin ella, la prueba real se hace directamente en producción después del despliegue.
3. **Alcance:** se recomienda hacer las fases 1 a 7 completas. Si hay poco tiempo, el mínimo defendible es 1 a 4 más los textos de la fase 5.
